// =========================================================
// ENVIAR LEMBRETES (push com o app fechado)
//
// O pg_cron chama esta function a cada 5 minutos (ver schema.sql). Ela
// lê cada celular inscrito em `push_inscricoes`, calcula que horas são
// NO FUSO daquele celular, e manda o que venceu nos últimos minutos:
// refeição, água, sono e treino, com os mesmos textos do app.
//
// A agenda é montada pelo próprio app (Lembretes.agendaSemana) e
// reenviada sempre que muda: horário de treino, cardápio, switch de
// lembrete. Aqui ninguém recalcula plano, só confere relógio.
//
// Nunca manda duas vezes: antes de mandar, grava a chave
// 'dia hora tag' em `push_enviados`. Se a gravação não entrou (já
// existia), é porque outra execução já mandou.
//
// Segredos (Project Settings → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   a mesma de CONFIG.PUSH_VAPID_PUBLICA no app
//   VAPID_PRIVATE_KEY  a privada do par (NUNCA no código nem no app)
//   VAPID_SUBJECT      mailto: de contato, ex. mailto:suporte@seudominio.com.br
//   PUSH_CRON_TOKEN    o mesmo valor guardado no Vault como push_cron_token
//
// Publicar com a verificação de JWT DESLIGADA: quem chama é o banco,
// que se identifica pelo PUSH_CRON_TOKEN, não por login.
// =========================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') || '';
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') || '';
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:suporte@focusfit.app';
const PUSH_CRON_TOKEN = Deno.env.get('PUSH_CRON_TOKEN');

// O cron roda de 5 em 5 minutos; a janela de 10 cobre uma execução que
// atrasou ou falhou sem mandar o mesmo aviso duas vezes (push_enviados).
export const JANELA_MIN = 10;

const DIAS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type ItemAgenda = {
  hora: string;          // 'HH:MM'
  dias?: number[];       // 0=Seg ... 6=Dom; ausente = todo dia
  titulo: string;
  corpo: string;
  tag: string;
};

// data, minuto do dia e dia da semana (0=Seg) no fuso do celular
export function agoraNoFuso(fuso: string, agora: Date): { data: string; minutos: number; pos: number } {
  let partes: Intl.DateTimeFormatPart[];
  try {
    partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(agora);
  } catch {
    if (fuso !== 'America/Sao_Paulo') return agoraNoFuso('America/Sao_Paulo', agora);
    throw new Error('fuso inválido');
  }
  const p: Record<string, string> = {};
  for (const x of partes) p[x.type] = x.value;
  return {
    data: `${p.year}-${p.month}-${p.day}`,
    minutos: Number(p.hour) * 60 + Number(p.minute),
    pos: DIAS_EN.indexOf(p.weekday),
  };
}

// o que da agenda venceu agora: é dia dele e o horário passou há menos
// de JANELA_MIN minutos
export function vencidos(agenda: ItemAgenda[], local: { minutos: number; pos: number }): ItemAgenda[] {
  if (!Array.isArray(agenda)) return [];
  return agenda.filter(item => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(item?.hora || ''));
    if (!m) return false;
    if (Array.isArray(item.dias) && !item.dias.includes(local.pos)) return false;
    const passou = local.minutos - (Number(m[1]) * 60 + Number(m[2]));
    return passou >= 0 && passou < JANELA_MIN;
  });
}

function tokenValido(req: Request): boolean {
  if (!PUSH_CRON_TOKEN) return true; // sem segredo ainda: não bloqueia
  return req.headers.get('x-cron-token') === PUSH_CRON_TOKEN;
}

async function executar(): Promise<{ inscricoes: number; enviados: number; removidos: number; erros: number }> {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const agora = new Date();
  let inscricoes = 0, enviados = 0, removidos = 0, erros = 0;

  // de mil em mil, pra não depender de caber tudo numa resposta só
  for (let de = 0; ; de += 1000) {
    const { data: linhas, error } = await sb
      .from('push_inscricoes')
      .select('endpoint, p256dh, auth, fuso, agenda')
      .order('endpoint')
      .range(de, de + 999);
    if (error) throw new Error(error.message);
    if (!linhas || !linhas.length) break;

    for (const ins of linhas) {
      inscricoes++;
      let local;
      try { local = agoraNoFuso(ins.fuso, agora); } catch { continue; }

      for (const item of vencidos(ins.agenda as ItemAgenda[], local)) {
        const chave = `${local.data} ${item.hora} ${item.tag}`;
        const { data: novo, error: erroMarca } = await sb
          .from('push_enviados')
          .upsert({ endpoint: ins.endpoint, chave }, { onConflict: 'endpoint,chave', ignoreDuplicates: true })
          .select('chave');
        if (erroMarca) { erros++; continue; }
        if (!novo || !novo.length) continue;   // já mandado por outra execução

        try {
          await webpush.sendNotification(
            { endpoint: ins.endpoint, keys: { p256dh: ins.p256dh, auth: ins.auth } },
            JSON.stringify({ titulo: item.titulo, texto: item.corpo, tag: item.tag }),
            { TTL: 60 * 30, urgency: 'high' },
          );
          enviados++;
        } catch (e: any) {
          // 404/410: o celular desinstalou, limpou o navegador ou revogou a
          // permissão. A inscrição morreu e não volta: apaga.
          if (e?.statusCode === 404 || e?.statusCode === 410) {
            await sb.from('push_inscricoes').delete().eq('endpoint', ins.endpoint);
            removidos++;
            break;
          }
          // falha passageira (rede, serviço de push fora): desfaz a marca
          // pra próxima execução, 5 minutos depois, tentar de novo
          await sb.from('push_enviados').delete().eq('endpoint', ins.endpoint).eq('chave', chave);
          erros++;
          console.error('falha ao mandar push:', e?.statusCode, e?.body || e?.message);
        }
      }
    }
    if (linhas.length < 1000) break;
  }
  return { inscricoes, enviados, removidos, erros };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!tokenValido(req)) return new Response('token invalido', { status: 401 });
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ ok: false, erro: 'faltam os segredos VAPID' }), { status: 500 });
  }
  try {
    const r = await executar();
    return new Response(JSON.stringify({ ok: true, ...r }), { status: 200 });
  } catch (e: any) {
    console.error('erro ao enviar lembretes:', e?.message);
    return new Response(JSON.stringify({ ok: false, erro: e?.message }), { status: 500 });
  }
});

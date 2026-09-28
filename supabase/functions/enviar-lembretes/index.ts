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
// AVISO PRA TODOS: chamada com { "aviso": { titulo, texto, tela } } no
// corpo, em vez de conferir a agenda, manda essa mensagem pra todos os
// celulares inscritos (ver SUPABASE.md, "Mandar um aviso pra todos").
// A mesma mensagem no mesmo dia não sai duas vezes, então rodar o SQL
// de novo sem querer não repete.
//
// Segredos (Project Settings → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY   a mesma de CONFIG.PUSH_VAPID_PUBLICA no app
//   VAPID_PRIVATE_KEY  a privada do par (NUNCA no código nem no app)
//   VAPID_SUBJECT      mailto: de contato, ex. mailto:suporte@seudominio.com.br
//   PUSH_CRON_TOKEN    o mesmo valor guardado no Vault como push_cron_token
//
// Publicar com a verificação de JWT DESLIGADA: quem chama é o banco,
// que se identifica pelo PUSH_CRON_TOKEN, não por login. Sem esse
// segredo a função recusa tudo: aberta, qualquer um mandaria
// notificação pros clientes.
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
  if (!PUSH_CRON_TOKEN) return false;
  return req.headers.get('x-cron-token') === PUSH_CRON_TOKEN;
}

// as telas que um aviso pode abrir no toque (as abas de baixo do app)
export const TELAS = ['inicio', 'treinos', 'alimentacao', 'progresso', 'perfil'];

type Inscricao = { endpoint: string; p256dh: string; auth: string; fuso: string; agenda: unknown };
type Resultado = 'enviado' | 'repetido' | 'removido' | 'erro';
type Contagem = { inscricoes: number; enviados: number; removidos: number; erros: number };

// Marca, manda e trata a resposta. A marca vem antes de mandar: se duas
// execuções chegarem juntas, só a que conseguiu gravar manda.
async function mandar(sb: any, ins: Inscricao, chave: string, payload: object): Promise<Resultado> {
  const { data: novo, error: erroMarca } = await sb
    .from('push_enviados')
    .upsert({ endpoint: ins.endpoint, chave }, { onConflict: 'endpoint,chave', ignoreDuplicates: true })
    .select('chave');
  if (erroMarca) return 'erro';
  if (!novo || !novo.length) return 'repetido';

  try {
    await webpush.sendNotification(
      { endpoint: ins.endpoint, keys: { p256dh: ins.p256dh, auth: ins.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 30, urgency: 'high' },
    );
    return 'enviado';
  } catch (e: any) {
    // 404/410: o celular desinstalou, limpou o navegador ou revogou a
    // permissão. A inscrição morreu e não volta: apaga.
    if (e?.statusCode === 404 || e?.statusCode === 410) {
      await sb.from('push_inscricoes').delete().eq('endpoint', ins.endpoint);
      return 'removido';
    }
    // falha passageira (rede, serviço de push fora): desfaz a marca
    // pra próxima tentativa conseguir mandar
    await sb.from('push_enviados').delete().eq('endpoint', ins.endpoint).eq('chave', chave);
    console.error('falha ao mandar push:', e?.statusCode, e?.body || e?.message);
    return 'erro';
  }
}

function contar(c: Contagem, r: Resultado) {
  if (r === 'enviado') c.enviados++;
  else if (r === 'removido') c.removidos++;
  else if (r === 'erro') c.erros++;
}

// todas as inscrições, de mil em mil, pra não depender de caber tudo
// numa resposta só
async function* inscricoes(sb: any): AsyncGenerator<Inscricao[]> {
  for (let de = 0; ; de += 1000) {
    const { data: linhas, error } = await sb
      .from('push_inscricoes')
      .select('endpoint, p256dh, auth, fuso, agenda')
      .order('endpoint')
      .range(de, de + 999);
    if (error) throw new Error(error.message);
    if (!linhas || !linhas.length) return;
    yield linhas as Inscricao[];
    if (linhas.length < 1000) return;
  }
}

function cliente() {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

async function executar(): Promise<Contagem> {
  const sb = cliente();
  const agora = new Date();
  const c: Contagem = { inscricoes: 0, enviados: 0, removidos: 0, erros: 0 };

  for await (const lote of inscricoes(sb)) {
    for (const ins of lote) {
      c.inscricoes++;
      let local;
      try { local = agoraNoFuso(ins.fuso, agora); } catch { continue; }

      for (const item of vencidos(ins.agenda as ItemAgenda[], local)) {
        const r = await mandar(sb, ins, `${local.data} ${item.hora} ${item.tag}`,
          { titulo: item.titulo, texto: item.corpo, tag: item.tag });
        contar(c, r);
        if (r === 'removido') break;
      }
    }
  }
  return c;
}

export type Aviso = { titulo: string; texto: string; tela: string; chave: string };

// confere o aviso que veio no corpo e devolve pronto pra mandar, ou o erro
export async function lerAviso(bruto: any): Promise<Aviso | { erro: string }> {
  const titulo = String(bruto?.titulo ?? '').trim();
  const texto = String(bruto?.texto ?? '').trim();
  const tela = String(bruto?.tela ?? 'inicio').trim();
  if (!titulo || !texto) return { erro: 'o aviso precisa de titulo e texto' };
  if (titulo.length > 80) return { erro: 'titulo com mais de 80 caracteres' };
  if (texto.length > 240) return { erro: 'texto com mais de 240 caracteres' };
  if (!TELAS.includes(tela)) return { erro: 'tela precisa ser uma de: ' + TELAS.join(', ') };

  // mesma mensagem no mesmo dia = mesma chave = não sai duas vezes
  const dia = new Date().toISOString().slice(0, 10);
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(titulo + '\n' + texto)));
  const resumo = Array.from(bytes.slice(0, 8), b => b.toString(16).padStart(2, '0')).join('');
  return { titulo, texto, tela, chave: `aviso ${dia} ${resumo}` };
}

async function mandarAviso(aviso: Aviso): Promise<Contagem> {
  const sb = cliente();
  const c: Contagem = { inscricoes: 0, enviados: 0, removidos: 0, erros: 0 };
  const payload = { titulo: aviso.titulo, texto: aviso.texto, tag: 'aviso', tela: aviso.tela };

  for await (const lote of inscricoes(sb)) {
    c.inscricoes += lote.length;
    // de 50 em 50 ao mesmo tempo: um por um, mil celulares estourariam
    // o tempo da função
    for (let i = 0; i < lote.length; i += 50) {
      const rs = await Promise.all(lote.slice(i, i + 50).map(ins => mandar(sb, ins, aviso.chave, payload)));
      rs.forEach(r => contar(c, r));
    }
  }
  return c;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  if (!tokenValido(req)) return new Response('token invalido', { status: 401 });
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ ok: false, erro: 'faltam os segredos VAPID' }), { status: 500 });
  }

  let corpo: any = {};
  try { corpo = await req.json(); } catch { /* o cron manda {} */ }

  try {
    if (corpo && corpo.aviso) {
      const aviso = await lerAviso(corpo.aviso);
      if ('erro' in aviso) return new Response(JSON.stringify({ ok: false, erro: aviso.erro }), { status: 400 });
      const r = await mandarAviso(aviso);
      return new Response(JSON.stringify({ ok: true, aviso: aviso.titulo, ...r }), { status: 200 });
    }
    const r = await executar();
    return new Response(JSON.stringify({ ok: true, ...r }), { status: 200 });
  } catch (e: any) {
    console.error('erro ao enviar:', e?.message);
    return new Response(JSON.stringify({ ok: false, erro: e?.message }), { status: 500 });
  }
});

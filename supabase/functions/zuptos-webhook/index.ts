// =========================================================
// WEBHOOK DA ZUPTOS
//
// Mesma função da ticto-webhook, adaptada pra Zuptos: recebe o aviso
// de venda/assinatura/reembolso e atualiza a tabela `assinaturas`,
// que é o que o app consulta pra liberar ou não as telas internas.
// A tabela `assinaturas` é a mesma das duas plataformas — só muda
// quem grava nela.
//
// ⚠️ IMPORTANTE — leia antes de considerar isso pronto:
// Não tive acesso à documentação oficial do payload da Zuptos, então
// esta function segue a mesma estratégia cautelosa da ticto-webhook:
//   1. grava o payload cru, sempre, em `zuptos_webhook_logs`;
//   2. tenta interpretar por caminhos plausíveis (`extrair` abaixo);
//   3. se não achar e-mail, não quebra — só avisa.
// Depois de configurar o webhook de verdade na Zuptos e gerar UM
// evento de teste (o próprio painel deve ter um botão de teste), abra
// a tabela `zuptos_webhook_logs` no Supabase, veja o payload real, e
// ajuste `extrair()` e `statusInterno()` pros nomes de campo corretos.
//
// Autenticação: no painel da Zuptos, a opção "Possui token de
// autenticação" manda o token ou no header ou dentro do corpo — como
// não sei qual, esta function aceita os dois formatos mais comuns:
//   - header  Authorization: Bearer SEU_TOKEN
//   - header  X-Webhook-Token: SEU_TOKEN
//   - campo   payload.token
// Configure o segredo com:
//   supabase secrets set ZUPTOS_WEBHOOK_TOKEN=o_token_que_a_zuptos_te_deu
// =========================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const ZUPTOS_WEBHOOK_TOKEN = Deno.env.get('ZUPTOS_WEBHOOK_TOKEN');

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// mapeia o texto do evento/status que a Zuptos manda pro nosso
// vocabulário interno. Ajuste esta lista depois de ver eventos reais.
function statusInterno(evento: string | undefined): string {
  const e = (evento || '').toLowerCase();
  if (/(cancel|reembols|estorno|chargeback|recus)/.test(e)) return 'cancelada';
  if (/(atras|pendente|venc)/.test(e)) return 'atrasada';
  if (/(pago|aprovad|renovad|confirmad)/.test(e)) return 'ativa';
  return 'inativa';
}

function extrair(payload: any) {
  const evento =
    payload?.evento ?? payload?.event ?? payload?.event_type ?? payload?.status ?? payload?.tipo ?? '';

  const email =
    payload?.cliente?.email ??
    payload?.customer?.email ??
    payload?.comprador?.email ??
    payload?.buyer?.email ??
    payload?.email ??
    null;

  const plano =
    payload?.produto?.nome ??
    payload?.product?.name ??
    payload?.plano?.nome ??
    payload?.plan_name ??
    payload?.item?.name ??
    null;

  const transacao =
    payload?.transacao_id ??
    payload?.transaction_id ??
    payload?.order_id ??
    payload?.id ??
    null;

  const status = statusInterno(evento);

  let dataExpiracao: string | null =
    payload?.assinatura?.proxima_cobranca ??
    payload?.subscription?.next_charge_date ??
    payload?.access_until ??
    null;

  if (!dataExpiracao) {
    const dias = /anual/i.test(plano || '') ? 365 : /trimestral/i.test(plano || '') ? 90 : 30;
    const d = new Date();
    d.setDate(d.getDate() + dias);
    dataExpiracao = d.toISOString();
  }

  return { email, plano, transacao, status, dataExpiracao };
}

function tokenValido(req: Request, payload: any): boolean {
  if (!ZUPTOS_WEBHOOK_TOKEN) return true; // sem segredo configurado ainda: não bloqueia (configure assim que tiver o token)

  const auth = req.headers.get('authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  const headerToken = req.headers.get('x-webhook-token') || '';

  return (
    bearer === ZUPTOS_WEBHOOK_TOKEN ||
    headerToken === ZUPTOS_WEBHOOK_TOKEN ||
    payload?.token === ZUPTOS_WEBHOOK_TOKEN
  );
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return new Response('payload invalido', { status: 400 });
  }

  if (!tokenValido(req, payload)) {
    return new Response('token invalido', { status: 401 });
  }

  // grava o payload cru sempre, mesmo se o resto abaixo falhar
  await sb.from('zuptos_webhook_logs').insert({ payload });

  const { email, plano, transacao, status, dataExpiracao } = extrair(payload);

  if (!email) {
    return new Response(JSON.stringify({ ok: true, aviso: 'sem e-mail no payload' }), { status: 200 });
  }

  const { error } = await sb.from('assinaturas').upsert(
    {
      email: email.toLowerCase(),
      plano,
      status,
      transacao_id: transacao,
      data_inicio: new Date().toISOString(),
      data_expiracao: dataExpiracao,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'email' },
  );

  if (error) {
    console.error('erro ao gravar assinatura:', error.message);
    return new Response(JSON.stringify({ ok: false, erro: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});

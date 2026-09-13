// =========================================================
// WEBHOOK DA TICTO
//
// Recebe o aviso que a Ticto manda a cada evento de pagamento (compra
// aprovada, assinatura renovada, atrasada, cancelada) e atualiza a
// tabela `assinaturas` no Supabase, que é o que o app consulta pra
// liberar ou não as telas internas.
//
// ⚠️ IMPORTANTE — leia antes de considerar isso pronto:
// Não tive como confirmar ao vivo o formato exato do payload da
// Ticto (a documentação oficial ficou bloqueada no ambiente onde
// escrevi isto). O que sei com razoável confiança, por buscas:
//   - o payload é JSON, versão "2.0"
//   - tem um campo `status` (ex.: "authorized" pra compra aprovada)
//   - tem um campo `token`, que é o segredo pra confirmar que quem
//     está mandando o aviso é mesmo a Ticto (não deve ser divulgado)
// O resto (onde fica o e-mail do cliente, o nome do plano, a data de
// expiração) é uma tentativa razoável, não uma certeza.
//
// Por isso esta function SEMPRE grava o payload inteiro, cru, em
// `ticto_webhook_logs` antes de tentar interpretar qualquer coisa.
// Depois de configurar o webhook de verdade na Ticto e gerar UM
// evento de teste (a própria Ticto tem um botão de "testar" no painel
// de configuração do webhook), abra essa tabela no Supabase, veja o
// payload real, e ajuste a função `extrair()` abaixo se os nomes dos
// campos não baterem com o que já está aqui.
// =========================================================

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// defina esse segredo com:
//   supabase secrets set TICTO_WEBHOOK_TOKEN=o_token_que_a_ticto_te_deu
const TICTO_WEBHOOK_TOKEN = Deno.env.get('TICTO_WEBHOOK_TOKEN');

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// mapeia o texto de status que a Ticto manda pro nosso vocabulário
// interno. Ajuste esta lista depois de ver eventos reais — os nomes
// aqui são um chute educado com base no que a busca trouxe.
function statusInterno(statusTicto: string | undefined): string {
  const s = (statusTicto || '').toLowerCase();
  if (['authorized', 'approved', 'paid', 'completed'].includes(s)) return 'ativa';
  if (['refused', 'canceled', 'cancelled', 'chargeback', 'refunded'].includes(s)) return 'cancelada';
  if (['late', 'overdue', 'pending', 'trial_ended'].includes(s)) return 'atrasada';
  return 'inativa';
}

function extrair(payload: any) {
  // tenta achar o e-mail em alguns caminhos plausíveis
  const email =
    payload?.customer?.email ??
    payload?.buyer?.email ??
    payload?.client?.email ??
    payload?.email ??
    null;

  const plano =
    payload?.item?.name ??
    payload?.product?.name ??
    payload?.offer?.name ??
    payload?.plan_name ??
    null;

  const transacao =
    payload?.transaction_hash ??
    payload?.order?.id ??
    payload?.token ??
    null;

  const status = statusInterno(payload?.status);

  // data de expiração: se a Ticto mandar, usa; senão estima pelo nome
  // do plano (só como fallback grosseiro — confira depois)
  let dataExpiracao: string | null =
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

  // confirma que quem está chamando é mesmo a Ticto — sem isso,
  // qualquer pessoa poderia se autodeclarar "assinante" só chamando
  // essa URL na mão.
  if (TICTO_WEBHOOK_TOKEN && payload?.token !== TICTO_WEBHOOK_TOKEN) {
    return new Response('token invalido', { status: 401 });
  }

  // grava o payload cru sempre, mesmo se o resto abaixo falhar
  await sb.from('ticto_webhook_logs').insert({ payload });

  const { email, plano, transacao, status, dataExpiracao } = extrair(payload);

  if (!email) {
    // não temos como identificar de quem é — o evento já ficou salvo
    // no log acima pra investigar depois, então só avisamos sem erro.
    return new Response(JSON.stringify({ ok: true, aviso: 'sem e-mail no payload' }), { status: 200 });
  }

  const { error } = await sb.from('assinaturas').upsert(
    {
      email: email.toLowerCase(),
      plano,
      status,
      ticto_transacao: transacao,
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

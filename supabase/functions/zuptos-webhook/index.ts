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

// Palavra que identifica o order bump do Plano Duo dentro do payload.
// Trocou o nome da oferta na Zuptos? Ajuste o segredo em vez do codigo:
//   supabase secrets set ZUPTOS_MARCA_DUO=nome_novo
const MARCA_DUO = (Deno.env.get('ZUPTOS_MARCA_DUO') || 'duo').toLowerCase();

// Palavra que identifica a compra avulsa do Modo Corrida. Mesma ideia
// do MARCA_DUO: o nome da oferta na Zuptos e que manda.
//   supabase secrets set ZUPTOS_MARCA_CORRIDA=nome_novo
const MARCA_CORRIDA = (Deno.env.get('ZUPTOS_MARCA_CORRIDA') || 'corrida').toLowerCase();

// Palavra do reajuste mensal (R$9,90/mes). Diferente do Modo Corrida,
// este e RECORRENTE: a linha ganha data de validade e vence se a
// pessoa parar de pagar.
//   supabase secrets set ZUPTOS_MARCA_REAJUSTE=nome_novo
const MARCA_REAJUSTE = (Deno.env.get('ZUPTOS_MARCA_REAJUSTE') || 'reajuste').toLowerCase();

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

  // ---------- PLANO DUO (order bump) ----------
  // O bump pode chegar em varios lugares do payload (uma lista de itens,
  // um campo de ofertas, o nome do produto) e o formato da Zuptos ainda
  // nao foi confirmado. Entao a busca e no payload inteiro, serializado:
  // grosseiro, mas pega o bump onde quer que ele esteja, em vez de
  // depender de acertar o caminho de primeira.
  //
  // ⚠️ Confira contra o payload real em `zuptos_webhook_logs` antes de
  // confiar nisso. O risco do jeito atual e o falso positivo: se a
  // palavra "duo" aparecer em qualquer outro campo, a compra ganha a
  // vaga extra sem ter sido paga.
  let vagas = 1;
  let cru = '';
  try { cru = JSON.stringify(payload).toLowerCase(); } catch { /* payload estranho */ }
  if (cru.includes(MARCA_DUO)) vagas = 2;

  // ---------- MODO CORRIDA (compra avulsa) ----------
  // Produto separado da assinatura. Quando a compra e dele, esta
  // function NAO pode encostar em `assinaturas`: seria sobrescrever o
  // plano da pessoa (plano viraria "Modo Corrida", validade viraria a
  // da compra avulsa) e derrubar o acesso dela ao app inteiro por ter
  // comprado um extra.
  //
  // O nome do produto e o criterio principal; o payload inteiro e a
  // rede de seguranca, pro caso de o nome do produto vir vazio.
  const ehCorrida = /corrida/i.test(plano || '') || cru.includes(MARCA_CORRIDA);

  // ---------- REAJUSTE MENSAL (extra recorrente) ----------
  // Mesma separacao do Modo Corrida: nao pode encostar em `assinaturas`,
  // senao a compra de um extra de R$9,90 sobrescreveria o plano de
  // R$29,90 da pessoa. A diferenca e que este vence todo mes.
  const ehReajuste = /reajuste/i.test(plano || '') || cru.includes(MARCA_REAJUSTE);

  return { email, plano, transacao, status, dataExpiracao, vagas, ehCorrida, ehReajuste };
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

  const { email, plano, transacao, status, dataExpiracao, vagas, ehCorrida, ehReajuste } = extrair(payload);

  if (!email) {
    return new Response(JSON.stringify({ ok: true, aviso: 'sem e-mail no payload' }), { status: 200 });
  }

  // ---------- extra recorrente: grava com validade e sai ----------
  if (ehReajuste) {
    const { error: erroReaj } = await sb.from('acessos_extras').upsert(
      {
        email: email.toLowerCase(),
        produto: 'reajuste',
        status: status === 'ativa' ? 'ativo' : 'cancelado',
        transacao_id: transacao,
        data_expiracao: dataExpiracao,   // vence e precisa da renovacao, diferente do Modo Corrida
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'email,produto' },
    );
    if (erroReaj) {
      console.error('erro ao gravar o reajuste:', erroReaj.message);
      return new Response(JSON.stringify({ ok: false, erro: erroReaj.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true, produto: 'reajuste' }), { status: 200 });
  }

  // ---------- compra avulsa: grava no lugar dela e sai ----------
  if (ehCorrida) {
    const { error: erroExtra } = await sb.from('acessos_extras').upsert(
      {
        email: email.toLowerCase(),
        produto: 'corrida',
        status: status === 'ativa' ? 'ativo' : 'cancelado',
        transacao_id: transacao,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: 'email,produto' },
    );
    if (erroExtra) {
      console.error('erro ao gravar acesso extra:', erroExtra.message);
      return new Response(JSON.stringify({ ok: false, erro: erroExtra.message }), { status: 500 });
    }
    return new Response(JSON.stringify({ ok: true, produto: 'corrida' }), { status: 200 });
  }

  const { error } = await sb.from('assinaturas').upsert(
    {
      email: email.toLowerCase(),
      plano,
      status,
      transacao_id: transacao,
      data_inicio: new Date().toISOString(),
      data_expiracao: dataExpiracao,
      // so escreve quando DETECTOU o bump. Omitido, o upsert preserva o
      // valor que ja estava la — senao uma renovacao (que nao repete o
      // nome do bump no payload) derrubaria a vaga extra de volta pra 1
      // e o titular perderia o Duo sem ninguem perceber.
      ...(vagas > 1 ? { vagas } : {}),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: 'email' },
  );

  // A pessoa convidada acompanha o titular sozinha: o trigger
  // `assinaturas_espelhar_duo` (schema.sql) copia status e validade pra
  // linha dela a cada update aqui. Nada a fazer nesta function.

  if (error) {
    console.error('erro ao gravar assinatura:', error.message);
    return new Response(JSON.stringify({ ok: false, erro: error.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});

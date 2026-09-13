/* =========================================================
   CONFIGURAÇÃO
   Este é o único arquivo que você precisa mexer para trocar
   nome do app ou credenciais do banco.

   A chave abaixo é a chave PÚBLICA (publishable/anon) do
   Supabase — ela foi feita para ficar visível no site mesmo.
   Quem protege os dados são as políticas RLS do banco
   (veja o arquivo schema.sql).

   NUNCA coloque aqui a senha do banco nem a service_role key.
   ========================================================= */

const CONFIG = {
  APP_NOME: 'Fit Day',

  SUPABASE_URL: 'https://ddtxvijlmjqtaxdystph.supabase.co',
  SUPABASE_KEY: 'sb_publishable_XsRkTp9ahN8T3ydSfOEE_Q_AYH4Oq11',

  /* links de checkout da Ticto — cole aqui assim que criar os 3
     produtos no painel da Ticto. Vazio = a tela de assinatura mostra
     um aviso em vez do link (não quebra o app).
     ⚠️ Esses mesmos 3 links também precisam ser colados no topo do
     quiz.html, quiz/escuro.html e quiz/claro.html (constantes
     CHECKOUT_URL_MENSAL/TRIMESTRAL/ANUAL) — são arquivos separados,
     sem import entre eles, então o valor não se propaga sozinho. */
  CHECKOUT_URL_MENSAL: '',
  CHECKOUT_URL_TRIMESTRAL: '',
  CHECKOUT_URL_ANUAL: ''
};

/* deixa acessível também como window.CONFIG */
window.CONFIG = CONFIG;

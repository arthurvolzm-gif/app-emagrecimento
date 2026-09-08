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
  APP_NOME: 'Meu Plano',

  /* Mostra, na tela de Início, uma barra com os 10 níveis para você
     visualizar cada animação sem precisar somar pontos.
     TROQUE PARA false ANTES DE DIVULGAR O APP.                      */
  MODO_PREVIA: true,

  SUPABASE_URL: 'https://ddtxvijlmjqtaxdystph.supabase.co',
  SUPABASE_KEY: 'sb_publishable_XsRkTp9ahN8T3ydSfOEE_Q_AYH4Oq11'
};

/* deixa acessível também como window.CONFIG */
window.CONFIG = CONFIG;

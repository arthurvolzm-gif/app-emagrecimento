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
  APP_NOME: 'Focus Fit',

  SUPABASE_URL: 'https://ddtxvijlmjqtaxdystph.supabase.co',
  SUPABASE_KEY: 'sb_publishable_XsRkTp9ahN8T3ydSfOEE_Q_AYH4Oq11',

  /* links de checkout — hoje na Zuptos (antes eram da Ticto). Vazio =
     a tela de assinatura mostra um aviso em vez do link (não quebra
     o app).
     ⚠️ Esses mesmos 3 links também precisam ser colados no topo de
     quiz.html, quiz/escuro.html, quiz/claro.html, quiz/natural.html e
     quiz/caneta.html (constantes CHECKOUT_URL_MENSAL/TRIMESTRAL/ANUAL)
     — são arquivos separados, sem import entre eles, então o valor
     não se propaga sozinho. */
  CHECKOUT_URL_MENSAL: 'https://app.zuptos.com.br/checkout/0c0f9d90ef9c6938',
  CHECKOUT_URL_TRIMESTRAL: 'https://app.zuptos.com.br/checkout/b8b35e1625ad65b7',
  CHECKOUT_URL_ANUAL: 'https://app.zuptos.com.br/checkout/4c18c052c5030bd6',

  /* suporte: abre a conversa no WhatsApp direto, sem mensagem pronta.
     Um lugar só — a tela de login, as boas-vindas e a aba de Perfil
     leem daqui. Trocou o número? Troca aqui e pronto. */
  SUPORTE_WHATS: 'https://wa.me/5541987975115',
  SUPORTE_NUMERO: '41 98797-5115'
};

/* deixa acessível também como window.CONFIG */
window.CONFIG = CONFIG;

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

  /* ---------- Modo Corrida (produto extra, R$29,90) ----------
     Compra avulsa feita DENTRO do app, na aba Treinos. Crie o produto
     na Zuptos com a palavra "corrida" no nome — é por ela que o
     webhook sabe que a compra é deste produto e grava em
     `acessos_extras` em vez de mexer na assinatura da pessoa.
     Vazio = o botão não aparece e o Modo Corrida some da aba. */
  CHECKOUT_URL_CORRIDA: 'https://app.zuptos.com.br/checkout/93042bb4f9eaa131',
  PRECO_CORRIDA: 'R$29,90',

  /* ---------- Reajuste mensal (extra recorrente, R$9,90/mês) ----------
     Libera as fases do treino, as sugestões de carga e o relatório de
     virada de mês. Crie o produto na Zuptos como ASSINATURA mensal, com
     a palavra "reajuste" no nome. Vazio = o reajuste fica liberado pra
     todo mundo, sem cobrança (é o comportamento de antes). */
  CHECKOUT_URL_REAJUSTE: 'https://app.zuptos.com.br/checkout/4b614ef4fe65668b',
  PRECO_REAJUSTE: 'R$9,90',

  /* ---------- acesso fechado (modo de teste) ----------
     Enquanto esta lista tiver algum e-mail, o app só abre para ELES, e
     abre direto: sem pedir código e sem checar assinatura. É o que
     permite testar o app publicado antes de o envio de e-mail e o
     webhook da Zuptos estarem de pé.
     Qualquer outro e-mail recebe um aviso e não entra.

     ⚠️ DEIXE A LISTA VAZIA ([]) PARA ABRIR O APP AO PÚBLICO. Com ela
     vazia volta o fluxo normal: e-mail → código → assinatura conferida.

     Isto é uma tranca de porta, não um cofre: a lista está no código e
     qualquer um consegue lê-la. Quem protege os dados de verdade são as
     políticas RLS do Supabase, onde cada pessoa só enxerga a própria
     linha. A lista serve pra segurar o acesso durante o teste, não pra
     esconder segredo. */
  ACESSO_TESTE: ['arthur.volz.m@gmail.com'],

  /* suporte: abre a conversa no WhatsApp direto, sem mensagem pronta.
     Um lugar só — a tela de login, as boas-vindas e a aba de Perfil
     leem daqui. Trocou o número? Troca aqui e pronto. */
  SUPORTE_WHATS: 'https://wa.me/5541987975115',
  SUPORTE_NUMERO: '41 98797-5115'
};

/* deixa acessível também como window.CONFIG */
window.CONFIG = CONFIG;

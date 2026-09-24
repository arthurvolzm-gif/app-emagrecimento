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

  /* ---------- Modo Corrida (produto extra, R$19,90/ano) ----------
     Compra avulsa feita DENTRO do app, na aba Treinos. Crie o produto
     na Zuptos com a palavra "corrida" no nome — é por ela que o
     webhook sabe que a compra é deste produto e grava em
     `acessos_extras` em vez de mexer na assinatura da pessoa.
     Vazio = o botão não aparece e o Modo Corrida some da aba. */
  CHECKOUT_URL_CORRIDA: 'https://app.zuptos.com.br/checkout/1ad1f0c357f8f4d7',
  PRECO_CORRIDA: 'R$19,90',

  /* ---------- Biblioteca de exercícios ----------
     Vendida como order bump do checkout do plano, com "biblioteca" no
     nome (é por essa palavra que o webhook reconhece). Quem já é cliente
     e não levou o bump não tem como comprar pelo checkout do plano, então
     este link avulso é o caminho dela.
     Vazio = a aba mostra "fale com o suporte" em vez do botão. */
  CHECKOUT_URL_BIBLIOTECA: 'https://app.zuptos.com.br/checkout/23e17f361bb0cf57',
  PRECO_BIBLIOTECA: 'R$9,90',

  /* ---------- Receitas + Lista de Compras (e-book, order bump) ----------
     Vendida como order bump do checkout do plano, com "receitas" no
     nome (é por essa palavra que o webhook reconhece e liga a coluna
     `tem_receitas`, igual à Biblioteca). Quem já é cliente e não levou
     o bump usa este checkout avulso.

     ⚠️ Chamamos de "Receitas" na tela, não de "Lista de Compras": o app
     já tem uma lista de compras GRÁTIS (Comida → Cardápio → aba
     Compras), automática a partir do cardápio calculado. É outra
     coisa — a lista de lá é quantidade por macro; esta é a lista de
     ingredientes de cada receita do e-book. Mas o nome tem que deixar
     isso óbvio, senão vira ticket de suporte de gente achando que
     pagou de novo por algo que já tinha.

     RECEITAS_PDF_URL é o link do e-book (Google Drive, Dropbox, o que
     for) pra quem já comprou. Vazio = a tela liberada mostra "fale com
     o suporte" em vez do botão de abrir. */
  CHECKOUT_URL_RECEITAS: '',
  PRECO_RECEITAS: 'R$19,90',
  RECEITAS_PDF_URL: '',

  /* ---------- Plano Duo (segunda vaga, R$14,90/mês) ----------
     Vendido como order bump do checkout do plano, com "duo" no nome (é
     por essa palavra que o webhook reconhece e sobe `vagas` pra 2).
     Este link avulso é pra quem JÁ é cliente e não levou o bump: é o
     que a notificação e a tela do Duo abrem.
     Vazio = a oferta não aparece em lugar nenhum (nem a notificação). */
  CHECKOUT_URL_DUO: 'https://app.zuptos.com.br/checkout/2ab6c1841faaa564',
  PRECO_DUO: 'R$14,90',

  /* ---------- Reajuste mensal (extra recorrente, R$9,90/mês) ----------
     Libera as fases do treino, as sugestões de carga e o relatório de
     virada de mês. Crie o produto na Zuptos como ASSINATURA mensal, com
     a palavra "reajuste" no nome. Vazio = o reajuste fica liberado pra
     todo mundo, sem cobrança.
     Com o link preenchido (como agora): a PRIMEIRA troca de estratégia
     de cada pessoa sai sempre grátis, de graça mesmo — é o "vem ver o
     que você ganha". Da segunda em diante, precisa ter comprado um dos
     planos abaixo. Essa regra do primeiro mês grátis é automática, em
     Store.reajusteLiberado(); não depende de nada aqui. */
  CHECKOUT_URL_REAJUSTE: 'https://app.zuptos.com.br/checkout/4b614ef4fe65668b',
  PRECO_REAJUSTE: 'R$9,90',
  /* o mesmo produto por ano: 9,8 meses de mensalidade, que é o desconto
     anual padrão. Vazio = a tela do reajuste mostra só a opção mensal. */
  CHECKOUT_URL_REAJUSTE_ANUAL: '',
  PRECO_REAJUSTE_ANUAL: 'R$97',

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

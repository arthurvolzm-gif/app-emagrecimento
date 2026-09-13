# Webhook da Ticto (controle de assinatura)

Esta function recebe o aviso que a Ticto manda a cada evento de pagamento
(compra aprovada, renovação, atraso, cancelamento) e atualiza a tabela
`assinaturas` no Supabase. É isso que o app consulta pra saber se libera ou
não as telas internas pra quem logou.

## Passo a passo pra colocar no ar

### 1. Rodar o `schema.sql` atualizado

Se você já rodou o `schema.sql` antes, precisa rodar de novo — ele veio com
tabelas novas (`assinaturas`, `ticto_webhook_logs`, `respostas_quiz`). Pode
colar o arquivo inteiro de novo no SQL Editor do Supabase e rodar: tudo foi
escrito pra não duplicar nem apagar o que já existia.

### 2. Instalar a CLI do Supabase

No PowerShell (Windows), com o Scoop instalado:

```
scoop install supabase
```

Se não tiver o Scoop, veja as outras opções em
`https://supabase.com/docs/guides/cli/getting-started`.

### 3. Conectar a CLI ao seu projeto

```
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

O `PROJECT_REF` é aquele código no final da URL do seu projeto Supabase
(ex.: em `https://ddtxvijlmjqtaxdystph.supabase.co`, o ref é
`ddtxvijlmjqtaxdystph`).

### 4. Configurar o segredo do webhook

Na Ticto, ao criar o webhook (veja passo 6), ela te dá um **token** — uma
senha que vem dentro de cada aviso, pra provar que quem está chamando é
mesmo ela. Guarde esse token e rode:

```
supabase secrets set TICTO_WEBHOOK_TOKEN=cole_o_token_aqui
```

### 5. Publicar a function

```
supabase functions deploy ticto-webhook --no-verify-jwt
```

O `--no-verify-jwt` é necessário porque quem chama essa URL é a Ticto, não
uma pessoa logada no seu app — sem essa flag, o Supabase bloquearia a
chamada antes mesmo dela chegar na function.

Ao final, o comando mostra a URL pública da function, algo como:

```
https://SEU_PROJECT_REF.supabase.co/functions/v1/ticto-webhook
```

### 6. Configurar o webhook no painel da Ticto

No painel da Ticto → *Webhooks* (ou *Tictools → Integrações → Webhook*),
crie um novo apontando pra URL do passo 5, escolha o formato **JSON**, a
versão **2.0**, e marque pelo menos estes eventos: compra aprovada,
assinatura renovada, assinatura atrasada, assinatura cancelada.

### 7. Testar com um evento real (ou o teste da própria Ticto)

A Ticto costuma ter um botão de "testar" no painel de configuração do
webhook, que manda um evento de exemplo. Depois de mandar:

1. Abra o Supabase → Table Editor → `ticto_webhook_logs`.
2. Veja a linha mais recente e confira o `payload` — é o JSON exato que a
   Ticto mandou.
3. Compare com o que a function espera (veja os comentários no topo do
   `index.ts` — os campos de e-mail, plano e data de expiração são um
   chute educado, não uma certeza, porque não consegui confirmar o
   formato oficial ao vivo).
4. Se algum campo não bater, ajuste a função `extrair()` no `index.ts` e
   rode `supabase functions deploy ticto-webhook --no-verify-jwt` de novo.

Sem esse teste, existe o risco real de a assinatura nunca ser marcada como
ativa mesmo com o pagamento aprovado (ou o contrário) — vale a pena fazer
antes de divulgar o app.

# Webhook da Zuptos (controle de assinatura)

Esta function recebe o aviso que a Zuptos manda a cada evento de pagamento
(compra aprovada, renovação, cancelamento, reembolso) e atualiza a tabela
`assinaturas` no Supabase — a mesma tabela que a Ticto já usava. É isso que
o app consulta pra saber se libera ou não as telas internas pra quem logou.

## Passo a passo pra colocar no ar

### 1. Rodar o `schema.sql` atualizado

Ele veio com uma tabela nova (`zuptos_webhook_logs`) e renomeou a coluna
`assinaturas.ticto_transacao` para `transacao_id` (pra não ficar amarrada
ao nome de uma plataforma só). Pode colar o arquivo inteiro de novo no SQL
Editor do Supabase e rodar: foi escrito pra não duplicar nem apagar nada.

### 2. Instalar a CLI do Supabase (se ainda não tiver)

No PowerShell (Windows), com o Scoop instalado:

```
scoop install supabase
```

Se não tiver o Scoop, veja as outras opções em
`https://supabase.com/docs/guides/cli/getting-started`.

### 3. Conectar a CLI ao seu projeto

```
supabase login
supabase link --project-ref ddtxvijlmjqtaxdystph
```

(`ddtxvijlmjqtaxdystph` é o mesmo projeto que já está em `config.js`.)

### 4. Configurar o segredo do webhook

No painel da Zuptos, ao criar o webhook, tem os campos **"Chave do token
(nome do header)"** e **"Valor do token"**. Preencha:

- **Chave do token:** `X-Webhook-Token`
- **Valor do token:** uma string aleatória só sua, sem relação com senha
  pessoal nenhuma — por exemplo `zpt_wh_9f3a2c7e1b4d6081a5c9e2f7034b8d6c`
  (pode usar essa mesma ou gerar outra)

Depois guarde o mesmo valor aqui:

```
supabase secrets set ZUPTOS_WEBHOOK_TOKEN=zpt_wh_9f3a2c7e1b4d6081a5c9e2f7034b8d6c
```

Os dois lados (painel da Zuptos e este comando) precisam ter **exatamente
o mesmo valor**, senão a function rejeita todo aviso com "token invalido".

### 5. Publicar a function

```
supabase functions deploy zuptos-webhook --no-verify-jwt
```

O `--no-verify-jwt` é necessário porque quem chama essa URL é a Zuptos, não
uma pessoa logada no seu app — sem essa flag, o Supabase bloquearia a
chamada antes mesmo dela chegar na function.

Ao final, o comando confirma a URL pública, que deve ser:

```
https://ddtxvijlmjqtaxdystph.supabase.co/functions/v1/zuptos-webhook
```

(a mesma que você já colou em "URL de destino" no painel da Zuptos)

### 6. Terminar de configurar o webhook no painel da Zuptos

- **URL de destino:** a URL do passo 5
- **Eventos:** marque os de aprovação (boleto pago, pix pago, cartão
  aprovado) **e também** os de cancelamento/reembolso/estorno — sem esses
  últimos, quem cancela continua liberado pra sempre no app
- **Produtos:** só o(s) produto(s) do Focus Fit, não todos os da conta

### 7. Testar com um evento real (ou o teste do próprio painel)

Se a Zuptos tiver um botão de "testar webhook", use-o. Depois:

1. Abra o Supabase → Table Editor → `zuptos_webhook_logs`.
2. Veja a linha mais recente e confira o `payload` — é o JSON exato que a
   Zuptos mandou.
3. Me mande esse payload (ou cole aqui na conversa) — os campos de e-mail,
   plano, evento e data de expiração em `extrair()` no `index.ts` são um
   chute educado, porque não tive acesso à documentação oficial da Zuptos.
   Eu ajusto assim que vir um payload real.
4. Depois do ajuste, rode `supabase functions deploy zuptos-webhook
   --no-verify-jwt` de novo.

Sem esse teste, existe o risco real de a assinatura nunca ser marcada como
ativa mesmo com o pagamento aprovado (ou o contrário) — vale a pena fazer
antes de divulgar o app.

## E a Ticto, para de funcionar?

Não. `ticto-webhook` continua exatamente como estava (só o nome da coluna
`transacao_id` mudou, sem efeito prático). As duas functions podem
coexistir enquanto você migra — a tabela `assinaturas` é a mesma para as
duas plataformas.

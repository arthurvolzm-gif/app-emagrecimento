# Publicar o app

Roteiro do que falta pra o app sair do repositório e virar um link que a
pessoa instala no celular. A ordem importa: o passo 1 é o que impede
publicar hoje, e o passo 4 é o que mais costuma quebrar no dia do
lançamento.

O que está pronto no código está marcado com ✅. O que depende de painel
está com ⬜ e é a sua parte.

---

## 0. Acesso fechado durante o teste ✅

`CONFIG.ACESSO_TESTE` em `config.js` está com
`['arthur.volz.m@gmail.com']`. Enquanto essa lista tiver algum e-mail:

- só esses e-mails entram, e entram **direto, sem código** (o envio de
  e-mail ainda não está de pé);
- qualquer outro recebe "O app ainda está em testes e este e-mail não tem
  acesso" e não passa.

**Para abrir ao público, deixe a lista vazia: `ACESSO_TESTE: []`.** Aí
volta o fluxo normal: e-mail → código → assinatura conferida.

---

## 1. Modo de teste desligado ✅

`PULAR_LOGIN` em `js/app.js` está em `false`, que é o fluxo real:
e-mail → código de 6 números → assinatura conferida.

Com `true` o app abre direto, sem pedir nada. **Nunca publicar assim**: o
produto fica liberado pra qualquer um que souber o link.

---

## 2. Banco de dados ⬜

O `schema.sql` deste repositório mudou depois da última vez que rodou.
Falta rodar de novo pra criar a tabela de log da Zuptos, renomear uma
coluna e subir a retenção das respostas do quiz de 48 h para 30 dias.

1. Painel do Supabase → **SQL Editor** → **New query**
2. Abra `schema.sql`, copie **tudo**, cole e clique em **Run**

É seguro rodar mais de uma vez: o arquivo usa `create table if not
exists` e blocos que checam antes de alterar.

**Esta rodada também fecha um furo de privacidade.** A tabela
`respostas_quiz` tinha uma política de leitura com `using (true)`, o que
liberava ler QUALQUER linha — e a chave do app é pública por natureza.
Quem a copiasse baixava nome, e-mail e respostas de todo mundo que fez o
quiz. Agora a busca por token passa por uma função no banco, que devolve
uma linha só e exige o token exato; ler por e-mail continua valendo só
pra quem está logado com aquele e-mail.

---

## 3. E-mail do código ⬜

Duas coisas separadas, e as duas precisam ser feitas.

### 3.1 O template

Por padrão o Supabase manda um **link** de confirmação. O app pede o
**código digitado**. Com o template de fábrica a pessoa recebe algo que
não serve e fica travada na porta.

1. **Authentication → Emails → Magic Link**
2. Assunto: `Seu código de acesso: {{ .Token }}`
3. Corpo: cole o conteúdo de `supabase/email-codigo.html`
4. A logo dentro dele já aponta pra
   `app-emagrecimento-three.vercel.app/logo-focusfit.png`

O que não pode sumir do corpo: **`{{ .Token }}`**. É ele que vira o
código.

### 3.2 Quem manda o e-mail

O envio embutido do Supabase é **só para teste**: são poucos e-mails por
hora. Num lançamento com dez compras juntas, do décimo primeiro em diante
ninguém recebe o código e ninguém entra.

Configure um SMTP próprio em **Authentication → Emails → SMTP Settings**.
Sugestões: **Resend** (3.000/mês grátis) ou **Brevo** (300/dia grátis).

Evite mandar de um `@gmail.com`: limite baixo, cai em spam, e o Google
pode suspender a conta por uso fora dos termos. O ideal é verificar um
domínio próprio e mandar de algo como `acesso@focusfit.com.br`.

---

## 4. Webhook da Zuptos ⬜

Sem ele a pessoa compra e não entra: ninguém escreve na tabela
`assinaturas`.

1. Supabase → **Edge Functions** → nova função `zuptos-webhook`
2. Cole o conteúdo de `supabase/functions/zuptos-webhook/index.ts`
3. Em **Settings → Edge Functions → Secrets**, crie
   `ZUPTOS_WEBHOOK_TOKEN` com o mesmo valor que estiver no painel da
   Zuptos
4. No painel da Zuptos, aponte o webhook para a URL da função
5. **Dispare um evento de teste** e me mande o que caiu na tabela
   `zuptos_webhook_logs`

O passo 5 não é opcional: a função grava o payload bruto antes de
qualquer coisa justamente porque o formato da Zuptos ainda não foi
confirmado. A leitura dos campos hoje é palpite, e só o payload real
fecha isso.

---

## 5. Deploy na Vercel ⬜

Hoje o deploy está desligado — foi assim que evitamos gastar cota
enquanto o app estava sendo montado.

1. Vercel → o projeto → **Settings → General**
2. **Ignored Build Step** → trocar de "Don't build anything" para
   **Automatic**
3. **Deployments → Redeploy**

Depois disso todo push publica sozinho.

A URL é **https://app-emagrecimento-three.vercel.app** — a raiz já serve
o app (`index.html`). O `vercel.json` também responde em `/app` e
`/teste`, que levam pro mesmo lugar.

O deploy substitui o que está lá hoje: a Vercel serve sempre o último
commit da `main`.

---

## 6. Teste de verdade, antes de divulgar ⬜

Faça a compra inteira, do começo ao fim, como se fosse uma cliente:

1. Comprar num dos links da Zuptos
2. Receber o e-mail de acesso
3. Abrir o app, pedir o código, receber, digitar
4. Conferir que o plano aparece montado a partir das respostas do quiz
5. No Chrome do Android: três pontinhos → **Instalar aplicativo**

Só depois disso o link vai pro público.

---

## O que dizer pra quem comprou

> Seu acesso está liberado. Abra este link no celular:
> **https://app-emagrecimento-three.vercel.app**
>
> Entre com o mesmo e-mail que você usou na compra. Vai chegar um código
> de 6 números nele.
>
> Pra ficar com o app na tela inicial: toque nos três pontinhos do
> navegador e escolha "Instalar aplicativo".

---

## Depois de publicar

Ficou de fora de propósito, pra não atrasar o lançamento:

- **Lembrete com o app fechado.** Site não dispara notificação fechado;
  hoje o app avisa só com ele aberto e mostra o que passou quando a
  pessoa volta. Resolver isso exige service worker com push (servidor e
  chave) ou empacotar como APK pelo PWABuilder.
- **Ícones de traço na barra de navegação já estão feitos**, mas os
  emojis coloridos continuam nos níveis e nos quadros de estatística,
  como nas telas de referência.

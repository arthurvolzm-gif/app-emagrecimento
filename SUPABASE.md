# Terminar o Supabase, do começo ao fim

Um roteiro só, na ordem certa, pra você sentar uma vez e sair com tudo
funcionando. Cada passo diz **onde clicar**, **o que fazer** e **como
saber que deu certo** — esse último é o que evita descobrir o problema
com cliente no WhatsApp.

Reserve uma hora. O passo 3 (SMTP) é o que costuma pedir mais espera,
porque depende de verificar domínio.

---

## Antes: quem manda em quê

Isso responde a maior parte das dúvidas sozinho.

| Coisa | Onde se configura | Por quê |
|---|---|---|
| **Cobrar, renovar todo mês, cancelar** | **Zuptos** | É a plataforma de pagamento. O Supabase não cobra ninguém. |
| **Quem tem acesso, e até quando** | **Supabase** | A tabela `assinaturas`. Só o webhook escreve nela. |
| **Preço mostrado, links de checkout, o que está bloqueado, o conteúdo dos planos** | **No código** (`config.js` e `js/data.js`) | São decisões de produto, moram em arquivo. |

O fluxo inteiro é sempre o mesmo:

> **Zuptos cobra → avisa o webhook → o webhook grava no Supabase → o app lê.**

O app **nunca** decide se alguém pagou. Ele pergunta. Isso é de
propósito: se o app decidisse, qualquer pessoa se liberaria editando o
navegador.

---

## 1. Rodar o `schema.sql`

**Onde:** painel do Supabase → menu lateral → **SQL Editor** → **New query**

Abra o `schema.sql` deste repositório, copie **tudo**, cole e clique em
**Run**.

Ele mudou bastante desde a última vez que você rodou. Agora cria:

- `dados_usuario` — o progresso de cada pessoa
- `assinaturas` — quem pagou, até quando, **e as colunas do Plano Duo**
  (`vagas`, `titular_email`)
- `acessos_extras` — as compras avulsas, hoje o Modo Corrida
- `respostas_quiz` — a ponte do quiz pro cadastro
- `zuptos_webhook_logs` e `ticto_webhook_logs` — o que a plataforma mandou, cru
- o trigger que faz a vaga do Duo acompanhar o titular
- as funções `duo_convidar`, `duo_remover`, `duo_estado`
- a limpeza automática das respostas do quiz, 1x por dia

É seguro rodar quantas vezes quiser: tudo é `create ... if not exists`
ou `create or replace`.

**Como saber que deu certo:** menu **Table Editor** → você vê
`dados_usuario`, `assinaturas`, `acessos_extras`, `respostas_quiz` e os
dois `..._webhook_logs`. Clique em `assinaturas` e confira que existem
as colunas **`vagas`** e **`titular_email`**.

> Se der erro em `create extension pg_cron`: vá em **Database →
> Extensions**, procure `pg_cron`, ligue, e rode o arquivo de novo.

---

## 2. O template do e-mail

**Onde:** **Authentication → Emails → Magic Link**

- **Assunto:** `Seu código de acesso: {{ .Token }}`
- **Corpo:** cole o conteúdo de `supabase/email-codigo.html`

⚠️ **O `{{ .Token }}` não pode sumir.** É ele que vira o código de 6
números. O template de fábrica manda um **link** de confirmação, e o app
pede o **código digitado** — com o de fábrica a pessoa recebe algo que
não serve e trava na porta.

**Como saber que deu certo:** faça o passo 5 e veja se o e-mail chega
com 6 números legíveis, não com um link.

---

## 3. O SMTP (não pule este)

**Onde:** **Authentication → Emails → SMTP Settings**

O envio embutido do Supabase é **só pra teste**: poucos e-mails por
hora. Num lançamento com dez compras juntas, da décima primeira em
diante ninguém recebe o código, ninguém entra, e você descobre pelo
WhatsApp lotado.

1. Crie conta no **Resend** (3.000/mês grátis) ou **Brevo** (300/dia)
2. Verifique um domínio seu (o mesmo do app, se possível)
3. Copie host, porta, usuário e senha pro painel do Supabase
4. Remetente: algo como `acesso@seudominio.com.br`

**Não mande de `@gmail.com`:** limite baixo, cai em spam, e o Google
pode suspender a conta por uso fora dos termos.

**Como saber que deu certo:** o e-mail do passo 5 chega em menos de 30
segundos e **não** cai no spam.

---

## 4. O webhook

São três partes, e as três precisam existir.

### 4.1 Publicar a função

**Onde:** **Edge Functions → Deploy a new function**, nome
`zuptos-webhook`. Cole o conteúdo de
`supabase/functions/zuptos-webhook/index.ts`.

Anote a URL que aparece:
`https://SEU-PROJETO.supabase.co/functions/v1/zuptos-webhook`

### 4.2 Criar os segredos

**Onde:** **Project Settings → Edge Functions → Secrets**

| Nome | Valor | Pra quê |
|---|---|---|
| `ZUPTOS_WEBHOOK_TOKEN` | o token que a Zuptos te deu | sem ele, qualquer um na internet consegue se declarar pago chamando a sua URL |
| `ZUPTOS_MARCA_DUO` | `duo` | a palavra que identifica o order bump |
| `ZUPTOS_MARCA_CORRIDA` | `corrida` | a palavra que identifica o Modo Corrida |
| `ZUPTOS_MARCA_REAJUSTE` | `reajuste` | a palavra que identifica o reajuste mensal |

> Os dois últimos só são necessários se você **não** usar essas palavras
> nos nomes das ofertas. Usando, pode deixar em branco: o padrão já é
> esse.

### 4.3 Apontar na Zuptos

No painel da Zuptos, cadastre a URL da função como webhook, para
**todos** os eventos: compra aprovada, **renovação**, atraso,
cancelamento, reembolso e chargeback.

Marcar só "compra aprovada" é o erro clássico: sem os outros, quem
cancela continua com acesso pra sempre e quem renova perde o acesso
quando a data vence.

### 4.4 O nome dos produtos

Isto não é firula, é o que o webhook usa pra separar as compras:

| Produto | Precisa ter no nome |
|---|---|
| Assinatura mensal / trimestral / anual | nada de especial |
| Order bump do Plano Duo | a palavra **duo** |
| Modo Corrida (avulso, compra única) | a palavra **corrida** |
| Reajuste mensal (assinatura de R$9,90) | a palavra **reajuste** |

⚠️ Se o Modo Corrida **não** tiver "corrida" no nome, o webhook trata
como assinatura, sobrescreve o plano da pessoa e ela **perde o acesso
ao app inteiro por ter comprado um extra**.

### 4.5 Me mandar o payload real

Dispare um evento de teste no painel da Zuptos. Depois vá em **Table
Editor → `zuptos_webhook_logs`**, abra a linha e me mande o conteúdo de
`payload`.

**Isso não é formalidade.** Eu escrevi a leitura dos campos no palpite,
porque nunca vi a documentação da Zuptos. Sem o payload real tem chance
boa de a pessoa comprar e não entrar. Me mande, se puder, **três**: uma
assinatura normal, uma com o bump do Duo, e uma do Modo Corrida.

---

## 5. A compra de verdade, antes de divulgar

Compre você mesmo, do começo ao fim, como cliente:

1. Comprar num link da Zuptos
2. Ver a linha aparecer em `assinaturas` com **status `ativa`**
3. Abrir o app, pedir o código, receber o e-mail, digitar
4. Conferir que o plano aparece montado a partir das respostas do quiz

Se travar, o primeiro lugar pra olhar é sempre `zuptos_webhook_logs`:
tem linha? Então a Zuptos chamou e o problema é a leitura. Não tem
linha? Então o webhook não foi chamado, e o problema é na Zuptos.

---

## 6. Abrir pro público

**Onde:** `config.js`, no repositório.

Troque `ACESSO_TESTE: ['arthur.volz.m@gmail.com']` por
`ACESSO_TESTE: []`.

Enquanto essa lista tiver algum e-mail, **só ele entra, e entra sem
código nenhum**. Com ela vazia volta o fluxo real: e-mail → código →
assinatura conferida.

Deixe pro fim. É a última tranca a sair.

---

## 7. A renovação mensal

Não existe nada pra configurar aqui, mas existe o que entender.

**Quem renova é a Zuptos.** Ela cobra, e manda um evento de renovação
pro webhook. O webhook empurra a `data_expiracao` pra frente. O app, a
cada abertura, compara essa data com hoje: passou, cai na tela de
"falta o pagamento"; não passou, entra.

Três coisas que podem dar errado, e o que fazer:

**A Zuptos não manda evento de renovação.** Aí a data vence e um cliente
em dia perde o acesso. É o risco mais provável dos três, porque hoje,
quando o payload não traz data de validade, o webhook chuta 30 dias pra
frente (365 se o nome do plano tiver "anual", 90 se tiver "trimestral").
**Confirme no painel da Zuptos que o evento de renovação está marcado**
e me mande o payload de uma renovação real quando a primeira acontecer.

**Alguém cancela e continua entrando.** Só acontece se o evento de
cancelamento não estiver marcado no webhook. Confira o passo 4.3.

**O Plano Duo.** Não precisa de nada: um trigger no banco copia status e
validade do titular pra quem está na vaga, toda vez que a linha do
titular muda. Cancelou, os dois perdem juntos.

**O Modo Corrida não renova**, é compra única. Mora em `acessos_extras`
e não tem data de validade de propósito.

---

## 8. Quando precisar resolver na mão

Cole no **SQL Editor**. São as quatro que o suporte pede.

**Liberar alguém que pagou e não entrou:**

```sql
update public.assinaturas
   set status = 'ativa', data_expiracao = now() + interval '30 days'
 where lower(email) = lower('cliente@exemplo.com');
```

Se a pessoa nem linha tem (o webhook falhou de vez):

```sql
insert into public.assinaturas (email, plano, status, data_inicio, data_expiracao)
values (lower('cliente@exemplo.com'), 'mensal', 'ativa', now(), now() + interval '30 days')
on conflict (email) do update
   set status = 'ativa', data_expiracao = excluded.data_expiracao;
```

**Dar a vaga do Plano Duo a quem comprou o bump:**

```sql
update public.assinaturas set vagas = 2
 where lower(email) = lower('cliente@exemplo.com');
```

Depois é ela quem convida, pela aba Perfil do app.

**Liberar o reajuste mensal na mão (por 30 dias):**

```sql
insert into public.acessos_extras (email, produto, status, data_expiracao)
values (lower('cliente@exemplo.com'), 'reajuste', 'ativo', now() + interval '30 days')
on conflict (email, produto) do update
   set status = 'ativo', data_expiracao = excluded.data_expiracao;
```

**Liberar o Modo Corrida na mão:**

```sql
insert into public.acessos_extras (email, produto, status)
values (lower('cliente@exemplo.com'), 'corrida', 'ativo')
on conflict (email, produto) do update set status = 'ativo';
```

**Ver a situação de alguém, tudo de uma vez:**

```sql
select a.email, a.plano, a.status, a.data_expiracao, a.vagas, a.titular_email,
       (select string_agg(produto, ', ') from public.acessos_extras e
         where lower(e.email) = lower(a.email) and e.status = 'ativo') as extras
  from public.assinaturas a
 where lower(a.email) = lower('cliente@exemplo.com');
```

---

## O que NUNCA vai em `config.js`

O `config.js` vai pro navegador de todo mundo. A chave que está lá é a
**publishable/anon**, feita pra ser pública — quem protege os dados são
as políticas RLS.

**Nunca** coloque ali a **`service_role` key** nem a **senha do banco**.
Com a service_role, qualquer pessoa lê e edita a tabela inteira, se
declara assinante e baixa os dados de todos os seus clientes. Essas duas
vivem só nos **Secrets** das Edge Functions.

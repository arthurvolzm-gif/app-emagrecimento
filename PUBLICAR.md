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

## 2 a 4. Tudo do Supabase ⬜

Estes três passos (banco, e-mail, webhook) viraram um roteiro só, na
ordem certa, com o "como saber que deu certo" de cada um e o SQL de
socorro pra quando o suporte precisar resolver na mão:

### → **[`SUPABASE.md`](SUPABASE.md)**

Reserve uma hora e faça de uma vez. Lá dentro:

1. Rodar o `schema.sql` (mudou: ganhou o Plano Duo e os acessos extras)
2. O template do e-mail, com o `{{ .Token }}`
3. O SMTP próprio (Resend ou Brevo) — o passo que eu não pularia
4. O webhook: publicar, criar os segredos, apontar na Zuptos, nomear os
   produtos, e me mandar o payload real
5. A compra de teste de ponta a ponta
6. Abrir pro público (`ACESSO_TESTE: []`)
7. Como a renovação mensal funciona e o que pode dar errado nela
8. SQL de socorro: liberar acesso, dar a vaga do Duo, liberar o Modo
   Corrida, ver a situação de um cliente

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

## 6.5 Plano Duo (order bump) ⬜

O Duo tem um problema que não é de código: **a plataforma de pagamento
só conhece um e-mail, o de quem pagou.** A segunda pessoa tem outro
e-mail, que o checkout nunca viu. Por isso quem cria a vaga da segunda
pessoa é o próprio titular, de dentro do app, depois da compra.

Como ficou:

1. A pessoa compra com o bump. O webhook grava a assinatura dela com
   **`vagas = 2`** em vez de 1.
2. No app, na aba **Perfil**, aparece o cartão **"Plano Duo"** com um
   campo de e-mail: ela digita o e-mail de quem vai junto.
3. Esse e-mail ganha uma linha própria em `assinaturas`, apontando pro
   titular. A segunda pessoa entra no app com o e-mail dela, como
   qualquer cliente, e monta o plano dela.
4. Se o titular cancela, atrasa ou renova, **a vaga acompanha na hora**
   (é um trigger no banco, não depende do webhook saber que existem
   duas pessoas).
5. O titular pode tirar quem está na vaga e chamar outra pessoa. Os
   dados de quem saiu ficam guardados.

Os dois planos são independentes: metas, cardápio, treino e progresso
separados. Ninguém enxerga o do outro.

### O que você precisa fazer

- **Rodar o `schema.sql` de novo** (passo 2). Ele ganhou as colunas
  `vagas` e `titular_email`, o trigger e as três funções do Duo.
- **Nomear a oferta do bump na Zuptos com a palavra "duo"** (ex.:
  "Plano Duo — leve alguém com você"). É por ela que o webhook
  reconhece a compra.

⚠️ **Como o webhook detecta hoje:** ele procura a palavra "duo" no
payload inteiro. É grosseiro de propósito, porque o formato da Zuptos
ainda não foi confirmado, e assim funciona onde quer que o bump apareça.
**O risco é falso positivo:** se "duo" aparecer em qualquer outro campo
(nome do cliente, endereço, nome de outro produto), aquela compra ganha
a vaga extra sem ter pago. Assim que você me mandar um payload real de
compra COM bump e um SEM bump (tabela `zuptos_webhook_logs`), eu troco
essa busca pelo campo certo e o risco some.

Se quiser mudar o nome do bump, não precisa mexer no código:

```
supabase secrets set ZUPTOS_MARCA_DUO=a_palavra_nova
```

E se precisar liberar uma vaga na mão (venda antiga, caso especial), é
uma linha no SQL Editor:

```sql
update public.assinaturas set vagas = 2 where email = 'cliente@exemplo.com';
```

---

## 6.6 Modo Corrida (produto extra dentro do app) ⬜

Venda avulsa de R$29,90, feita dentro da aba **Treinos**: um botão no
topo troca entre "Treino" e "Corrida". Quem não comprou vê a tela de
venda com a semana 1 à mostra e o resto coberto. Quem comprou vê o
plano de 8 semanas.

O acesso é **separado da assinatura**: pagamento único, não vence junto
com o plano mensal, e mora numa tabela própria (`acessos_extras`).

### O caminho automático, de ponta a ponta

1. A pessoa toca em **"Liberar o Modo Corrida"**.
2. O app leva ela pro checkout **já com o e-mail dela na URL**. Isso não
   é detalhe: se ela pagar com outro e-mail, o acesso é gravado no
   e-mail errado e ela não libera nada. É o motivo nº 1 de suporte
   nesse tipo de venda.
3. Ela paga. A Zuptos chama o webhook.
4. O webhook vê que o produto é o Modo Corrida e grava em
   `acessos_extras`, **sem encostar na assinatura dela**.
5. Ela volta pro app. Uma linha no `index.html` percebe que ela tinha
   ido pro checkout e pergunta ao banco se o acesso caiu, **5 vezes a
   cada 2,5 segundos** (o webhook costuma levar alguns segundos). Caiu,
   a tela troca sozinha pro plano.
6. Se demorar mais que isso, existe o **"Já paguei, liberar meu
   acesso"**, que refaz a pergunta. E, se ainda assim não achar, abre o
   suporte em vez de deixar a pessoa no vazio.

Nenhum passo depende de você estar na frente do computador.

### O que você precisa fazer

- **Criar o produto na Zuptos** com a palavra **"corrida"** no nome
  (ex.: "Modo Corrida — plano de 8 semanas"). É por ela que o webhook
  separa esta compra da assinatura.
- **Colar o link em `config.js`**, em `CHECKOUT_URL_CORRIDA`. Enquanto
  estiver vazio, o botão "Corrida" nem aparece na aba Treinos.
- **Rodar o `schema.sql` de novo** (passo 2), que ganhou a tabela
  `acessos_extras`.
- **Revisar o conteúdo do plano.** As 8 semanas dos 3 níveis estão em
  `js/data.js`, no bloco `CORRIDA_NIVEIS`. Escrevi uma primeira versão
  conservadora, no formato dos programas de iniciante. **É o seu produto
  e a sua assinatura por trás dele: leia antes de vender.**

⚠️ **Por que o produto tem que ter "corrida" no nome:** sem isso, o
webhook trata a compra como assinatura e faz upsert em `assinaturas` —
o plano da pessoa viraria "Modo Corrida", a validade viraria a da
compra avulsa, e ela perderia o acesso ao app inteiro por ter comprado
um extra. Com o payload real na mão eu troco esse critério pelo id do
produto, que é à prova disso.

### Dentro do app da Play Store

Preço e botão de pagamento **não aparecem** — a mesma regra do Google
que já vale na tela de assinatura. Lá o Modo Corrida mostra o que é,
diz que não faz parte do plano atual e oferece o suporte. Quem comprou
pelo site vê o plano normalmente, porque o acesso é por e-mail.

---

## 6.7 Reajuste mensal do plano ✅

Não vai nada no Supabase. O Supabase só responde "quem tem acesso"; o
reajuste é cálculo em cima do perfil e roda no aparelho da pessoa.

**O que já acontecia (e ninguém via):** toda pesagem recalcula meta de
calorias, água, proteína e carboidrato, e o cardápio reescala as
gramagens de todas as refeições. Corpo mais leve gasta menos, o prato
encolhe junto.

**O que faltava:** o treino nunca mudava, e o reajuste era invisível.

Agora, no primeiro acesso de cada mês, entra a tela **"Seu plano de
[mês] foi reajustado"**, com:

- peso do último reajuste → peso de hoje
- meta de calorias antes → agora, e o porquê
- quanto por cento as gramagens do cardápio mudaram
- a fase nova do treino
- as cargas que já dá pra subir, tiradas do histórico dela

**As 4 fases do treino** (`FASES_TREINO` em `js/data.js`) giram mês a
mês em cima do mesmo plano: Adaptação → Volume → Intensidade →
Densidade → volta pra Adaptação. Os exercícios continuam os mesmos de
propósito: trocar tudo todo mês impede a pessoa de ver a carga subindo,
que é o que prende. O que muda é o estímulo.

Só aparece pra quem entrou num mês anterior — quem criou a conta há
três dias não tem o que reajustar.

**Revise as fases** antes de vender, como o plano de corrida: é o seu
produto e a sua assinatura por trás dele.

---

## 6.75 Reajuste mensal como extra pago (R$9,90/mês) ⬜

### O que ficou pago, e o que NÃO ficou

**Pago (R$9,90/mês, assinatura):**
- as fases do treino (Volume, Intensidade, Densidade)
- as sugestões de carga tiradas do histórico dela
- o relatório de virada de mês

**Continua de graça, pra todo mundo:**
- o recálculo de calorias, água, proteína e carboidrato a cada pesagem
- o reajuste das gramagens do cardápio

Essa divisão é de propósito. Quem não assina o extra fica na **fase 1**,
que é exatamente o plano que ela já tinha antes de o reajuste existir:
**ninguém perde nada que já usava.** Tirar de quem não paga algo que já
funcionava é o caminho mais curto pra cancelamento e pedido de
reembolso na assinatura principal, que vale três vezes mais.

### A central de notificações (nova)

Um sininho no cabeçalho da tela inicial, com contador. Tudo que aparece
lá sai de fato registrado nos dados dela:

- **virou o mês / X dias com o mesmo plano** → leva direto ao checkout
- refeições que passaram do horário hoje
- dias sem registrar peso
- resumo de domingo
- semana perfeita fechada

A de oferta é **uma só** e aparece no máximo uma vez por mês. Caixa de
notificação que vira mural de propaganda a pessoa aprende a ignorar em
uma semana — e aí a notificação de verdade também não é lida.

O contador de dias conta a partir do último reajuste **aplicado**, não
do último visto. Quem viu a oferta e recusou continua vendo o número
subir (47 dias, 61 dias), porque o plano dela realmente não mudou.

### O caminho da compra

Igual ao Modo Corrida: o botão leva ao checkout **com o e-mail dela na
URL**, o webhook grava em `acessos_extras`, e na volta o app confere
sozinho 5 vezes a cada 2,5 segundos. Tem o "já paguei" e, se não achar,
abre o suporte.

A diferença é que este **vence**: `acessos_extras` ganhou
`data_expiracao`. Nulo = vitalício (Modo Corrida). Preenchido = precisa
da renovação mensal.

### O que você precisa fazer

- **Criar o produto na Zuptos como ASSINATURA mensal**, com a palavra
  **"reajuste"** no nome. Não como compra única: se for única, a pessoa
  paga R$9,90 uma vez e fica pra sempre.
- **Colar o link em `config.js`**, em `CHECKOUT_URL_REAJUSTE`.
  **Enquanto estiver vazio, o reajuste fica liberado pra todo mundo** —
  é o comportamento de antes, então dá pra publicar o app e ligar a
  cobrança depois.
- **Rodar o `schema.sql` de novo** (ganhou `data_expiracao`).

---

## 6.8 Vídeos de execução dos exercícios ⬜

A estrutura está pronta e vazia, esperando os seus vídeos.

**Onde colar:** `js/videos.js`, no bloco `VIDEOS`. Uma linha por
exercício, com o nome **igual** ao da biblioteca em `js/data.js`:

```js
const VIDEOS = {
  'Agachamento livre': 'https://youtu.be/SEU_ID',
  'Supino reto com barra': 'SEU_ID',
};
```

Aceita link inteiro do YouTube, só o id, link do Vimeo, ou o endereço
de um `.mp4`. Exercício sem vídeo não mostra botão nenhum: nada quebra
e a pessoa não vê buraco.

**Como gravar:** 15 a 30 segundos bastam, dois ou três movimentos
completos, de lado e de frente. São 48 exercícios na biblioteca.

**Onde hospedar: YouTube como "Não listado".** Não aparece na busca nem
no seu canal, mas abre pra quem tem o link — que é o que o app precisa.
Custo zero de banda e o vídeo chega no tamanho certo pra conexão de
cada pessoa.

> **"Privado" não funciona.** Nem embutido o app consegue tocar. Tem que
> ser **Não listado**.

Guardar no Supabase Storage é possível, mas você paga a banda de cada
pessoa que assiste, e todo mundo baixa o arquivo cheio. Pra 48
exercícios vistos várias vezes por dia, a conta cresce rápido.

O player abre só no toque, num pop-up, e usa o domínio
`youtube-nocookie`. Carregar um vídeo embutido em cada exercício da
lista derrubaria a tela e gastaria os dados dela à toa.

---

## 7. Editar o app depois de publicado ✅

Sim, e esta é a melhor parte do formato que a gente escolheu.

O app da Play Store não carrega uma cópia do app dentro dele. Ele
carrega **o site**, o mesmo endereço da Vercel. Então:

- **Mudou texto, preço, cardápio, treino, cor, tela inteira?** Basta o
  push na `main`. A Vercel publica, e na próxima vez que a pessoa abrir
  o app (na Play Store, no iPhone, no navegador) já está lá. **Sem
  passar pela revisão do Google, sem versão nova, sem esperar.**
- **O que exige subir um `.aab` novo na Play Console** é só o que faz
  parte do invólucro Android: nome do app, ícone da loja, cor da tela de
  abertura, permissões, endereço do site. Coisa que você mexe uma vez e
  esquece.
- **O que você edita na Play Console sem tocar em código:** descrição,
  prints, imagem de capa, preço, países.

Um detalhe do service worker (`sw.js`): ele guarda o app no aparelho
pra funcionar sem internet, mas foi escrito como **rede primeiro,
cache como reserva**, justamente porque este app é editado toda semana.
Quem está online sempre pega a última versão. Quem está offline pega a
última que funcionou. Ao mexer no `sw.js`, troque o `VERSAO` no topo.

---

## 8. Publicar na Play Store ⬜

O formato é **TWA** (Trusted Web Activity): um app Android fininho que
abre o seu site em tela cheia, sem barra de navegador. É o que o Google
recomenda pra PWA, e é como o app fica editável pelo push.

### 8.1 O que já está pronto no código ✅

- `sw.js` — o app abre sem internet. Sem isto a Play reprova.
- `manifest.json` — `id`, `scope`, `display`, ícone maskable, cor de
  fundo preta. É daqui que o gerador tira nome, ícone e tema.
- `icone-play-512.png` — ícone 512x512 sem transparência e sem canto
  arredondado, que é exatamente o que a ficha da loja exige.
- `icone-maskable-192/512.png` — versão que não corta a marca quando o
  Android recorta o ícone em círculo ou em gota.
- `.well-known/assetlinks.json` — o arquivo que prova que o app é dono
  do domínio. **Falta colar a impressão digital** (passo 8.4).
- `privacidade.html` — a política de privacidade, que é campo
  obrigatório na Play Console.
- A tela de "falta o pagamento" **esconde preço e link de checkout
  quando o app está rodando pela Play Store** (veja 8.6).

### 8.2 Um domínio próprio, antes de tudo

Dá pra fazer TWA apontando pra `app-emagrecimento-three.vercel.app`,
mas não faça. O endereço vira a identidade do app: trocar depois
significa app novo. Registre algo como `focusfit.com.br`, aponte na
Vercel (Settings → Domains) e use esse endereço em tudo daqui pra frente.

### 8.3 Gerar o `.aab`

O jeito sem instalar nada: **https://www.pwabuilder.com**

1. Cole o endereço do app e clique em Start
2. Package For Stores → **Android** → Generate
3. Em Options confira:
   - **Package ID**: `br.com.focusfit.app` (é o que está no
     `assetlinks.json`; se mudar aqui, mude lá também)
   - **Signing key**: "Create new" — o PWABuilder devolve a chave junto
     com o pacote
4. Baixe o `.zip`: dentro vem o `.aab` e a pasta `signing`

⚠️ **Guarde a pasta `signing` em dois lugares.** Perdeu a chave, perdeu
o direito de atualizar aquele app: a Play não aceita uma chave nova no
mesmo pacote, e você teria que publicar do zero, com outro endereço, e
pedir pra todo mundo reinstalar.

### 8.4 Ligar o app ao domínio (o passo que todo mundo erra)

Sem isto, o app abre com a barra de endereço do Chrome no topo, e aí
não parece app nenhum.

1. Play Console → seu app → **Versão → Configuração → Assinatura de app**
2. Copie a **impressão digital do certificado SHA-256** (do *Play App
   Signing*, não a do upload)
3. Cole no lugar de `COLE_AQUI_...` em `.well-known/assetlinks.json`
4. Commit, push, deploy
5. Confira abrindo `https://seudominio.com.br/.well-known/assetlinks.json`
   no navegador: tem que aparecer o JSON, não uma página de erro

### 8.5 A ficha na Play Console

Separe antes, porque o formulário trava sem:

- **Ícone**: `icone-play-512.png` (já pronto)
- **Imagem de capa**: 1024x500 — ainda não existe, me peça que eu gero
- **Prints**: no mínimo 2, em 16:9 ou 9:16 — eu já sei tirar as telas
- **Descrição curta**: até 80 caracteres
- **Descrição completa**: até 4000
- **Link da privacidade**: `https://seudominio.com.br/privacidade`
- **Classificação indicativa**, **Público-alvo** e **Segurança dos
  dados**: questionários. No de segurança, declare e-mail, nome, dados
  de saúde e peso; **as fotos de progresso não entram**, porque nunca
  saem do aparelho
- **Apps de saúde**: vai aparecer uma declaração extra por o app tratar
  de peso e alimentação. Responda que é material educativo de apoio,
  igual ao rodapé do quiz

### 8.6 A regra do Google que pode derrubar tudo

O Google não deixa um app da Play mandar a pessoa pagar fora da Play.
Um botão de checkout da Zuptos dentro do app é reprovação na certa, e
reincidência derruba a conta.

O caminho permitido é o modelo do Netflix: **quem já assinou entra com
a conta, e o app não fala de preço, nem de link, nem de onde comprar.**
Foi assim que a tela ficou: dentro do app da Play ela mostra só
"Não encontramos sua assinatura", o botão de verificar de novo e o
suporte. No navegador e no iPhone nada mudou, os planos continuam lá.

A venda continua onde sempre esteve: no quiz, no Instagram, no anúncio.
A Play Store é a porta de entrada de quem já comprou.

### 8.7 O teste fechado de 14 dias (planeje o calendário)

Conta de desenvolvedor **pessoal** criada depois de novembro de 2023
precisa, antes de publicar em produção: **12 testadores, aceitos no
teste fechado, por 14 dias seguidos**. Não é fila de revisão, é
carência — e se o número cair no meio, o contador reinicia.

Então junte os 12 (amigos, família, alunas) antes de começar, e conte
com **2 a 3 semanas** entre subir o pacote e o app estar no ar.

Se você registrou a conta como **organização** (com CNPJ), essa regra
não se aplica.

---

## 9. Quem usa iPhone ⬜

A Apple não é o mesmo caminho, e vale saber por quê antes de gastar.

### 9.1 O que já está pronto no código ✅

- `apple-mobile-web-app-capable` e `apple-mobile-web-app-title` — o app
  abre em tela cheia, sem a barra do Safari, com o nome "Focus Fit"
- Barra de status em **preto** (estava clara, cortava o topo do app no
  meio)
- `apple-touch-icon` 180x180 já existia
- A barra de baixo agora respeita o **risquinho do iPhone**
  (`env(safe-area-inset-bottom)`): antes os botões ficavam embaixo dele
- `sw.js` — sem service worker o iPhone nem instala direito nem
  consegue receber aviso um dia

### 9.2 O caminho que funciona hoje: tela de início

No iPhone, quem instala é a pessoa, em 3 toques, e o app fica igual a
qualquer outro no celular dela:

> Abra o link no **Safari** (tem que ser o Safari, não o Chrome) →
> botão de **compartilhar** (o quadrado com a seta pra cima) →
> **Adicionar à Tela de Início** → Adicionar.

Vale colocar isso na mensagem de boas-vindas de quem comprou. Se quiser,
eu faço uma tela dentro do app que detecta iPhone e mostra esse passo a
passo com desenho.

### 9.3 A App Store, se um dia valer a pena

O que custa:

- **US$ 99 por ano**, todo ano (a Play foi US$ 25 uma vez só)
- **Um Mac** com Xcode pra gerar e enviar o pacote
- Revisão humana a cada versão, e a regra **4.2 (Minimum
  Functionality)**: a Apple reprova app que é "só o site embrulhado".
  Pra passar, ele precisa usar coisa do aparelho que o site não usa
- A regra de pagamento é **mais dura** que a do Google: assinatura de
  conteúdo digital tem que passar pela Apple, com 15% a 30%

Minha recomendação: **Play Store agora** (já está pago e o app está
pronto pra isso), **"Adicionar à Tela de Início" no iPhone**, e App
Store só quando o volume de clientes de iPhone justificar os US$ 99 e o
trabalho. Nada do que a gente fez fecha essa porta depois.

### 9.4 Duas limitações honestas do iPhone

- **Aviso com o app fechado** só funciona se a pessoa instalou na tela
  de início (iOS 16.4+), e mesmo assim precisa de um servidor de push,
  que ainda não existe. Hoje o app avisa com ele aberto e mostra o que
  passou quando a pessoa volta.
- **As fotos de progresso ficam no aparelho.** No iPhone, o Safari pode
  limpar o armazenamento de um site que passa semanas sem ser aberto.
  Instalado na tela de início o risco cai bastante, mas não é zero. Se
  isso virar problema, a saída é guardar as fotos no Supabase, e aí elas
  deixam de ser só-do-aparelho: é uma decisão sua, não técnica.

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

- **Lembrete com o app fechado.** Hoje o app avisa só com ele aberto e
  mostra o que passou quando a pessoa volta. O `sw.js` já tem o
  `push`/`notificationclick` escritos e prontos; o que falta é um
  servidor mandando o push com chave VAPID. Publicado na Play Store
  isso passa a valer pro Android instalado, e no iPhone vale pra quem
  adicionou à tela de início (iOS 16.4+).
- **Ícones de traço na barra de navegação já estão feitos**, mas os
  emojis coloridos continuam nos níveis e nos quadros de estatística,
  como nas telas de referência.

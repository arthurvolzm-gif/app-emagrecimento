# Focus Fit · App de Emagrecimento

App web (PWA) de emagrecimento com plano alimentar, treinos, metas diárias,
progresso e sistema de níveis. Sem build, sem npm: é HTML, CSS e JavaScript puro.
Basta subir os arquivos e funciona.

---

## Ligar o banco de dados (fazer uma única vez)

O app já vem apontado para o seu projeto do Supabase. Falta só criar a tabela:

1. Entre no painel do Supabase
2. Menu lateral → **SQL Editor** → **New query**
3. Abra o arquivo `schema.sql` deste repositório, copie **tudo** e cole lá
4. Clique em **Run**

Pronto. A partir daí o login e a sincronização na nuvem funcionam.

> **Importante sobre a chave:** a chave que está em `config.js` é a chave
> *publishable* (pública) — ela foi feita para ficar visível no site. Quem protege
> os dados são as políticas RLS criadas pelo `schema.sql`: cada pessoa só enxerga
> e só altera a própria linha. **Nunca** coloque em `config.js` a senha do banco
> nem a chave `service_role`.

### Confirmar o e-mail dos usuários

Por padrão o Supabase exige confirmação de e-mail no cadastro. Para testar mais
rápido, você pode desligar isso em **Authentication → Providers → Email** →
desmarcar *Confirm email*. Em produção, o recomendado é deixar ligado.

---

## Assinatura paga (Ticto) e ponte quiz → app

O app cobra por assinatura (mensal/trimestral/anual) e usa a **Ticto** como
meio de pagamento. Duas peças cuidam disso:

1. **Controle de pagamento**: o `schema.sql` (rode de novo se já tinha rodado
   antes — ele não duplica nada) criou as tabelas `assinaturas`,
   `ticto_webhook_logs` e `respostas_quiz`. Uma function separada recebe o
   aviso da Ticto a cada compra/renovação/cancelamento e atualiza
   `assinaturas` — o app só libera as telas internas se achar uma linha ativa
   pro e-mail de quem logou. Veja o passo a passo completo em
   `supabase/functions/ticto-webhook/README.md`.

2. **Ponte quiz → cadastro**: quando a pessoa termina o quiz e escolhe um
   plano, as respostas vão tanto pro `localStorage` (funciona se ela continuar
   no mesmo navegador) quanto pro Supabase com um token de uso único, que
   viaja na URL (`?quiz=TOKEN`) — assim o cadastro chega pré-preenchido mesmo
   se ela pagar num navegador diferente do que abriu o quiz (comum em quem
   entra pelo navegador interno do Instagram, por exemplo).

**Links de checkout**: cole os 3 links de produto da Ticto em `config.js`
(`CHECKOUT_URL_MENSAL/TRIMESTRAL/ANUAL`) **e** no topo de `quiz.html`,
`quiz/escuro.html` e `quiz/claro.html` — são arquivos sem import entre si,
então o valor não se propaga sozinho.

---

## Publicar

Igual ao quiz: conecte este repositório na Vercel e publique. Cada `git push`
republica sozinho. Não há passo de build.

Depois de publicado, quem abrir no celular pode tocar em "Adicionar à tela de
início" e o app abre em tela cheia, como um aplicativo.

---

## Como o app está organizado

| Arquivo | O que faz |
|---|---|
| `config.js` | **Nome do app e chaves do Supabase.** É o único arquivo de configuração. |
| `js/data.js` | **Todo o conteúdo:** cardápios, planos de treino, biblioteca de exercícios e níveis. É aqui que você edita alimentos e exercícios. |
| `js/store.js` | Cálculos e dados: meta calórica, pontos, níveis, streak, resumos. |
| `js/backend.js` | Login e sincronização com o Supabase. |
| `js/screens.js` | As telas do app. |
| `js/onboarding.js` | Login, criação de conta e o cadastro de 3 passos. |
| `js/app.js` | Navegação entre telas e as ações (marcar refeição, água, treino...). |
| `css/app.css` | Todo o visual. As cores ficam nas variáveis no topo do arquivo. |
| `schema.sql` | O SQL que cria as tabelas e as regras de segurança no Supabase. |
| `supabase/functions/ticto-webhook/` | Function que recebe o aviso de pagamento da Ticto e libera a assinatura. |

---

## Editar conteúdo (o que você mais vai mexer)

**Trocar alimentos de um cardápio:** abra `js/data.js`, procure
`PLANOS_ALIMENTARES` e edite a refeição desejada. Cada alimento tem nome,
gramas, medida caseira, calorias, proteína e a opção de troca.

As gramagens dos cardápios são **reescaladas automaticamente** para a meta de
calorias de cada pessoa — os valores no arquivo são a base de referência.

**Trocar exercícios de um treino:** no mesmo arquivo, em `PLANOS_TREINO`.
Existem quatro planos: `feminino_academia`, `feminino_casa`,
`masculino_academia` e `masculino_casa`.

**Mudar as cores:** no topo de `css/app.css`, nas variáveis `--verde`,
`--verde-esc` etc.

**Mudar o nome do app:** em `config.js` (`APP_NOME`), no `<title>` do
`index.html` e no `manifest.json`.

---

## Como funcionam as metas

- **Calorias:** fórmula de Mifflin-St Jeor (peso, altura, idade e sexo), com
  fator de atividade e ajuste pelo objetivo — déficit de 20% para emagrecimento,
  superávit de 12% para hipertrofia.
- **Água:** 35 ml por quilo de peso corporal.
- **Proteína:** 2,0 g/kg no emagrecimento, 1,8 g/kg na hipertrofia, 1,6 g/kg na manutenção.
- **Sono:** 8 horas (padrão).

## Sistema de níveis

Pontos por ação: alimento marcado **+3**, refeição completa **+10**, meta de água
**+20**, meta de sono **+20**, treino concluído **+40**, pesagem registrada **+15**.

| Nível | Nome | Pontos |
|---|---|---|
| 1 | Decidido | 0 |
| 2 | Comprometido | 300 |
| 3 | Consistente | 900 |
| 4 | Imparável | 2.200 |
| 5 | Transformado | 4.500 |

Para ajustar, edite `NIVEIS` e `PONTOS` em `js/data.js`.

---

## Modo sem conta

Se o Supabase estiver fora do ar ou as chaves não estiverem preenchidas, o app
continua funcionando 100% no aparelho, salvando no navegador. A pessoa também
pode escolher "Continuar sem conta" na tela de entrada.

---

## Aviso

Material educativo de apoio. Não substitui acompanhamento médico ou
nutricional. Resultados variam de pessoa para pessoa.

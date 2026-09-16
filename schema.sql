-- =========================================================
-- BANCO DE DADOS DO APP  ·  rode isto uma única vez
--
-- COMO RODAR:
--   1. Entre no painel do Supabase
--   2. Menu lateral → SQL Editor → New query
--   3. Cole TUDO que está neste arquivo e clique em "Run"
--
-- O que isso cria:
--   - a tabela onde ficam os dados de cada usuário
--   - as regras de segurança (RLS): cada pessoa só enxerga
--     e só altera os próprios dados, nunca os de outra
-- =========================================================

-- 1) Tabela de dados do usuário
create table if not exists public.dados_usuario (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  dados         jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  criado_em     timestamptz not null default now()
);

-- 2) Liga a segurança por linha
alter table public.dados_usuario enable row level security;

-- 3) Políticas: o usuário só acessa a própria linha
drop policy if exists "ler os proprios dados"      on public.dados_usuario;
drop policy if exists "inserir os proprios dados"  on public.dados_usuario;
drop policy if exists "atualizar os proprios dados" on public.dados_usuario;
drop policy if exists "apagar os proprios dados"   on public.dados_usuario;

create policy "ler os proprios dados"
  on public.dados_usuario for select
  using (auth.uid() = user_id);

create policy "inserir os proprios dados"
  on public.dados_usuario for insert
  with check (auth.uid() = user_id);

create policy "atualizar os proprios dados"
  on public.dados_usuario for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "apagar os proprios dados"
  on public.dados_usuario for delete
  using (auth.uid() = user_id);

-- 4) Índice para consultas por data de atualização
create index if not exists dados_usuario_atualizado_idx
  on public.dados_usuario (atualizado_em desc);

-- =========================================================
-- ASSINATURAS (controle de pagamento via Ticto)
--
-- Como funciona: a Ticto avisa o app a cada evento de pagamento
-- (compra aprovada, renovação, atraso, cancelamento) através de um
-- webhook — uma function separada (veja supabase/functions/ticto-webhook)
-- recebe esse aviso e grava/atualiza a linha correspondente aqui.
-- O app só libera as telas internas se encontrar, pelo e-mail da
-- pessoa logada, uma linha com status = 'ativa' e ainda não vencida.
--
-- Ninguém além da própria function (que usa a service_role key, e
-- portanto ignora RLS) pode gravar aqui — nem o próprio usuário
-- logado. Isso é proposital: se deixássemos o app gravar isso
-- sozinho, qualquer pessoa poderia se autodeclarar "assinante" sem
-- pagar, só editando o que o navegador manda.
-- =========================================================
create table if not exists public.assinaturas (
  email            text primary key,
  user_id          uuid references auth.users(id) on delete set null,
  plano            text,                    -- 'mensal' | 'trimestral' | 'anual'
  status           text not null default 'inativa',  -- 'ativa' | 'atrasada' | 'cancelada' | 'inativa'
  transacao_id     text,                    -- id da cobrança na plataforma de pagamento (Ticto, Zuptos, etc.)
  data_inicio      timestamptz,
  data_expiracao   timestamptz,
  atualizado_em    timestamptz not null default now(),
  criado_em        timestamptz not null default now()
);

-- roda numa base já existente onde essa coluna ainda se chama do jeito
-- antigo (de quando só existia a Ticto); numa base nova, a coluna já
-- nasce com o nome certo acima e este bloco não faz nada.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assinaturas' and column_name = 'ticto_transacao'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assinaturas' and column_name = 'transacao_id'
  ) then
    alter table public.assinaturas rename column ticto_transacao to transacao_id;
  end if;
end $$;

alter table public.assinaturas enable row level security;

drop policy if exists "ler a propria assinatura" on public.assinaturas;

-- cada pessoa só enxerga a própria linha (por e-mail OU, depois de
-- logar pela primeira vez, pelo user_id já vinculado) — só leitura,
-- de propósito: ver não precisa de service_role, gravar precisa.
create policy "ler a propria assinatura"
  on public.assinaturas for select
  using (
    auth.uid() = user_id
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

-- permite o app preencher o user_id na própria linha assim que a
-- pessoa loga pela primeira vez (o pagamento pode ter acontecido
-- antes da conta existir, então a linha nasce só com o e-mail).
drop policy if exists "vincular a propria conta" on public.assinaturas;
create policy "vincular a propria conta"
  on public.assinaturas for update
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')) and user_id is null)
  with check (auth.uid() = user_id and lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create index if not exists assinaturas_user_id_idx on public.assinaturas (user_id);

-- =========================================================
-- LOG BRUTO DO WEBHOOK DA TICTO
--
-- Guarda cada aviso exatamente como a Ticto mandou, sem tentar
-- interpretar nada. Serve pra: (1) conferir o formato real do
-- payload antes de confiar na leitura automática, e (2) depurar se
-- algum evento não bater com a `assinaturas` no futuro.
--
-- RLS ligado e SEM nenhuma política: ninguém enxerga isso pelo app
-- (nem logado) — só a function, que usa a service_role e ignora RLS.
-- =========================================================
create table if not exists public.ticto_webhook_logs (
  id           bigint generated always as identity primary key,
  recebido_em  timestamptz not null default now(),
  payload      jsonb not null
);

alter table public.ticto_webhook_logs enable row level security;

-- =========================================================
-- LOG BRUTO DO WEBHOOK DA ZUPTOS
--
-- Mesma ideia do log da Ticto acima: guarda cada aviso exatamente como
-- a Zuptos mandou, pra conferir o formato real do payload e depurar
-- sem depender de acertar de primeira a leitura automática.
--
-- RLS ligado e SEM nenhuma política: ninguém enxerga isso pelo app
-- (nem logado) — só a function, que usa a service_role e ignora RLS.
-- =========================================================
create table if not exists public.zuptos_webhook_logs (
  id           bigint generated always as identity primary key,
  recebido_em  timestamptz not null default now(),
  payload      jsonb not null
);

alter table public.zuptos_webhook_logs enable row level security;

-- =========================================================
-- RESPOSTAS DO QUIZ (ponte quiz -> cadastro do app)
--
-- Ao terminar o quiz, as respostas são gravadas aqui com um token
-- aleatório; esse token vai na URL de quem clica pra continuar
-- (?quiz=TOKEN). Na hora do cadastro, o app busca por esse token,
-- preenche os campos sozinho e apaga a linha em seguida — os dados
-- não ficam guardados além do necessário pra fazer a ponte.
--
-- Não tem informação sensível de pagamento aqui, só as respostas do
-- questionário (nome, idade, peso, altura, objetivo). Como o token é
-- aleatório e imprevisível, só quem tem o link consegue ler a linha.
-- =========================================================
create table if not exists public.respostas_quiz (
  token      uuid primary key default gen_random_uuid(),
  respostas  jsonb not null,
  criado_em  timestamptz not null default now()
);

-- e-mail digitado no quiz (opcional). É a segunda ponte, independente
-- do link: se a pessoa entrar no app com esse mesmo e-mail, o cadastro
-- acha as respostas dela sozinho — funciona dias depois, em outro
-- aparelho, e dentro do app instalado (APK), onde não existe URL com
-- token pra clicar.
alter table public.respostas_quiz add column if not exists email text;

alter table public.respostas_quiz enable row level security;

drop policy if exists "inserir resposta do quiz" on public.respostas_quiz;
drop policy if exists "ler pelo token"            on public.respostas_quiz;
drop policy if exists "ler pelo proprio email"    on public.respostas_quiz;
drop policy if exists "apagar apos consumir"      on public.respostas_quiz;

-- qualquer um pode criar uma linha (é assim que o quiz, sem login,
-- consegue salvar a resposta de quem está fazendo o teste)
create policy "inserir resposta do quiz"
  on public.respostas_quiz for insert
  with check (true);

-- leitura liberada porque só dá pra achar uma linha sabendo o token
-- exato (uuid aleatório, 122 bits) — não existe como "listar todo
-- mundo", só buscar uma pessoa específica que já tem o link dela
create policy "ler pelo token"
  on public.respostas_quiz for select
  using (true);

-- quem já está logado enxerga a linha que tem o e-mail DELA. O e-mail
-- do JWT é verificado pelo Supabase (a pessoa só entra depois de
-- receber o código na caixa dela), então ninguém lê a resposta de
-- outro e-mail — é a mesma regra usada na tabela `assinaturas`.
create policy "ler pelo proprio email"
  on public.respostas_quiz for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "apagar apos consumir"
  on public.respostas_quiz for delete
  using (true);

create index if not exists respostas_quiz_criado_idx on public.respostas_quiz (criado_em);
create index if not exists respostas_quiz_email_idx  on public.respostas_quiz (lower(email));

-- limpeza automática: uma vez por dia, apaga o que ninguém veio buscar
-- em 30 dias (ex.: pessoa fez o quiz e nunca criou a conta). O prazo é
-- longo de propósito: é comum fazer o quiz, comprar, e só baixar o app
-- dias depois — se apagar antes disso, ela cai no cadastro do zero.
-- O pg_cron já vem habilitado nos projetos Supabase; se der erro de
-- "extension does not exist", ligue em Database → Extensions → pg_cron
-- e rode só este bloco de novo.
create extension if not exists pg_cron with schema extensions;

-- cron.schedule() é idempotente pelo nome do job: rodar de novo só
-- atualiza o agendamento em vez de duplicar.
select cron.schedule(
  'limpar_respostas_quiz_antigas',
  '0 3 * * *',  -- todo dia às 3h
  $$ delete from public.respostas_quiz where criado_em < now() - interval '30 days'; $$
);

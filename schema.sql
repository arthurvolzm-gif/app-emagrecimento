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

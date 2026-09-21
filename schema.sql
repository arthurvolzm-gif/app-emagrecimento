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
-- PLANO DUO (order bump: a pessoa compra e leva outra junto)
--
-- O problema: a plataforma de pagamento só conhece UM e-mail, o de
-- quem pagou. A segunda pessoa tem outro e-mail, que o checkout nunca
-- viu. Então quem cria a vaga da segunda pessoa é o próprio titular,
-- de dentro do app, depois da compra.
--
-- Duas colunas dão conta:
--   vagas          quantas pessoas aquela compra libera (1 normal, 2 no Duo)
--   titular_email  preenchido SÓ na linha da pessoa convidada, apontando
--                  pra linha de quem pagou
--
-- A linha da convidada é uma linha normal de `assinaturas`: o app não
-- precisa saber de nada disso pra liberar o acesso dela, o gate de
-- sempre (status = 'ativa' e não vencida) já funciona.
-- =========================================================
alter table public.assinaturas add column if not exists vagas int not null default 1;
alter table public.assinaturas add column if not exists titular_email text;

-- Vídeos de execução dos exercícios: order bump do checkout do plano.
-- Fica aqui, e não em `acessos_extras`, porque o bump entra na MESMA
-- assinatura: é cobrado junto e cancela junto. Coluna na linha da
-- assinatura é o que representa isso sem inventar validade própria.
alter table public.assinaturas add column if not exists tem_videos boolean not null default false;

-- Receitas + Lista de Compras (e-book): outro order bump na mesma
-- assinatura, mesmo raciocínio do tem_videos acima.
alter table public.assinaturas add column if not exists tem_receitas boolean not null default false;

create index if not exists assinaturas_titular_idx on public.assinaturas (lower(titular_email));

-- ---------------------------------------------------------------------
-- A convidada segue o titular, sempre
--
-- Se o titular cancela, atrasa ou renova, a vaga dela acompanha na mesma
-- hora. Sem isto, quem cancelasse continuaria com a segunda pessoa
-- usando o app de graça pra sempre — e o webhook não tem como saber que
-- existe uma segunda pessoa, porque ela nunca apareceu no pagamento.
--
-- O `when (new.titular_email is null)` evita laço infinito: o trigger só
-- dispara em linha de titular, e o que ele escreve são linhas de
-- convidada, que não disparam de novo.
-- ---------------------------------------------------------------------
create or replace function public.duo_espelhar_titular()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.assinaturas
     set status         = new.status,
         plano          = new.plano,
         data_expiracao = new.data_expiracao,
         -- quem está na vaga do Duo enxerga os vídeos e as receitas que
         -- o titular comprou. Pra separar, é só tirar a linha certa.
         tem_videos     = new.tem_videos,
         tem_receitas   = new.tem_receitas,
         atualizado_em  = now()
   where lower(titular_email) = lower(new.email);
  return new;
end;
$$;

drop trigger if exists assinaturas_espelhar_duo on public.assinaturas;
create trigger assinaturas_espelhar_duo
  after update of status, plano, data_expiracao, tem_videos, tem_receitas on public.assinaturas
  for each row
  when (new.titular_email is null)
  execute function public.duo_espelhar_titular();

-- ---------------------------------------------------------------------
-- Convidar / remover / consultar
--
-- `assinaturas` é fechada pra escrita de propósito: se o app pudesse
-- gravar nela, qualquer um se declarava assinante editando o que o
-- navegador manda. Estas três funções são a única porta, e cada uma
-- confere tudo do lado do banco:
--   - quem chama tem que estar logado (o e-mail vem do JWT, que o
--     Supabase assina — o navegador não consegue forjar);
--   - a assinatura de quem chama tem que estar ativa e ter vaga;
--   - o e-mail convidado não pode já ter assinatura própria (senão dava
--     pra sobrescrever a linha paga de outra pessoa).
-- ---------------------------------------------------------------------
create or replace function public.duo_convidar(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titular  text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_alvo     text := lower(btrim(coalesce(p_email, '')));
  t          public.assinaturas%rowtype;
  ja         public.assinaturas%rowtype;
  usadas     int;
begin
  if v_titular = '' then
    return jsonb_build_object('ok', false, 'erro', 'Entre na sua conta para convidar.');
  end if;
  if v_alvo !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'erro', 'Digite um e-mail válido.');
  end if;
  if v_alvo = v_titular then
    return jsonb_build_object('ok', false, 'erro', 'Esse é o seu próprio e-mail.');
  end if;

  select * into t from public.assinaturas where lower(email) = v_titular;
  if not found or t.status <> 'ativa' then
    return jsonb_build_object('ok', false, 'erro', 'Sua assinatura precisa estar ativa para convidar alguém.');
  end if;
  if t.titular_email is not null then
    return jsonb_build_object('ok', false, 'erro', 'Você entrou pelo convite de outra pessoa, então não tem vaga para convidar.');
  end if;
  if coalesce(t.vagas, 1) < 2 then
    return jsonb_build_object('ok', false, 'erro', 'Seu plano não inclui vaga para uma segunda pessoa.');
  end if;

  select count(*) into usadas from public.assinaturas where lower(titular_email) = v_titular;
  if usadas >= coalesce(t.vagas, 1) - 1 then
    return jsonb_build_object('ok', false, 'erro', 'A vaga do seu plano já está ocupada. Remova quem está nela para convidar outra pessoa.');
  end if;

  select * into ja from public.assinaturas where lower(email) = v_alvo;
  if found and ja.titular_email is null then
    return jsonb_build_object('ok', false, 'erro', 'Esse e-mail já tem uma assinatura própria.');
  end if;
  if found and lower(ja.titular_email) <> v_titular then
    return jsonb_build_object('ok', false, 'erro', 'Esse e-mail já está ocupando a vaga de outro plano.');
  end if;

  insert into public.assinaturas
    (email, plano, status, vagas, titular_email, data_inicio, data_expiracao, atualizado_em)
  values
    (v_alvo, t.plano, t.status, 1, v_titular, coalesce(t.data_inicio, now()), t.data_expiracao, now())
  on conflict (email) do update
    set plano          = excluded.plano,
        status         = excluded.status,
        titular_email  = excluded.titular_email,
        data_expiracao = excluded.data_expiracao,
        atualizado_em  = now();

  return jsonb_build_object('ok', true, 'email', v_alvo);
end;
$$;

create or replace function public.duo_remover(p_email text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titular text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_alvo    text := lower(btrim(coalesce(p_email, '')));
  n         int;
begin
  if v_titular = '' then
    return jsonb_build_object('ok', false, 'erro', 'Entre na sua conta.');
  end if;

  -- só apaga linha de convidada DESTE titular. Uma linha de assinatura
  -- própria (titular_email nulo) nunca é tocada aqui.
  delete from public.assinaturas
   where lower(email) = v_alvo
     and lower(titular_email) = v_titular;
  get diagnostics n = row_count;

  if n = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Essa pessoa não está na vaga do seu plano.');
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- devolve o retrato do plano de quem está logado: quantas vagas tem,
-- quem está usando, e (se for o caso) quem convidou a pessoa.
create or replace function public.duo_estado()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  t       public.assinaturas%rowtype;
  lista   jsonb;
begin
  if v_email = '' then return jsonb_build_object('ok', false); end if;

  select * into t from public.assinaturas where lower(email) = v_email;
  if not found then return jsonb_build_object('ok', true, 'vagas', 1, 'convidados', '[]'::jsonb); end if;

  select coalesce(jsonb_agg(jsonb_build_object('email', email, 'status', status) order by criado_em), '[]'::jsonb)
    into lista
    from public.assinaturas
   where lower(titular_email) = v_email;

  return jsonb_build_object(
    'ok', true,
    'plano', t.plano,
    'status', t.status,
    'vagas', coalesce(t.vagas, 1),
    'titular_email', t.titular_email,
    'convidados', lista
  );
end;
$$;

revoke all on function public.duo_convidar(text) from public;
revoke all on function public.duo_remover(text)  from public;
revoke all on function public.duo_estado()       from public;
-- só quem está logado: o e-mail do JWT é a identidade em que as três confiam
grant execute on function public.duo_convidar(text) to authenticated;
grant execute on function public.duo_remover(text)  to authenticated;
grant execute on function public.duo_estado()       to authenticated;

-- =========================================================
-- ACESSOS EXTRAS (produtos avulsos comprados dentro do app)
--
-- O primeiro é o Modo Corrida. São compras únicas, separadas da
-- assinatura: a pessoa paga uma vez e o acesso não vence junto com o
-- plano mensal dela.
--
-- Por que tabela própria em vez de uma coluna em `assinaturas`:
-- o webhook da Zuptos faz upsert por e-mail em `assinaturas`. Se a
-- compra do Modo Corrida caísse lá, ela sobrescreveria o plano da
-- pessoa (plano viraria "Modo Corrida" e a validade viraria a da
-- compra avulsa) e o acesso ao app inteiro ia junto. Separando, uma
-- compra não encosta na outra.
--
-- Mesma regra de sempre: só a function (service_role) grava. O app
-- apenas lê a própria linha.
-- =========================================================
create table if not exists public.acessos_extras (
  email         text not null,
  produto       text not null,          -- 'corrida' (e o que vier depois)
  status        text not null default 'ativo',  -- 'ativo' | 'cancelado'
  transacao_id  text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (email, produto)
);

alter table public.acessos_extras enable row level security;

drop policy if exists "ler os proprios acessos" on public.acessos_extras;
create policy "ler os proprios acessos"
  on public.acessos_extras for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Extra que é ASSINATURA, não compra única (o reajuste mensal, R$9,90).
-- Nulo = acesso vitalício, que é o caso do Modo Corrida. Preenchido = o
-- app compara com a data de hoje, igual faz com a assinatura principal.
alter table public.acessos_extras add column if not exists data_expiracao timestamptz;

create index if not exists acessos_extras_email_idx on public.acessos_extras (lower(email));

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
drop policy if exists "apagar a propria linha"    on public.respostas_quiz;

-- qualquer um pode criar uma linha (é assim que o quiz, sem login,
-- consegue salvar a resposta de quem está fazendo o teste)
create policy "inserir resposta do quiz"
  on public.respostas_quiz for insert
  with check (true);

-- ⚠️ NÃO existe política de leitura aberta aqui, de propósito.
-- Antes havia uma com `using (true)`, cujo comentário dizia que só dava
-- pra achar uma linha sabendo o token. Isso estava errado: `using (true)`
-- libera QUALQUER select, e a chave publishable do app é pública — então
-- quem a copiasse baixava a tabela inteira, com nome, e-mail e respostas
-- de todo mundo que fez o quiz.
-- A busca por token agora passa pela função abaixo, que devolve UMA linha
-- e só se o token bater exatamente.

-- quem já está logado enxerga a linha que tem o e-mail DELA. O e-mail
-- do JWT é verificado pelo Supabase (a pessoa só entra depois de
-- receber o código na caixa dela), então ninguém lê a resposta de
-- outro e-mail — é a mesma regra usada na tabela `assinaturas`.
create policy "ler pelo proprio email"
  on public.respostas_quiz for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- apagar também não é aberto: quem está logado apaga a linha do próprio
-- e-mail; quem veio pelo link usa a função consumir_resposta_quiz.
create policy "apagar a propria linha"
  on public.respostas_quiz for delete
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ---------------------------------------------------------------------
-- Busca e consumo por token, sem abrir a tabela
--
-- security definer: a função roda com os poderes do dono da tabela, então
-- ela enxerga a linha mesmo com a RLS fechada. O filtro está DENTRO dela
-- e é por igualdade de token (uuid aleatório, 122 bits), então não há
-- como listar ninguém: ou se sabe o token exato, ou não volta nada.
-- search_path fixo evita que alguém troque o significado de "public".
-- ---------------------------------------------------------------------
create or replace function public.buscar_resposta_quiz(p_token uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select respostas from public.respostas_quiz where token = p_token limit 1;
$$;

create or replace function public.consumir_resposta_quiz(p_token uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.respostas_quiz where token = p_token;
$$;

revoke all on function public.buscar_resposta_quiz(uuid)   from public;
revoke all on function public.consumir_resposta_quiz(uuid) from public;
grant execute on function public.buscar_resposta_quiz(uuid)   to anon, authenticated;
grant execute on function public.consumir_resposta_quiz(uuid) to anon, authenticated;

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

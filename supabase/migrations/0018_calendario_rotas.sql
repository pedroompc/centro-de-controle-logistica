-- supabase/migrations/0018_calendario_rotas.sql
-- Calendário de rotas por cidade (porte do monitor-winthor/calendario_rotas.json).
-- Alimenta a classificação de prioridade do relatório "Pedidos a Faturar".
-- Editável sem redeploy: um UPDATE aqui muda a classificação na hora.
create table if not exists public.calendario_rotas (
  id                 bigint generated always as identity primary key,
  cidade             text not null,
  uf                 text,
  regiao_operacional text,   -- METROPOLITANA | AGRESTE | MATA | LITORAL | SERTAO | FORA_PE | ESPECIAL
  rota               text,
  grupo_rota         text,
  dia_saida_rota     text[] not null default '{}',
  dia_limite_pedido  text,
  janela_entrega     text[] not null default '{}',
  aliases            text[] not null default '{}',
  observacao         text,
  updated_at         timestamptz not null default now()
);

create index if not exists idx_calendario_rotas_cidade
  on public.calendario_rotas (cidade);

alter table public.calendario_rotas enable row level security;

-- CREATE POLICY não tem IF NOT EXISTS no Postgres: drop-if-exists antes de cada
-- create deixa a migration re-executável sem erro "policy already exists".
drop policy if exists "read calendario_rotas" on public.calendario_rotas;
create policy "read calendario_rotas" on public.calendario_rotas
  for select to authenticated using (true);

drop policy if exists "write calendario_rotas insert" on public.calendario_rotas;
create policy "write calendario_rotas insert" on public.calendario_rotas
  for insert to authenticated with check (public.is_admin());

drop policy if exists "write calendario_rotas update" on public.calendario_rotas;
create policy "write calendario_rotas update" on public.calendario_rotas
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "write calendario_rotas delete" on public.calendario_rotas;
create policy "write calendario_rotas delete" on public.calendario_rotas
  for delete to authenticated using (public.is_admin());

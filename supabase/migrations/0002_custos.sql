create type custo_tipo as enum ('fixo', 'variavel');

create table custos_fixos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor numeric(10,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table custos_mensais (
  id uuid primary key default gen_random_uuid(),
  mes date not null,
  nome text not null,
  tipo custo_tipo not null,
  valor numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index custos_mensais_mes_idx on custos_mensais(mes);

alter table custos_fixos enable row level security;
alter table custos_mensais enable row level security;

create policy "auth full access custos_fixos" on custos_fixos
  for all to authenticated using (true) with check (true);
create policy "auth full access custos_mensais" on custos_mensais
  for all to authenticated using (true) with check (true);

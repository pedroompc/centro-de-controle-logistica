-- Enums
create type status_funcionario as enum ('ativo', 'afastado', 'desligado');
create type tipo_falta as enum ('justificada', 'injustificada', 'atestado', 'folga', 'ferias');

-- Setores
create table setores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  created_at timestamptz not null default now()
);

-- Funcionários
create table funcionarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text not null,
  setor_id uuid not null references setores(id) on delete restrict,
  custo_mensal numeric(10,2) not null default 0,
  data_admissao date not null,
  status status_funcionario not null default 'ativo',
  created_at timestamptz not null default now()
);
create index funcionarios_setor_id_idx on funcionarios(setor_id);

-- Faltas
create table faltas (
  id uuid primary key default gen_random_uuid(),
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  data date not null,
  tipo tipo_falta not null,
  observacao text,
  created_at timestamptz not null default now()
);
create index faltas_funcionario_id_idx on faltas(funcionario_id);
create index faltas_data_idx on faltas(data);

-- RLS: nesta fase todo usuário autenticado tem acesso total.
alter table setores enable row level security;
alter table funcionarios enable row level security;
alter table faltas enable row level security;

create policy "auth full access setores" on setores
  for all to authenticated using (true) with check (true);
create policy "auth full access funcionarios" on funcionarios
  for all to authenticated using (true) with check (true);
create policy "auth full access faltas" on faltas
  for all to authenticated using (true) with check (true);

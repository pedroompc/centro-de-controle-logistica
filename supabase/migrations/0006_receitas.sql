-- Receitas logísticas: serviços de descarregamento cobrados de fornecedores.
-- Preço/tonelada é GLOBAL por tipo (batido/paletizado). Cada lançamento congela
-- o preço aplicado e a receita calculada (snapshot imutável).

create type descarregamento_tipo as enum ('batido', 'paletizado');

-- Cadastro de fornecedores (padrão de `setores`).
create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Preço/tonelada GLOBAL por tipo. Exatamente 2 linhas (batido, paletizado).
create table precos_descarregamento (
  tipo descarregamento_tipo primary key,
  preco_por_tonelada numeric(14,2) not null default 0,
  atualizado_em timestamptz not null default now()
);
insert into precos_descarregamento (tipo, preco_por_tonelada)
  values ('batido', 0), ('paletizado', 0);

-- Lançamentos de receita de descarregamento.
create table receitas_descarregamento (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  fornecedor_id uuid not null references fornecedores(id),
  peso_kg numeric(14,3) not null default 0,       -- canônico em kg (toneladas = peso_kg/1000)
  tipo descarregamento_tipo not null,
  preco_por_tonelada numeric(14,2) not null,       -- SNAPSHOT do preço aplicado
  receita numeric(14,2) not null,                  -- SNAPSHOT: round(peso_kg/1000 * preco, 2)
  observacao text,
  created_at timestamptz not null default now()
);
create index receitas_desc_data_idx on receitas_descarregamento(data);
create index receitas_desc_fornecedor_idx on receitas_descarregamento(fornecedor_id);

alter table fornecedores enable row level security;
alter table precos_descarregamento enable row level security;
alter table receitas_descarregamento enable row level security;

-- RLS: leitura para logado, escrita só admin (padrão do projeto).
create policy "read fornecedores" on fornecedores for select to authenticated using (true);
create policy "write fornecedores" on fornecedores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "read precos_descarregamento" on precos_descarregamento for select to authenticated using (true);
create policy "write precos_descarregamento" on precos_descarregamento for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "read receitas_descarregamento" on receitas_descarregamento for select to authenticated using (true);
create policy "write receitas_descarregamento" on receitas_descarregamento for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

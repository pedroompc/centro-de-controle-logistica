-- Receitas que não vêm de descarregamento. A primeira é a venda de material de
-- reciclagem (o plástico que sobra dos filmes stretch da paletização).
--
-- `valor` é a fonte da verdade: é o dinheiro que entrou. `quantidade` e
-- `preco_unitario` são o memorial de como se chegou nele e PODEM divergir do
-- produto exato (arredondamento de conversa, desconto, ajuste na balança).
--
-- Extensão futura: adicionar um tipo de receita custa um
-- `alter type receita_categoria add value 'x'`, sem tabela nem página nova.

create type receita_categoria as enum ('reciclagem');

create table receitas_diversas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  categoria receita_categoria not null,
  material text,                  -- livre: "Plástico stretch"
  quantidade numeric(14,3),       -- nullable: nem toda receita é por quantidade
  unidade text not null default 'kg',
  preco_unitario numeric(14,2),   -- nullable, pelo mesmo motivo
  valor numeric(14,2) not null,
  observacao text,
  created_at timestamptz not null default now()
);

create index receitas_div_data_idx on receitas_diversas(data);

alter table receitas_diversas enable row level security;

-- RLS no padrão do projeto: leitura para logado, escrita só admin.
create policy "read receitas_diversas" on receitas_diversas
  for select to authenticated using (true);
create policy "write receitas_diversas" on receitas_diversas
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

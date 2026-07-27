-- Lançamento agregado de um dia de descarregamento: em vez de N linhas por
-- fornecedor em receitas_descarregamento, uma linha com o resultado do dia.
-- A assistente digita o total no fim do dia (nº de descarregos, peso e valor).
--
-- Tabela irmã de receitas_descarregamento, não extensão dela: um total do dia
-- não tem fornecedor, tipo, preço/ton nem mínimo — nenhum se aplica a um
-- agregado. `receita` é o valor final digitado, sem cálculo de piso.

create table receitas_descarregamento_diario (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  descarregos int not null check (descarregos > 0),
  peso_kg numeric(14,3) not null check (peso_kg >= 0),
  receita numeric(12,2) not null check (receita >= 0),
  observacao text,
  created_at timestamptz not null default now()
);

create index receitas_desc_diario_data_idx on receitas_descarregamento_diario(data);

alter table receitas_descarregamento_diario enable row level security;

-- RLS no padrão do projeto: leitura para logado, escrita só admin.
create policy "read receitas_descarregamento_diario" on receitas_descarregamento_diario
  for select to authenticated using (true);
create policy "write receitas_descarregamento_diario" on receitas_descarregamento_diario
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Snapshot de fechamento mensal dos dados NATIVOS do Supabase (custo fixo,
-- custo variável, receita de descarregamento e faltas). Diferente de
-- `faturamento_mensal`, que congela os números do Winthor: aqui a fonte é o
-- próprio Supabase, então a foto é um CACHE de performance — evita reagregar
-- custos_mensais + receitas (3 tabelas) + faltas toda vez que se abre um mês
-- antigo no dashboard.
--
-- Uma linha por mês fechado. Populado sob demanda (lazy backfill) quando alguém
-- abre o dashboard de um mês fechado sem foto. Como a fonte é editável e
-- lançamentos entram com atraso (correção de mês anterior), a foto NÃO é
-- imutável: as server actions de escrita apagam a foto do mês afetado
-- (invalidação no ponto de escrita) e o próximo acesso recalcula. Ver
-- src/data/fechamento-cache.ts e o design em docs/.../fechamento-snapshot-design.md.
--
-- `custo_efetivo` de propósito NÃO entra aqui: é derivado do efetivo ATUAL
-- (funcionários ativos hoje), continua sendo lido ao vivo e é barato.

create table fechamento_mensal (
  mes date primary key,
  custo_fixo numeric(14,2) not null default 0,
  custo_variavel numeric(14,2) not null default 0,
  receita_total numeric(14,2) not null default 0,
  faltas int not null default 0,
  criado_em timestamptz not null default now()
);

alter table fechamento_mensal enable row level security;

-- É cache derivado do sistema, idempotente por `mes` e reproduzível a partir das
-- tabelas de origem — por isso toda a manutenção (backfill na leitura, recálculo,
-- invalidação na escrita) é liberada ao autenticado. A escrita de DADOS DE
-- NEGÓCIO segue protegida: as tabelas de origem (custos_mensais, receitas_*,
-- faltas) continuam admin-only, e as server actions chamam assertAdmin.
create policy "read fechamento_mensal" on fechamento_mensal
  for select to authenticated using (true);
create policy "insert fechamento_mensal" on fechamento_mensal
  for insert to authenticated with check (true);
create policy "update fechamento_mensal" on fechamento_mensal
  for update to authenticated using (true) with check (true);
create policy "delete fechamento_mensal" on fechamento_mensal
  for delete to authenticated using (true);

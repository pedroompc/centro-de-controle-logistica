-- Snapshot mensal do faturamento (rotina 111): congela os totais de cada mês
-- fechado. Populado sob demanda (lazy backfill) quando alguém abre Tendências.
-- Uma linha por mês/filial; foto congelada, nunca reescrita.
create table faturamento_mensal (
  mes date not null,
  filial text not null default '1',
  venda_faturada numeric(14,2) not null default 0,
  venda_liquida numeric(14,2) not null default 0,
  valor_devolucao numeric(14,2) not null default 0,
  valor_devolucao_avulsa numeric(14,2) not null default 0,
  devolvidas int not null default 0,
  devolvidas_avulsas int not null default 0,
  peso_faturado numeric(14,2) not null default 0,
  peso_devolucao numeric(14,2) not null default 0,
  emitidas int not null default 0,
  positivados int not null default 0,
  criado_em timestamptz not null default now(),
  primary key (mes, filial)
);

alter table faturamento_mensal enable row level security;

-- Leitura para qualquer logado.
create policy "read faturamento_mensal" on faturamento_mensal
  for select to authenticated using (true);

-- INSERT liberado ao logado: a foto é cache derivado gerado pelo sistema
-- (lazy backfill grava quando qualquer usuário abre a aba). Idempotente pela PK.
create policy "insert faturamento_mensal" on faturamento_mensal
  for insert to authenticated with check (true);

-- UPDATE/DELETE só admin (foto congelada; correção manual é exceção).
create policy "update faturamento_mensal" on faturamento_mensal
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "delete faturamento_mensal" on faturamento_mensal
  for delete to authenticated using (public.is_admin());

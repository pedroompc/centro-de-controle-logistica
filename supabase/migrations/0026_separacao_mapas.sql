-- Quem separou cada mapa de separação. Sem coletor, o Harpia não sabe quem
-- separou; o líder/conferente informa no app (nº do mapa + separador). O BI da
-- Separação cruza com a conferência do Harpia pelo nº do mapa
-- (SEQ_PLANILHA) e dá produção e erros POR SEPARADOR.
--
-- Um mapa pode ter mais de um separador (a produção do mapa é dividida).
-- Aditiva e idempotente.
create table if not exists separacao_mapas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  mapa text not null,
  funcionario_id uuid not null references funcionarios(id) on delete cascade,
  registrado_por uuid default auth.uid(),
  criado_em timestamptz not null default now(),
  unique (mapa, funcionario_id)
);

create index if not exists separacao_mapas_data_idx on separacao_mapas(data);

alter table separacao_mapas enable row level security;

-- Quem usa o app (líder, conferente) registra e corrige; não é só admin.
drop policy if exists "read separacao_mapas" on separacao_mapas;
create policy "read separacao_mapas" on separacao_mapas for select to authenticated using (true);
drop policy if exists "insert separacao_mapas" on separacao_mapas;
create policy "insert separacao_mapas" on separacao_mapas for insert to authenticated with check (true);
drop policy if exists "delete separacao_mapas" on separacao_mapas;
create policy "delete separacao_mapas" on separacao_mapas for delete to authenticated using (true);

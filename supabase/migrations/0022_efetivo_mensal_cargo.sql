-- Foto mensal do efetivo do RECEBIMENTO por grupo de cargo (ajudante,
-- conferente, outros). Dá o "kg por ajudante" e "carros por conferente" de cada
-- mês com a equipe REAL daquele mês — a foto por setor (efetivo_mensal_setor)
-- não separa cargo, e o cadastro não guarda o passado.
--
-- Sem histórico anterior: só existe a partir do mês em que o Painel da Operação
-- abrir pela primeira vez depois desta migração. Antes disso o painel usa a
-- equipe de hoje e marca o número como estimativa.
--
-- Cache derivado do cadastro vivo, gravado no render (upsert do mês corrente) —
-- mesmo padrão de RLS do efetivo_mensal_setor.
create table if not exists efetivo_mensal_cargo (
  mes date not null,
  filial text not null default '1',
  setor text not null,
  grupo text not null check (grupo in ('ajudante', 'conferente', 'outros')),
  ativos int not null default 0,
  custo_ativos numeric(14,2) not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (mes, filial, setor, grupo)
);

alter table efetivo_mensal_cargo enable row level security;

drop policy if exists "read efetivo_mensal_cargo" on efetivo_mensal_cargo;
create policy "read efetivo_mensal_cargo" on efetivo_mensal_cargo
  for select to authenticated using (true);
drop policy if exists "insert efetivo_mensal_cargo" on efetivo_mensal_cargo;
create policy "insert efetivo_mensal_cargo" on efetivo_mensal_cargo
  for insert to authenticated with check (true);
drop policy if exists "update efetivo_mensal_cargo" on efetivo_mensal_cargo;
create policy "update efetivo_mensal_cargo" on efetivo_mensal_cargo
  for update to authenticated using (true) with check (true);
drop policy if exists "delete efetivo_mensal_cargo" on efetivo_mensal_cargo;
create policy "delete efetivo_mensal_cargo" on efetivo_mensal_cargo
  for delete to authenticated using (public.is_admin());

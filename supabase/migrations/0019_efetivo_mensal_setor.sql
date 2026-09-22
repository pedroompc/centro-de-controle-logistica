-- Foto mensal do efetivo POR SETOR — dá origem à curva de headcount/folha que o
-- cadastro não guarda. O cadastro de funcionários não registra desligamento com
-- data (quem sai é removido), então o passado só existe se for fotografado.
--
-- Fonte:
--   • julho/2026 e agosto/2026 vêm semeados das fotos manuais que já existiam no
--     banco (_baseline_efetivo = julho, _snapshot_efetivo = agosto), com o custo
--     REAL de cada época;
--   • a partir do mês corrente, o sistema grava/atualiza a foto sozinho a cada
--     abertura do Dashboard (upsert do mês corrente por setor).
--
-- Cache derivado do cadastro vivo — por isso INSERT/UPDATE ficam liberados ao
-- usuário logado (self-heal no render, como no faturamento_mensal). A chave é o
-- NOME do setor, para casar com as fotos históricas (que só têm o nome).
create table efetivo_mensal_setor (
  mes date not null,
  filial text not null default '1',
  setor text not null,
  ativos int not null default 0,
  afastados int not null default 0,
  desligados int not null default 0,
  custo_ativos numeric(14,2) not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (mes, filial, setor)
);

alter table efetivo_mensal_setor enable row level security;

create policy "read efetivo_mensal_setor" on efetivo_mensal_setor
  for select to authenticated using (true);
create policy "insert efetivo_mensal_setor" on efetivo_mensal_setor
  for insert to authenticated with check (true);
create policy "update efetivo_mensal_setor" on efetivo_mensal_setor
  for update to authenticated using (true) with check (true);
create policy "delete efetivo_mensal_setor" on efetivo_mensal_setor
  for delete to authenticated using (public.is_admin());

-- Seed histórico das fotos manuais, se existirem (banco de produção). Guardado
-- por to_regclass para não quebrar num banco novo que não tem as tabelas de
-- staging. Idempotente: on conflict do nothing.
do $$
begin
  if to_regclass('public._baseline_efetivo') is not null then
    insert into efetivo_mensal_setor (mes, filial, setor, ativos, afastados, desligados, custo_ativos)
    select date '2026-07-01', '1', setor,
           coalesce(ativos, 0), coalesce(afastados, 0), coalesce(desligados, 0), coalesce(custo_ativos, 0)
    from _baseline_efetivo
    where setor is not null
    on conflict (mes, filial, setor) do nothing;
  end if;

  if to_regclass('public._snapshot_efetivo') is not null then
    insert into efetivo_mensal_setor (mes, filial, setor, ativos, afastados, desligados, custo_ativos)
    select date '2026-08-01', '1', setor,
           coalesce(ativos, 0), coalesce(afastados, 0), coalesce(desligados, 0), coalesce(custo_ativos, 0)
    from _snapshot_efetivo
    where setor is not null
    on conflict (mes, filial, setor) do nothing;
  end if;
end $$;

-- Foto mensal do efetivo — dá origem à curva de headcount/folha que o cadastro
-- de funcionários não guarda (não há data de desligamento, então o passado não
-- é reconstruível). A partir daqui, cada vez que alguém abre a aba Efetivos o
-- sistema grava/atualiza a foto do MÊS CORRENTE (upsert): ao virar o mês, a
-- linha do mês anterior fica congelada com o último estado conhecido.
--
-- É cache derivado do cadastro vivo — por isso INSERT e UPDATE ficam liberados
-- ao usuário logado (o self-heal roda no render, como no faturamento_mensal).
create table efetivo_mensal (
  mes date not null,
  filial text not null default '1',
  ativos int not null default 0,
  afastados int not null default 0,
  folha_total numeric(14,2) not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (mes, filial)
);

alter table efetivo_mensal enable row level security;

-- Leitura para qualquer logado.
create policy "read efetivo_mensal" on efetivo_mensal
  for select to authenticated using (true);

-- INSERT/UPDATE liberados ao logado: a foto é derivada do cadastro e se
-- atualiza sozinha no mês corrente (upsert idempotente pela PK).
create policy "insert efetivo_mensal" on efetivo_mensal
  for insert to authenticated with check (true);
create policy "update efetivo_mensal" on efetivo_mensal
  for update to authenticated using (true) with check (true);

-- DELETE só admin (correção manual é exceção).
create policy "delete efetivo_mensal" on efetivo_mensal
  for delete to authenticated using (public.is_admin());

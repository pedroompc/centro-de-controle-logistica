-- Telemetria da frota (Fulltrack / Siga+): hodômetro por placa e dia.
--
-- O coletor (scripts/coletor-frota) grava, a cada 10 min, a última posição de
-- cada rastreador e, a cada 6 h, completa o histórico em janelas de 15 dias
-- (limite da API). Por dia fica só a menor e a maior leitura do hodômetro: o km
-- do dia é a diferença (o app descarta dia negativo ou acima de 1.500 km).
-- Rastreador que não manda hodômetro tem o km do dia somado pelo GPS (km_gps),
-- usado só quando não há leitura de hodômetro naquele dia.
--
-- Placa sem hífen e em maiúsculas (igual ao Winthor sem pontuação).
-- Aditiva e idempotente. Só o coletor grava (chave de serviço, ignora RLS).

create table if not exists frota_hodometro_diario (
  placa text not null,
  dia date not null,
  hodometro_min_m bigint,
  hodometro_max_m bigint,
  primeira_leitura timestamptz,
  ultima_leitura timestamptz,
  leituras int not null default 0,
  km_gps numeric(10, 2),
  atualizado_em timestamptz not null default now(),
  primary key (placa, dia)
);

create index if not exists frota_hodometro_diario_dia on frota_hodometro_diario (dia);

-- Janelas de histórico já baixadas (as encerradas não são baixadas de novo).
create table if not exists frota_historico_janelas (
  veiculo_id text not null,
  inicio date not null,
  baixada_em timestamptz not null default now(),
  primary key (veiculo_id, inicio)
);

alter table frota_hodometro_diario enable row level security;
alter table frota_historico_janelas enable row level security;

drop policy if exists "read frota_hodometro_diario" on frota_hodometro_diario;
create policy "read frota_hodometro_diario" on frota_hodometro_diario
  for select to authenticated using (true);
drop policy if exists "read frota_historico_janelas" on frota_historico_janelas;
create policy "read frota_historico_janelas" on frota_historico_janelas
  for select to authenticated using (true);

-- Junta leituras novas com as do dia: menor/maior hodômetro, primeira/última
-- leitura e soma da contagem. `leituras` = jsonb [{placa, dia, hodometro_m, momento}].
create or replace function frota_registrar_hodometro(leituras jsonb)
returns int
language sql
as $$
  with l as (
    select upper(regexp_replace(x->>'placa', '[^A-Za-z0-9]', '', 'g')) placa,
           (x->>'dia')::date dia,
           (x->>'hodometro_m')::bigint m,
           (x->>'momento')::timestamptz momento
    from jsonb_array_elements(leituras) x
    where (x->>'hodometro_m')::bigint > 0
  ),
  agg as (
    select placa, dia, min(m) mn, max(m) mx, min(momento) pri, max(momento) ult, count(*)::int n
    from l group by placa, dia
  ),
  ins as (
    insert into frota_hodometro_diario as f
      (placa, dia, hodometro_min_m, hodometro_max_m, primeira_leitura, ultima_leitura, leituras)
    select placa, dia, mn, mx, pri, ult, n from agg
    on conflict (placa, dia) do update set
      hodometro_min_m = least(coalesce(f.hodometro_min_m, excluded.hodometro_min_m), excluded.hodometro_min_m),
      hodometro_max_m = greatest(coalesce(f.hodometro_max_m, excluded.hodometro_max_m), excluded.hodometro_max_m),
      primeira_leitura = least(coalesce(f.primeira_leitura, excluded.primeira_leitura), excluded.primeira_leitura),
      ultima_leitura = greatest(coalesce(f.ultima_leitura, excluded.ultima_leitura), excluded.ultima_leitura),
      leituras = f.leituras + excluded.leituras,
      atualizado_em = now()
    returning 1
  )
  select count(*)::int from ins;
$$;

-- km do dia pelo GPS: o dia é sempre recalculado inteiro, então substitui.
-- `km` = jsonb [{placa, dia, km}].
create or replace function frota_registrar_km_gps(km jsonb)
returns int
language sql
as $$
  with ins as (
    insert into frota_hodometro_diario as f (placa, dia, km_gps)
    select upper(regexp_replace(x->>'placa', '[^A-Za-z0-9]', '', 'g')), (x->>'dia')::date, (x->>'km')::numeric
    from jsonb_array_elements(km) x
    on conflict (placa, dia) do update set km_gps = excluded.km_gps, atualizado_em = now()
    returning 1
  )
  select count(*)::int from ins;
$$;

revoke all on function frota_registrar_hodometro(jsonb) from public, anon, authenticated;
revoke all on function frota_registrar_km_gps(jsonb) from public, anon, authenticated;
grant execute on function frota_registrar_hodometro(jsonb) to service_role;
grant execute on function frota_registrar_km_gps(jsonb) to service_role;

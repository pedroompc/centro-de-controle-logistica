-- Custo ESTIMADO da frota (Custos › Frota): consumo por modelo (km/L), placa → modelo
-- e parâmetros (preço do diesel, desgaste e manutenção mensais da frota). O BI dos
-- Motoristas cruza com o km real da telemetria (0027): diesel = km ÷ km/L × preço.
--
-- Valores iniciais = planilha da frota e relatório da oficina da plataforma antiga
-- (km/L de computador de bordo / guias de frota / ficha técnica). Tudo editável.
-- Leitura para logado, escrita só admin. Idempotente.

create table if not exists frota_consumo_modelos (
  modelo text primary key,
  km_por_litro numeric(5,2) not null check (km_por_litro > 0),
  atualizado_em timestamptz not null default now()
);

create table if not exists frota_veiculos (
  placa text primary key check (placa = upper(regexp_replace(placa, '[^A-Za-z0-9]', '', 'g'))),
  modelo text not null references frota_consumo_modelos(modelo) on update cascade,
  tipo text not null default 'Três quarto',
  ativo boolean not null default true,
  atualizado_em timestamptz not null default now()
);

create table if not exists frota_parametros (
  id int primary key default 1 check (id = 1),
  preco_diesel numeric(8,3) not null check (preco_diesel >= 0),
  desgaste_mensal numeric(12,2) not null default 0 check (desgaste_mensal >= 0),
  manutencao_mensal numeric(12,2) not null default 0 check (manutencao_mensal >= 0),
  atualizado_em timestamptz not null default now()
);

alter table frota_consumo_modelos enable row level security;
alter table frota_veiculos enable row level security;
alter table frota_parametros enable row level security;

drop policy if exists "read frota_consumo_modelos" on frota_consumo_modelos;
create policy "read frota_consumo_modelos" on frota_consumo_modelos for select to authenticated using (true);
drop policy if exists "write frota_consumo_modelos" on frota_consumo_modelos;
create policy "write frota_consumo_modelos" on frota_consumo_modelos for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read frota_veiculos" on frota_veiculos;
create policy "read frota_veiculos" on frota_veiculos for select to authenticated using (true);
drop policy if exists "write frota_veiculos" on frota_veiculos;
create policy "write frota_veiculos" on frota_veiculos for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read frota_parametros" on frota_parametros;
create policy "read frota_parametros" on frota_parametros for select to authenticated using (true);
drop policy if exists "write frota_parametros" on frota_parametros;
create policy "write frota_parametros" on frota_parametros for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into frota_parametros (id, preco_diesel, desgaste_mensal, manutencao_mensal)
values (1, 7.05, 18044.47, 45758.82) on conflict (id) do nothing;

insert into frota_consumo_modelos (modelo, km_por_litro) values
  ('KIA BONGO', 8.0),
  ('8.160', 6.1),
  ('9.170', 6.1),
  ('10.160', 5.5),
  ('11.180', 5.1),
  ('13.190', 4.2),
  ('14.210', 4.0),
  ('17.210', 3.8),
  ('17.230', 3.8),
  ('23.230', 3.0),
  ('24.280', 3.0)
on conflict (modelo) do nothing;

insert into frota_veiculos (placa, modelo, tipo) values
  ('OYM2287', '8.160', 'Três quarto'),
  ('OYM2447', '8.160', 'Três quarto'),
  ('OYM2377', '13.190', 'Toco'),
  ('PDO8543', '13.190', 'Toco'),
  ('PDO8523', '13.190', 'Toco'),
  ('PDL9925', '17.230', 'Toco'),
  ('PDD2245', '23.230', 'Truck'),
  ('PED6443', '11.180', 'Três quarto'),
  ('PED6433', '9.170', 'Três quarto'),
  ('PDQ8095', '11.180', 'Três quarto'),
  ('PDQ7965', '11.180', 'Três quarto'),
  ('PCW3431', '10.160', 'Três quarto'),
  ('PCW2841', '10.160', 'Três quarto'),
  ('PCW3081', '10.160', 'Três quarto'),
  ('PCW2951', '10.160', 'Três quarto'),
  ('QYM8G54', '17.230', 'Toco'),
  ('QYM8I34', '17.230', 'Toco'),
  ('QYL3E12', '17.230', 'Toco'),
  ('QYL3H52', '17.230', 'Toco'),
  ('QYD7253', '24.280', 'Truck'),
  ('QYD7153', '24.280', 'Truck'),
  ('RZF6A21', '9.170', 'Três quarto'),
  ('RZF3E49', '9.170', 'Três quarto'),
  ('RZF3F39', '9.170', 'Três quarto'),
  ('RZF3F29', '9.170', 'Três quarto'),
  ('RZG0J21', '11.180', 'Três quarto'),
  ('RZI1C83', '11.180', 'Três quarto'),
  ('RZH8C13', '11.180', 'Três quarto'),
  ('RZI1B33', '11.180', 'Três quarto'),
  ('RZI1D53', '11.180', 'Três quarto'),
  ('RZI0E03', '11.180', 'Três quarto'),
  ('RZX8D59', '9.170', 'Três quarto'),
  ('SNK6J14', '14.210', 'Toco'),
  ('SNK6I54', '14.210', 'Toco'),
  ('SNK6H94', '14.210', 'Toco'),
  ('SOR5J44', '11.180', 'Três quarto'),
  ('SOR5I94', '11.180', 'Três quarto'),
  ('UHS7A67', '11.180', 'Três quarto'),
  ('UHV3D54', '11.180', 'Três quarto'),
  ('UHV0A01', '11.180', 'Três quarto'),
  ('UHS6B79', '17.210', 'Toco'),
  ('UIA9H94', 'KIA BONGO', 'Kia Bongo'),
  ('UIA4E84', 'KIA BONGO', 'Kia Bongo'),
  ('UIA4G84', 'KIA BONGO', 'Kia Bongo'),
  ('UHZ7E66', 'KIA BONGO', 'Kia Bongo'),
  ('UHZ7F16', 'KIA BONGO', 'Kia Bongo'),
  ('UHZ7F56', 'KIA BONGO', 'Kia Bongo')
on conflict (placa) do nothing;

-- Quantidade REAL de carros descarregados por dia, quando o descarrego foi
-- lançado por fornecedor.
--
-- O lançamento por fornecedor é por NOTA FISCAL, e um caminhão costuma trazer
-- várias notas ("NFE-S NO MESMO CARRO"). Contar 1 lançamento = 1 carro inflava
-- os carros do mês (julho/2026: 227 notas para 152 carros). Esta tabela guarda a
-- contagem de carros do dia, por tipo, digitada à parte; valor e peso continuam
-- vindo dos lançamentos, que estão certos.
--
-- Sem linha para o dia = o app segue contando 1 lançamento como 1 carro.
-- `qtd_volume` = carros que vieram SÓ com carga de volume (as caixas continuam
-- vindo da quantidade dos lançamentos).
create table if not exists descarregos_carros_dia (
  data date primary key,
  qtd_batido     int not null default 0 check (qtd_batido >= 0),
  qtd_paletizado int not null default 0 check (qtd_paletizado >= 0),
  qtd_pal_rem    int not null default 0 check (qtd_pal_rem >= 0),
  qtd_volume     int not null default 0 check (qtd_volume >= 0),
  atualizado_em timestamptz not null default now()
);

alter table descarregos_carros_dia enable row level security;

-- RLS no padrão do projeto: leitura para logado, escrita só admin.
drop policy if exists "read descarregos_carros_dia" on descarregos_carros_dia;
create policy "read descarregos_carros_dia" on descarregos_carros_dia
  for select to authenticated using (true);
drop policy if exists "write descarregos_carros_dia" on descarregos_carros_dia;
create policy "write descarregos_carros_dia" on descarregos_carros_dia
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

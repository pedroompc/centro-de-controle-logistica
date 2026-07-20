-- Pal/Rem (Paletizado Remanejado): carga que chega paletizada mas precisa ser
-- rebatida (mesa/altura) ou conferida por avaria. Preço/ton próprio.
-- E valor mínimo global cobrado por descarregamento (R$ 25,00 por padrão).
--
-- Aditiva e idempotente: pode ser reexecutada com segurança, sem duplicar
-- dados nem falhar (requer a 0006 já aplicada, pois referencia
-- descarregamento_tipo e precos_descarregamento).

-- ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação que insere
-- usando o valor novo. Daí o commit explícito antes do INSERT abaixo.
alter type descarregamento_tipo add value if not exists 'pal_rem';
commit;

insert into precos_descarregamento (tipo, preco_por_tonelada)
  values ('pal_rem', 0)
  on conflict (tipo) do nothing;

-- Configuração global. O check no PK garante no máximo uma linha.
create table if not exists config_descarregamento (
  id boolean primary key default true check (id),
  valor_minimo numeric(14,2) not null default 25,
  atualizado_em timestamptz not null default now()
);
insert into config_descarregamento (id) values (true) on conflict (id) do nothing;

alter table config_descarregamento enable row level security;

drop policy if exists "read config_descarregamento" on config_descarregamento;
create policy "read config_descarregamento" on config_descarregamento
  for select to authenticated using (true);

drop policy if exists "write config_descarregamento" on config_descarregamento;
create policy "write config_descarregamento" on config_descarregamento
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Snapshot do mínimo vigente no momento do lançamento, igual ao snapshot de
-- preco_por_tonelada. Lançamentos anteriores ficam com 0 (sem recálculo retroativo).
alter table receitas_descarregamento
  add column if not exists minimo_aplicado numeric(14,2) not null default 0;

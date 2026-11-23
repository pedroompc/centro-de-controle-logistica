-- Equipe passa a ver Telemetria & Frota, Pedidos a Faturar e Cortes (23/11/2026).
-- Duas dessas telas leem do Supabase: KM da frota (frota_hodometro_diario) e o
-- filtro de região do A Faturar (calendario_rotas). Idempotente.
--
-- Este bloco SUBSTITUI o da 0031: é ele que se roda de novo quando surgir
-- tabela nova (a lista de exceções abaixo é a vigente).

do $$
declare
  t text;
begin
  for t in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'r'
       and c.relrowsecurity
  loop
    execute format('drop policy if exists "equipe nao le" on public.%I', t);
    if t not in ('profiles', 'faturamento_mensal', 'frota_hodometro_diario', 'calendario_rotas') then
      execute format(
        'create policy "equipe nao le" on public.%I as restrictive for select to authenticated using (not public.e_equipe())',
        t
      );
    end if;
  end loop;
end;
$$;

-- Conferência: frota_hodometro_diario e calendario_rotas NÃO devem aparecer.
--   select tablename from pg_policies where policyname = 'equipe nao le' order by 1;

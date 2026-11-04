-- Trilha de auditoria: toda inclusão, alteração e exclusão nos cadastros e
-- custos fica registrada com quem fez, quando, e a linha antes/depois.
-- Grava sozinha (trigger) — nenhum passo manual. Só admin lê. Idempotente.
--
-- Fora de propósito: faturamento_mensal (foto do sistema), frota_hodometro_diario
-- e frota_historico_janelas (coletor) — são dado gerado, não cadastro.

create table if not exists audit_log (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  tabela text not null,
  operacao text not null check (operacao in ('INSERT', 'UPDATE', 'DELETE')),
  registro text,                 -- chave da linha (id, placa, tipo…) em texto
  usuario uuid,                  -- auth.uid(); null = SQL Editor / service role
  email text,
  antes jsonb,
  depois jsonb
);

create index if not exists audit_log_em_idx on audit_log (em desc);
create index if not exists audit_log_tabela_idx on audit_log (tabela, em desc);

alter table audit_log enable row level security;

-- Só admin lê. Ninguém escreve pela API: quem grava é o trigger (security definer).
drop policy if exists "read audit_log" on audit_log;
create policy "read audit_log" on audit_log
  for select to authenticated using (public.is_admin());

create or replace function public.registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  linha jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  chave text := coalesce(
    linha->>'id', linha->>'placa', linha->>'tipo', linha->>'modelo',
    linha->>'usuario', linha->>'data', linha->>'mes'
  );
  uid uuid := auth.uid();
begin
  -- UPDATE que não mudou nada (ex.: upsert idêntico) não vira registro.
  if tg_op = 'UPDATE' and to_jsonb(old) = to_jsonb(new) then
    return new;
  end if;
  insert into audit_log (tabela, operacao, registro, usuario, email, antes, depois)
  values (
    tg_table_name, tg_op, chave, uid,
    (select p.email from profiles p where p.id = uid),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

-- Liga o trigger em cada tabela de cadastro/custo que existir neste banco
-- (algumas nascem nas migrations do repositório do RH).
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'setores', 'funcionarios', 'faltas', 'custos_fixos', 'custos_mensais',
    'fornecedores', 'precos_descarregamento', 'config_descarregamento',
    'receitas_descarregamento', 'receitas_descarregamento_diario', 'receitas_diversas',
    'descarregos_carros_dia', 'efetivo_mensal_setor', 'efetivo_mensal_cargo',
    'equipamentos', 'harpia_usuarios', 'calendario_rotas',
    'frota_consumo_modelos', 'frota_veiculos', 'frota_parametros'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists auditoria on public.%I', t);
      execute format(
        'create trigger auditoria after insert or update or delete on public.%I
           for each row execute function public.registrar_auditoria()', t);
    end if;
  end loop;
end $$;

-- Conferência: tabelas com o trigger ligado.
--   select event_object_table from information_schema.triggers
--    where trigger_name = 'auditoria' group by 1 order by 1;

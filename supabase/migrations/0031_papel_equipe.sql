-- Papel "equipe": só Consulta de Pedidos e Devoluções (dados do Winthor/Harpia).
-- Idempotente. Rodar inteiro no SQL Editor do Supabase.
--
-- Três partes:
--   1) o valor novo no enum user_role;
--   2) o papel espelhado em auth.users.raw_app_meta_data.papel — o proxy do app
--      lê dali (vem junto do getUser, sem consulta extra); só o servidor grava
--      app_metadata, o usuário não consegue se promover;
--   3) RLS: a equipe não lê nenhuma tabela do Supabase, exceto o próprio perfil
--      e faturamento_mensal (a tela de Devoluções usa a foto do mês como lastro).
--
-- Para dar o papel: update profiles set role = 'equipe' where email = '...';
-- (o trigger abaixo atualiza o app_metadata na hora; o proxy lê o usuário do
-- servidor de Auth a cada requisição e o RLS lê profiles — vale no próximo clique.)

-- 1) Enum. Nada abaixo usa o literal 'equipe' como enum (só como texto), para
--    rodar no mesmo lote do ADD VALUE sem o "unsafe use of new value".
alter type public.user_role add value if not exists 'equipe';

-- 2) Espelho do papel no app_metadata.
create or replace function public.espelhar_papel_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update auth.users
     set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('papel', new.role::text)
   where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_profile_role_change on public.profiles;
create trigger on_profile_role_change
  after insert or update of role on public.profiles
  for each row execute function public.espelhar_papel_app_metadata();

-- Backfill de quem já existe.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
                           || jsonb_build_object('papel', p.role::text)
  from public.profiles p
 where p.id = u.id;

-- 3) RLS. Checagem security definer (ignora o RLS de profiles), comparando como
--    texto pelo motivo do item 1.
create or replace function public.e_equipe()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role::text = 'equipe'
  );
$$;

-- Política RESTRITIVA (soma com AND às de leitura que já existem) em toda tabela
-- do schema public com RLS ligado, menos as que a equipe precisa. Cobre também
-- as tabelas criadas pelo repositório do RH. Tabela criada DEPOIS desta
-- migration não ganha a trava sozinha: rode este bloco de novo.
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
       and c.relname not in ('profiles', 'faturamento_mensal')
  loop
    execute format('drop policy if exists "equipe nao le" on public.%I', t);
    execute format(
      'create policy "equipe nao le" on public.%I as restrictive for select to authenticated using (not public.e_equipe())',
      t
    );
  end loop;
end;
$$;

-- Conferência (rodar depois):
--   select tablename from pg_policies where policyname = 'equipe nao le' order by 1;
--   select email, raw_app_meta_data->>'papel' from auth.users order by 1;

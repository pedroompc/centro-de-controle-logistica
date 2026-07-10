-- Papéis de usuário (admin/viewer) + RLS: leitura para qualquer logado,
-- escrita (criar/editar/excluir) restrita a admin.

create type user_role as enum ('admin', 'viewer');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'viewer',
  email text,
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Cada usuário lê só o próprio perfil (o app usa para saber o papel).
create policy "read own profile" on profiles
  for select to authenticated using (id = auth.uid());

-- Novo usuário do Supabase Auth ganha automaticamente um perfil 'viewer'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: usuários já existentes viram viewer (promova os admins manualmente).
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Checagem de admin (security definer: ignora o RLS de profiles ao avaliar policies).
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Reescreve as policies: SELECT liberado para logados; escrita só admin.
-- (SELECT é permitido pela OR das policies permissivas; escrita exige is_admin.)

-- setores
drop policy if exists "auth full access setores" on setores;
create policy "read setores" on setores for select to authenticated using (true);
create policy "write setores" on setores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- funcionarios
drop policy if exists "auth full access funcionarios" on funcionarios;
create policy "read funcionarios" on funcionarios for select to authenticated using (true);
create policy "write funcionarios" on funcionarios for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- faltas
drop policy if exists "auth full access faltas" on faltas;
create policy "read faltas" on faltas for select to authenticated using (true);
create policy "write faltas" on faltas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- custos_fixos
drop policy if exists "auth full access custos_fixos" on custos_fixos;
create policy "read custos_fixos" on custos_fixos for select to authenticated using (true);
create policy "write custos_fixos" on custos_fixos for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- custos_mensais
drop policy if exists "auth full access custos_mensais" on custos_mensais;
create policy "read custos_mensais" on custos_mensais for select to authenticated using (true);
create policy "write custos_mensais" on custos_mensais for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

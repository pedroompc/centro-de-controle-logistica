-- Usuário do Harpia (WMS) → funcionário do cadastro. O Harpia grava quem
-- conferiu só pelo número do usuário (USU_AVERIG_1197) e não achamos a tabela
-- de nomes dele; o gestor liga cada número a um funcionário uma vez, no BI da
-- Separação, e daí em diante o BI mostra o nome.
--
-- Aditiva e idempotente.
create table if not exists harpia_usuarios (
  usuario int primary key,
  funcionario_id uuid references funcionarios(id) on delete set null,
  atualizado_em timestamptz not null default now()
);

alter table harpia_usuarios enable row level security;

drop policy if exists "read harpia_usuarios" on harpia_usuarios;
create policy "read harpia_usuarios" on harpia_usuarios
  for select to authenticated using (true);
drop policy if exists "write harpia_usuarios" on harpia_usuarios;
create policy "write harpia_usuarios" on harpia_usuarios
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

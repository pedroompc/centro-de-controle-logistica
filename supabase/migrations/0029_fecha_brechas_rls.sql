-- Fecha duas brechas achadas na varredura de 04/11/2026. Idempotente.
--
-- 1) backup_receitas_20260720 (criada na 0008) ficou SEM RLS no schema public:
--    a chave anon — que vai embutida no site — lia as 6 linhas de receita pela
--    API do Supabase, sem login. O backup já cumpriu o papel (a 0008 é de
--    20/07/2026 e ninguém reverteu): apaga.
drop table if exists public.backup_receitas_20260720;

-- 2) faturamento_mensal aceitava INSERT de qualquer logado (viewer incluso):
--    dava para plantar a foto de um mês que ainda não tinha foto. Agora só admin
--    grava, como já era no UPDATE/DELETE. O app continua lendo ao vivo do
--    Winthor; a foto de um mês fechado se cria/atualiza quando um admin abre a tela.
drop policy if exists "insert faturamento_mensal" on faturamento_mensal;
create policy "insert faturamento_mensal" on faturamento_mensal
  for insert to authenticated with check (public.is_admin());

-- Conferência (rodar depois): tabelas do schema public sem RLS. Deve voltar vazio.
--   select tablename from pg_tables where schemaname = 'public' and not rowsecurity;

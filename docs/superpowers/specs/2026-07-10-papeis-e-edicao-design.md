# Papéis (admin/viewer) + edição completa — Design

**Data:** 2026-07-10 · **Status:** aprovado

## Objetivo
Permitir editar todos os dados operacionais (setores, funcionários, custos, faltas) pelo app, e restringir escrita a **admins**; **viewers** só visualizam. Papéis definidos direto no painel do Supabase (sem tela de gestão no app por enquanto).

## Modelo de papéis (banco)
- Enum `user_role` = `admin` | `viewer`.
- Tabela `profiles`: `id uuid pk references auth.users(id) on delete cascade`, `role user_role not null default 'viewer'`, `email text`, `created_at`.
- Trigger `on auth.users insert` → cria `profiles` com `role='viewer'` (email copiado).
- Backfill dos usuários existentes; promover manualmente os admins.
- Função `public.is_admin()` `security definer stable`: `exists (select 1 from profiles where id = auth.uid() and role='admin')`.

## Segurança (2 camadas)
1. **RLS (barreira real)** em `setores`, `funcionarios`, `faltas`, `custos_fixos`, `custos_mensais`:
   - `SELECT`: `to authenticated using (true)`.
   - `INSERT/UPDATE/DELETE`: `using (is_admin()) with check (is_admin())`.
   - Remove as policies atuais "full access".
   - `profiles`: usuário lê o próprio perfil (`id = auth.uid()`); sem update pelo usuário.
2. **App (UX + defesa em profundidade):** `src/data/auth.ts` com `getPerfil()`, `isAdmin()`, `assertAdmin()` (React `cache`). Toda Server Action de escrita chama `assertAdmin()`. UI esconde botões de escrita para viewer.

## Edição (UI)
- **Setores:** `renomearSetor` (novo) + excluir (FK `on delete restrict` impede excluir setor com gente → erro amigável). Criar já existe.
- **Funcionários:** editar completo (nome/cargo/**setor**/custo/status — form já existe) + excluir exposto.
- **Custos:** editar/excluir já existem → só gating.
- **Faltas:** editar/excluir (adicionar o que faltar) + gating.
- **Viewer:** vê tudo, sem botões de escrita; etiqueta "somente leitura".

## Gestão de papéis (runbook)
- Criar usuário: painel Supabase (Auth → convidar). Nasce `viewer`.
- Promover: Supabase → tabela `profiles` → `role = 'admin'`.

## Arquivos
- `supabase/migrations/0003_roles.sql` (enum, profiles, trigger, is_admin, RLS).
- `src/data/auth.ts` (helpers de papel).
- Server actions: `setores.ts` (+`renomearSetor`), `funcionarios.ts`, `custos-mensais.ts`, `custos-fixos.ts`, `faltas.ts` → `assertAdmin()`.
- UI: setor rename/delete, funcionário delete, faltas edit/delete, gating por `isAdmin`, badge somente-leitura.

## Fases
1. Migration `0003_roles.sql`. 2. `auth.ts`. 3. Gating nas actions + `renomearSetor`. 4. UI (edição + esconder para viewer). 5. Verificação + aplicar migration no Supabase + promover admin.

## Atenção
- Migration precisa ser **aplicada no Supabase** (SQL editor/CLI) — papéis só existem depois.
- Deploy: rebuild no servidor após puxar o código.

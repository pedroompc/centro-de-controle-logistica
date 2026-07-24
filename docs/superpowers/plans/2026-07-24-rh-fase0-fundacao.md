# Fase 0 — Fundação do RH (Área → Setor → Funcionário) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preparar o banco compartilhado para receber a empresa inteira — hierarquia Área → Setor → Funcionário, campos de desligamento e RLS por área — sem mover um único número do painel da logística.

**Architecture:** O discriminador de área vive em `setores`, não em `funcionarios`, então existe um ponto de filtro em vez de um por consulta. Duas defesas independentes: RLS no Postgres responde "esta pessoa *pode* ver esta linha?"; o filtro nas consultas do app responde "esta linha *pertence* a este painel?". As duas são necessárias — o usuário dono do sistema enxerga todas as áreas, e sem o filtro explícito o painel passaria a contar gente do Comercial sem erro nenhum aparecer.

**Tech Stack:** Next.js 16.2.10 (App Router, Server Components), Supabase (Postgres + PostgREST + RLS), TypeScript, Vitest.

**Spec:** `../CENTRO DE CONTROLE RH/docs/superpowers/specs/2026-07-24-rh-fundacao-e-headcount-design.md`

## Global Constraints

- Migrations são arquivos `.sql` em `supabase/migrations/`, aplicados **manualmente** colando no SQL Editor do Supabase. Não há CLI configurada neste projeto.
- Numeração sequencial contínua: a última aplicada é `0009_receitas_diversas.sql`.
- Toda consulta às tabelas compartilhadas passa por `src/data/setores.ts`, `src/data/funcionarios.ts` e `src/data/faltas.ts`. Nenhuma página consulta `supabase.from(...)` direto — mantenha assim.
- Slug da área deste aplicativo: `logistico`. Nomes das três áreas: `Comercial`, `Administrativo`, `Logístico`.
- Trabalhe no branch `feat/rh-fase0-fundacao`. Não faça merge em `main` antes da Task 7 passar.
- `npx vitest run` já tem **1 falha pré-existente** em `src/data/mappers.test.ts` (`mapCustoMensal` devolvendo `data: null`). Não é regressão sua e não faz parte deste plano — ignore, mas não deixe o número de falhas passar de 1.

### Desvio deliberado de TDD, e por quê

As Tasks 2–5 são schema e política de banco: não existe unidade de código para testar antes. As Tasks 6–7 são construção de query PostgREST, e este repositório não tem harness de mock de Supabase (todos os testes em `src/domain/` são puros). Montar esse harness custaria mais que o defeito que evitaria.

A verificação real destas tasks é a **Task 7**, que é um teste de ponta a ponta com critério objetivo: os números de antes têm que sair idênticos depois. Cada migration também traz sua própria query de verificação com saída esperada. Não invente testes de mentira para preencher a forma.

---

## File Structure

**Criados:**
- `supabase/migrations/0010_areas_e_hierarquia.sql` — tabela `areas`, `setores.area_id`, backfill, RLS de `areas`
- `supabase/migrations/0011_desligamento.sql` — enum `motivo_desligamento`, colunas em `funcionarios`, constraint de coerência
- `supabase/migrations/0012_papel_rh.sql` — só `alter type user_role add value 'rh'` (precisa rodar isolada)
- `supabase/migrations/0013_rls_por_area.sql` — `profiles.area_id`, funções auxiliares, políticas por área
- `src/domain/area.ts` — constante `AREA_DO_APP`

**Modificados:**
- `src/data/setores.ts` — `listarSetores()` restrito à área do app
- `src/data/funcionarios.ts` — `listarFuncionarios()` e `buscarFuncionario()` restritos à área do app
- `src/data/faltas.ts` — só um comentário explicando por que **não** é filtrada

---

### Task 1: Congelar os números de hoje

Antes de qualquer mudança. Sem esta foto, "os números não mudaram" vira opinião.

**Files:**
- Nenhum arquivo do repo. Executado no SQL Editor do Supabase.

**Interfaces:**
- Consumes: nada
- Produces: views `_snapshot_efetivo` e `_snapshot_faltas`, tabelas `_baseline_efetivo` e `_baseline_faltas` no banco. A Task 7 compara contra elas.

- [ ] **Step 1: Criar o branch**

```bash
git checkout main
git checkout -b feat/rh-fase0-fundacao
```

- [ ] **Step 2: Criar as views de snapshot no SQL Editor do Supabase**

Duas views separadas de propósito: juntar `faltas` na mesma consulta de custo multiplicaria as linhas e o `sum(custo_mensal)` sairia inflado.

```sql
create view _snapshot_efetivo as
select
  s.nome as setor,
  count(*) filter (where f.status = 'ativo')     as ativos,
  count(*) filter (where f.status = 'afastado')  as afastados,
  count(*) filter (where f.status = 'desligado') as desligados,
  coalesce(sum(f.custo_mensal) filter (where f.status = 'ativo'), 0)::numeric(12,2) as custo_ativos
from setores s
left join funcionarios f on f.setor_id = s.id
group by s.nome;

create view _snapshot_faltas as
select
  s.nome as setor,
  count(fl.id) as faltas_julho
from setores s
left join funcionarios f on f.setor_id = s.id
left join faltas fl on fl.funcionario_id = f.id
  and fl.data between date '2026-07-01' and date '2026-07-31'
group by s.nome;
```

- [ ] **Step 3: Gravar a foto**

```sql
create table _baseline_efetivo as select * from _snapshot_efetivo;
create table _baseline_faltas  as select * from _snapshot_faltas;
```

- [ ] **Step 4: Conferir que a foto tem conteúdo**

```sql
select
  (select count(*) from _baseline_efetivo) as linhas_efetivo,
  (select sum(ativos) from _baseline_efetivo) as total_ativos,
  (select sum(custo_ativos) from _baseline_efetivo) as custo_total;
```

Esperado: `linhas_efetivo` = 18 (um por setor cadastrado), `total_ativos` e `custo_total` maiores que zero. Se `linhas_efetivo` vier 0, pare — as views não estão lendo nada e o resto do plano não tem como ser verificado.

- [ ] **Step 5: Registrar os números no repo**

Copie o resultado do Step 4 para `docs/superpowers/plans/2026-07-24-rh-fase0-baseline.md`, neste formato:

```markdown
# Baseline fase 0 — capturado antes da migration 0010

- Setores: 18
- Total de ativos: <número>
- Custo total dos ativos: <número>

Tabelas de comparação no banco: `_baseline_efetivo`, `_baseline_faltas`.
Removidas ao final da Task 7.
```

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/plans/2026-07-24-rh-fase0-baseline.md
git commit -m "docs: baseline dos números da logística antes da fase 0"
```

---

### Task 2: Migration 0010 — hierarquia Área → Setor

**Files:**
- Create: `supabase/migrations/0010_areas_e_hierarquia.sql`

**Interfaces:**
- Consumes: `is_admin()` de `0003_roles.sql`
- Produces: tabela `areas(id uuid, nome text, slug text unique, created_at timestamptz)`; coluna `setores.area_id uuid not null references areas(id)`. As Tasks 5 e 6 filtram por `setores.area_id`; a Task 6 resolve a área pelo `slug`.

- [ ] **Step 1: Escrever a migration**

`slug` existe porque o app precisa de um identificador estável. Filtrar por `nome` quebraria no dia em que alguém renomear "Logístico" para "Logística" pela tela.

```sql
-- Nível acima de setor: Comercial, Administrativo, Logístico.
-- Tabela e não enum para o RH criar área nova sem precisar de migration.

create table areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

insert into areas (nome, slug) values
  ('Comercial', 'comercial'),
  ('Administrativo', 'administrativo'),
  ('Logístico', 'logistico');

-- Nullable primeiro, backfill, depois not null: a coluna não pode nascer
-- obrigatória numa tabela que já tem 18 linhas.
alter table setores add column area_id uuid references areas(id) on delete restrict;

update setores set area_id = (select id from areas where slug = 'logistico');

alter table setores alter column area_id set not null;
create index setores_area_id_idx on setores(area_id);

-- RLS de areas: leitura para qualquer logado (é lista de referência, não tem
-- dado sensível), escrita só admin — mesmo padrão de setores em 0003.
alter table areas enable row level security;
create policy "read areas" on areas for select to authenticated using (true);
create policy "write areas" on areas for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Aplicar no Supabase**

Cole o conteúdo do arquivo no SQL Editor e execute.

- [ ] **Step 3: Verificar**

```sql
select a.nome as area, count(s.id) as setores
from areas a left join setores s on s.area_id = a.id
group by a.nome order by a.nome;
```

Esperado, exatamente:

```
Administrativo | 0
Comercial      | 0
Logístico      | 18
```

Se algum setor ficou fora do Logístico, o `update` não pegou tudo — investigue antes de seguir.

- [ ] **Step 4: Confirmar que o painel não mudou**

```sql
select 'faltando' as lado, * from (select * from _baseline_efetivo except select * from _snapshot_efetivo) a
union all
select 'sobrando' as lado, * from (select * from _snapshot_efetivo except select * from _baseline_efetivo) b;
```

Esperado: **zero linhas.** Qualquer linha aqui significa que a migration mexeu em gente, o que ela não deveria ter feito.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0010_areas_e_hierarquia.sql
git commit -m "feat(db): hierarquia Área → Setor, com os setores atuais em Logístico"
```

---

### Task 3: Migration 0011 — campos de desligamento

Sem data de saída não existe turnover: o `status` diz que a pessoa saiu, mas não quando, e mês nenhum fecha. O app da logística não usa estes campos — quem vai usar é o app do RH.

**Files:**
- Create: `supabase/migrations/0011_desligamento.sql`

**Interfaces:**
- Consumes: tabela `funcionarios` de `0001_init.sql`
- Produces: enum `motivo_desligamento`; colunas `funcionarios.data_desligamento date` e `funcionarios.motivo_desligamento motivo_desligamento`, ambas nullable.

- [ ] **Step 1: Escrever a migration**

```sql
-- Lista controlada, não texto livre: o painel de turnover agrega por este campo.
-- Em texto livre, "pediu demissão", "Pedido de Demissão" e "PD" viram três
-- motivos distintos e a quebra que mais importa deixa de fechar.
create type motivo_desligamento as enum (
  'pedido_demissao',
  'dispensa_sem_justa_causa',
  'dispensa_justa_causa',
  'fim_contrato',
  'termino_experiencia',
  'abandono'
);

alter table funcionarios
  add column data_desligamento date,
  add column motivo_desligamento motivo_desligamento;

-- A constraint proíbe só a direção que é sempre errada: quem não está desligado
-- não pode ter data nem motivo de saída.
--
-- Deliberadamente NÃO exige data para quem já está desligado: os registros
-- antigos não têm essa informação e nunca terão. Exigir travaria a migration
-- ou obrigaria a inventar datas. Consequência assumida: o turnover só conta
-- desligamentos a partir de agora; o histórico anterior fica de fora.
alter table funcionarios add constraint funcionarios_desligamento_coerente
  check (
    status = 'desligado'
    or (data_desligamento is null and motivo_desligamento is null)
  );
```

- [ ] **Step 2: Aplicar no Supabase**

Cole no SQL Editor e execute.

- [ ] **Step 3: Verificar que as colunas existem e a constraint morde**

```sql
-- Deve FALHAR com violação de constraint:
update funcionarios
set data_desligamento = date '2026-07-01'
where status = 'ativo'
and id = (select id from funcionarios where status = 'ativo' limit 1);
```

Esperado: erro `new row for relation "funcionarios" violates check constraint "funcionarios_desligamento_coerente"`.

Se o update passar, a constraint não foi criada — revise a migration antes de seguir.

- [ ] **Step 4: Confirmar que nada mudou**

```sql
select 'faltando' as lado, * from (select * from _baseline_efetivo except select * from _snapshot_efetivo) a
union all
select 'sobrando' as lado, * from (select * from _snapshot_efetivo except select * from _baseline_efetivo) b;
```

Esperado: zero linhas.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0011_desligamento.sql
git commit -m "feat(db): data e motivo de desligamento em funcionarios"
```

---

### Task 4: Migration 0012 — papel `rh`

Migration isolada de propósito: `alter type ... add value` não pode ser usado no mesmo bloco que consome o valor novo. Misturar isso com as políticas da Task 5 causaria erro na aplicação.

**Files:**
- Create: `supabase/migrations/0012_papel_rh.sql`

**Interfaces:**
- Consumes: enum `user_role` de `0003_roles.sql`
- Produces: valor `'rh'` no enum `user_role`, usado pelo app do RH.

- [ ] **Step 1: Escrever a migration**

```sql
-- Precisa rodar sozinha: um valor recém-adicionado a um enum não pode ser
-- referenciado na mesma transação que o adicionou.
alter type user_role add value if not exists 'rh';
```

- [ ] **Step 2: Aplicar no Supabase, sozinha**

Cole **só este arquivo** no SQL Editor e execute. Não junte com a Task 5.

- [ ] **Step 3: Verificar**

```sql
select unnest(enum_range(null::user_role)) as papel;
```

Esperado, exatamente três linhas: `admin`, `viewer`, `rh`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0012_papel_rh.sql
git commit -m "feat(db): papel rh no enum user_role"
```

---

### Task 5: Migration 0013 — RLS por área

A defesa de acesso. Hoje a regra é "usuário autenticado lê tudo", o que só é seguro enquanto "tudo" é a logística.

**Files:**
- Create: `supabase/migrations/0013_rls_por_area.sql`

**Interfaces:**
- Consumes: `areas` e `setores.area_id` (Task 2); `is_admin()` de `0003_roles.sql`
- Produces: coluna `profiles.area_id uuid` (nulo = enxerga todas as áreas); funções `area_do_usuario() returns uuid`, `pode_ver_setor(uuid) returns boolean`, `pode_ver_funcionario(uuid) returns boolean`. A Task 7 usa `pode_ver_setor` na verificação.

- [ ] **Step 1: Escrever a migration**

As funções são `security definer` por necessidade, não por conveniência: uma policy que consulta `setores` dispararia o RLS de `setores`, que por sua vez consulta... `setores`. `security definer` corta essa recursão.

```sql
-- Área do usuário. Nulo = enxerga todas (dono do sistema, RH).
alter table profiles add column area_id uuid references areas(id) on delete restrict;

create or replace function public.area_do_usuario()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select area_id from public.profiles where id = auth.uid();
$$;

-- security definer: chamada de dentro de uma policy, precisa ler setores sem
-- disparar o RLS de setores (que chamaria esta função de novo).
create or replace function public.pode_ver_setor(p_setor_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select public.area_do_usuario() is null
      or exists (
        select 1 from public.setores s
        where s.id = p_setor_id
          and s.area_id = public.area_do_usuario()
      );
$$;

create or replace function public.pode_ver_funcionario(p_funcionario_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.funcionarios f
    where f.id = p_funcionario_id
      and public.pode_ver_setor(f.setor_id)
  );
$$;

-- setores
drop policy if exists "read setores" on setores;
create policy "read setores" on setores for select to authenticated
  using (public.area_do_usuario() is null or area_id = public.area_do_usuario());

drop policy if exists "write setores" on setores;
create policy "write setores" on setores for all to authenticated
  using (public.is_admin() and (public.area_do_usuario() is null or area_id = public.area_do_usuario()))
  with check (public.is_admin() and (public.area_do_usuario() is null or area_id = public.area_do_usuario()));

-- funcionarios
drop policy if exists "read funcionarios" on funcionarios;
create policy "read funcionarios" on funcionarios for select to authenticated
  using (public.pode_ver_setor(setor_id));

drop policy if exists "write funcionarios" on funcionarios;
create policy "write funcionarios" on funcionarios for all to authenticated
  using (public.is_admin() and public.pode_ver_setor(setor_id))
  with check (public.is_admin() and public.pode_ver_setor(setor_id));

-- faltas
drop policy if exists "read faltas" on faltas;
create policy "read faltas" on faltas for select to authenticated
  using (public.pode_ver_funcionario(funcionario_id));

drop policy if exists "write faltas" on faltas;
create policy "write faltas" on faltas for all to authenticated
  using (public.is_admin() and public.pode_ver_funcionario(funcionario_id))
  with check (public.is_admin() and public.pode_ver_funcionario(funcionario_id));
```

- [ ] **Step 2: Aplicar no Supabase**

Cole no SQL Editor e execute.

- [ ] **Step 3: Provar que a RLS realmente separa**

Este é o passo que justifica a migration inteira. Sem ele você só tem políticas escritas, não políticas funcionando.

Crie um funcionário de teste no Comercial e finja ser um usuário restrito à logística:

```sql
-- Setor e funcionário de teste no Comercial.
insert into setores (nome, area_id)
values ('ZZ Teste Comercial', (select id from areas where slug = 'comercial'));

insert into funcionarios (nome, cargo, setor_id, custo_mensal, data_admissao, status)
values ('ZZ Teste', 'Teste', (select id from setores where nome = 'ZZ Teste Comercial'), 1000, date '2026-01-01', 'ativo');

-- Prende SEU usuário à área Logístico. Use o seu e-mail literal — nunca
-- `limit 1` sem ordenação: o `update` e o `set` abaixo poderiam cair em
-- perfis diferentes e o teste passaria sem ter provado nada.
update profiles
set area_id = (select id from areas where slug = 'logistico')
where email = 'pedroomarinhocampos@gmail.com';
```

Confirme que pegou exatamente um perfil:

```sql
select email, area_id from profiles where email = 'pedroomarinhocampos@gmail.com';
```

Esperado: uma linha, com `area_id` preenchido.

Agora simule esse usuário:

```sql
begin;
set local role authenticated;
set local request.jwt.claims = json_build_object(
  'sub', (select id from public.profiles where email = 'pedroomarinhocampos@gmail.com'),
  'role', 'authenticated'
)::text;

select count(*) as funcionarios_visiveis from funcionarios;
select count(*) as setores_visiveis from setores;

rollback;
```

Esperado: `funcionarios_visiveis` **não inclui** o "ZZ Teste", e `setores_visiveis` é 18 — o "ZZ Teste Comercial" fica de fora. Se o count incluir os registros de teste, a política não está mordendo; não siga adiante.

- [ ] **Step 4: Devolver o usuário ao acesso total**

```sql
update profiles set area_id = null where email = 'pedroomarinhocampos@gmail.com';
```

Esperado: você volta a enxergar tudo, que é o comportamento correto para o dono do sistema. Os registros "ZZ Teste" ficam no banco de propósito — a Task 7 usa eles e limpa no final.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0013_rls_por_area.sql
git commit -m "feat(db): RLS por área em setores, funcionarios e faltas"
```

---

### Task 6: Filtro por área nas consultas do app

A defesa de correção, separada da de acesso. Com `area_id` nulo no seu perfil, a RLS te libera a empresa inteira — sem este filtro, o painel de efetivo passaria a contar o pessoal do Comercial e nenhum erro apareceria.

**Files:**
- Create: `src/domain/area.ts`
- Modify: `src/data/setores.ts:10-19` (`listarSetores`)
- Modify: `src/data/funcionarios.ts:11-27` (`listarFuncionarios`, `buscarFuncionario`)
- Modify: `src/data/faltas.ts:10-15` (só comentário)

**Interfaces:**
- Consumes: `areas.slug` (Task 2)
- Produces: `AREA_DO_APP: string` exportado de `@/domain/area`. `listarSetores()` e `listarFuncionarios()` mantêm assinatura e tipo de retorno — nenhuma página muda.

- [ ] **Step 1: Criar a constante da área**

Segue o padrão que já existe em `src/data/filiais.ts`: escopo do app como constante de código, não configuração de runtime.

```typescript
// src/domain/area.ts

/**
 * Área que este aplicativo enxerga. O banco é compartilhado com o Centro de
 * Controle RH, que enxerga a empresa inteira — aqui só entra a logística.
 *
 * Casado por `slug` e não por `nome` de propósito: renomear "Logístico" para
 * "Logística" pela tela é plausível, e quebraria o filtro em silêncio.
 */
export const AREA_DO_APP = "logistico";
```

- [ ] **Step 2: Restringir `listarSetores`**

Substitua a função inteira em `src/data/setores.ts`:

```typescript
export async function listarSetores(): Promise<Setor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("setores")
    .select("id, nome, areas!inner(slug)")
    .eq("areas.slug", AREA_DO_APP)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSetor);
}
```

E acrescente o import no topo do arquivo:

```typescript
import { AREA_DO_APP } from "@/domain/area";
```

`!inner` transforma o embed em INNER JOIN — sem ele o filtro não elimina linha nenhuma, só devolve `areas: null`. `mapSetor` lê apenas `id` e `nome`, então a coluna extra é ignorada sem alteração no mapper.

- [ ] **Step 3: Restringir `listarFuncionarios` e `buscarFuncionario`**

Substitua as duas funções em `src/data/funcionarios.ts`:

```typescript
export async function listarFuncionarios(): Promise<Funcionario[]> {
  // Os funcionários deste app são, por definição, os dos setores deste app —
  // `listarSetores` já vem restrito à área. Dois passos em vez de um embed
  // aninhado (funcionarios → setores → areas) porque são 18 setores e a
  // consulta fica óbvia de ler e de depurar.
  const setores = await listarSetores();
  if (setores.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcionarios")
    .select(COLUNAS)
    .in("setor_id", setores.map((s) => s.id))
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFuncionario);
}

export async function buscarFuncionario(id: string): Promise<Funcionario | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcionarios")
    .select(COLUNAS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  // A RLS já barra quem tem área no perfil; para o usuário de acesso total ela
  // não barra nada, e sem esta linha uma URL /funcionarios/<id-do-comercial>
  // abriria a ficha de alguém de fora deste painel.
  const funcionario = mapFuncionario(data);
  const setores = await listarSetores();
  return setores.some((s) => s.id === funcionario.setorId) ? funcionario : null;
}
```

E acrescente o import no topo do arquivo:

```typescript
import { listarSetores } from "./setores";
```

- [ ] **Step 4: Documentar por que `faltas` não é filtrada**

Acrescente o comentário acima de `listarFaltas` em `src/data/faltas.ts`:

```typescript
// Deliberadamente NÃO filtrada por área. Todo consumo de faltas passa por
// `faltasNoPeriodo(faltas, ids, ...)` em src/domain/metrics.ts, que só conta
// falta cujo funcionário está na lista carregada — e essa lista já vem
// restrita à área. Falta de outra área não casa com ninguém e é descartada.
//
// Pendência conhecida, anterior a esta mudança: esta consulta traz todas as
// faltas de todos os tempos, sem recorte de data. Com a empresa inteira no
// banco isso cresce. Corrigir quando pesar, não agora.
export async function listarFaltas(): Promise<Falta[]> {
```

- [ ] **Step 5: Verificar tipos e lint**

```bash
npx tsc --noEmit && npx eslint src/data/setores.ts src/data/funcionarios.ts src/data/faltas.ts src/domain/area.ts
```

Esperado: nenhuma saída (typecheck e lint limpos).

- [ ] **Step 6: Rodar a suíte**

```bash
npx vitest run
```

Esperado: `1 failed | 184 passed`. A única falha é a pré-existente em `mappers.test.ts`. Se aparecer uma segunda, você quebrou algo.

- [ ] **Step 7: Commit**

```bash
git add src/domain/area.ts src/data/setores.ts src/data/funcionarios.ts src/data/faltas.ts
git commit -m "feat(efetivo): consultas de gente restritas à área logística"
```

---

### Task 7: Provar que nenhum número se moveu

O critério de aceite da fase inteira. Mesmo método que fechou a devolução avulsa nos R$ 4.390,21 exatos: o número velho tem que continuar exato depois da mudança.

**Files:**
- Modify: `docs/superpowers/plans/2026-07-24-rh-fase0-baseline.md` (registrar o resultado)

**Interfaces:**
- Consumes: `_baseline_efetivo` e `_baseline_faltas` (Task 1); registros "ZZ Teste" (Task 5)
- Produces: nada em código. Autoriza o merge em `main`.

- [ ] **Step 1: Comparar o banco contra a foto, ignorando os registros de teste**

```sql
select 'faltando' as lado, * from (
  select * from _baseline_efetivo
  except
  select * from _snapshot_efetivo where setor not like 'ZZ Teste%'
) a
union all
select 'sobrando' as lado, * from (
  select * from _snapshot_efetivo where setor not like 'ZZ Teste%'
  except
  select * from _baseline_efetivo
) b;
```

Esperado: **zero linhas.** Repita para faltas:

```sql
select 'faltando' as lado, * from (
  select * from _baseline_faltas
  except
  select * from _snapshot_faltas where setor not like 'ZZ Teste%'
) a
union all
select 'sobrando' as lado, * from (
  select * from _snapshot_faltas where setor not like 'ZZ Teste%'
  except
  select * from _baseline_faltas
) b;
```

Esperado: zero linhas.

- [ ] **Step 2: Subir o app**

Use a ferramenta de preview com a configuração `dev` de `.claude/launch.json`. Não rode `npm run dev` pelo terminal.

- [ ] **Step 3: Conferir que o funcionário do Comercial não aparece em lugar nenhum**

Com o "ZZ Teste" ativo no Comercial e o seu perfil com `area_id` nulo (acesso total), abra e verifique:

- `/setores` — o cabeçalho deve continuar dizendo **18 setores**, e "ZZ Teste Comercial" não pode aparecer no grid
- `/funcionarios` — "ZZ Teste" não pode estar na lista
- `/` (dashboard) — custo do efetivo e faltas do mês idênticos ao baseline do Step 1
- `/custos` — o custo de pessoal não pode ter subido os R$ 1.000 do funcionário de teste

Se qualquer um dos quatro mostrar o registro de teste, o filtro da Task 6 não está pegando naquele caminho. Corrija antes de seguir.

- [ ] **Step 4: Conferir que a ficha direta também barra**

Pegue o id do funcionário de teste:

```sql
select id from funcionarios where nome = 'ZZ Teste';
```

Abra `/funcionarios/<esse-id>` no preview. Esperado: página de "não encontrado" — não a ficha dele. Este é o caminho que a RLS sozinha não protegeria para um usuário de acesso total.

- [ ] **Step 5: Limpar os registros de teste**

```sql
delete from funcionarios where nome = 'ZZ Teste';
delete from setores where nome = 'ZZ Teste Comercial';
```

- [ ] **Step 6: Remover as estruturas de verificação**

```sql
drop table _baseline_efetivo;
drop table _baseline_faltas;
drop view _snapshot_efetivo;
drop view _snapshot_faltas;
```

- [ ] **Step 7: Registrar o resultado**

Acrescente ao fim de `docs/superpowers/plans/2026-07-24-rh-fase0-baseline.md`:

```markdown
## Verificação final — <data>

- Comparação `_baseline_efetivo` × `_snapshot_efetivo`: zero divergências
- Comparação `_baseline_faltas` × `_snapshot_faltas`: zero divergências
- Funcionário de teste no Comercial invisível em /setores, /funcionarios, / e /custos
- Ficha direta `/funcionarios/<id>` de outra área: não encontrado
- Estruturas de verificação removidas do banco
```

- [ ] **Step 8: Commit e merge**

```bash
git add docs/superpowers/plans/2026-07-24-rh-fase0-baseline.md
git commit -m "docs: verificação da fase 0 — números da logística inalterados"
git checkout main
git merge --no-ff feat/rh-fase0-fundacao -m "Merge branch 'feat/rh-fase0-fundacao': fundação do RH"
```

---

## Depois desta fase

O banco fica pronto para o app do RH. A fatia 1 (headcount e turnover) vive no repositório `CENTRO DE CONTROLE RH` e tem plano próprio, que só pode ser escrito depois de duas respostas do RH:

- as colunas da planilha de funcionários, para o importador e para a lista de motivos de desligamento
- a fórmula de turnover que eles usam hoje na planilha

# Lançamento por total do dia — descarregamento · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que a assistente lance o resultado agregado de um dia de descarregamento (nº de descarregos · peso total · valor total) em vez de um lançamento por fornecedor.

**Architecture:** Tabela irmã nova `receitas_descarregamento_diario`, análoga a `receitas_diversas`: cada origem tem seu tipo de domínio e é somada só no nível dos totais. O tipo `Receita` e o lançamento detalhado ficam intactos. A entrada mora na vista "Simples", que já é a visão por dia.

**Tech Stack:** Next.js (App Router, server actions — **APIs com breaking changes, ver Global Constraints**), TypeScript, Supabase (Postgres + RLS), Vitest, Tailwind.

## Global Constraints

- **Este NÃO é o Next.js de treino.** Antes de escrever qualquer código de Next (server actions, rotas, páginas), ler o guia relevante em `node_modules/next/dist/docs/`. Respeitar avisos de deprecação. (AGENTS.md)
- **Verde (emerald) só para valores de receita.** Origem, rótulos e status nunca usam verde — navy (`#141a4d`/`#181d55`), slate ou âmbar. (identidade visual)
- **Todo write passa por `assertAdmin()`** (de `@/data/auth`) e a RLS da tabela espelha a de `receitas_descarregamento`/`receitas_diversas`: SELECT para `authenticated`, escrita só `public.is_admin()`.
- **Somas de dinheiro usam `arredonda2`** de `@/domain/receitas-metrics`, a cada passo, para o total do rodapé fechar com o card do topo.
- **Migration aplicada à mão** no Supabase SQL Editor pelo Pedro (não há passo automatizado). A verificação visual (dev server) só funciona depois de aplicada.
- **Numeração:** `0013` — a sequência local do repo para em `0009`, mas o projeto de RH aplicou `0010–0012` no mesmo Supabase compartilhado; `0013` mantém o número único no banco.

## File Structure

- `supabase/migrations/0013_receitas_descarregamento_diario.sql` — **criar**. DDL + RLS da tabela nova.
- `src/domain/types.ts` — **modificar**. Novo tipo `TotalDiarioDescarregamento`.
- `src/domain/receitas-metrics.ts` — **modificar**. `DiaDescarregamento` ganha `origem`/`id?`; `receitaPorDia` e `resumoReceitas` passam a receber os totais diários.
- `src/domain/receitas-metrics.test.ts` — **modificar**. Cobre o merge e a extensão do resumo; ajusta 1 asserção existente.
- `src/data/mappers.ts` — **modificar**. `mapTotalDiario`.
- `src/data/mappers.test.ts` — **modificar**. Teste do mapper.
- `src/data/receitas-diario.ts` — **criar**. Leitura + server actions (listar/criar/editar/remover).
- `src/data/receitas.ts` — **modificar**. `receitaTotalDoMes` e `serieReceitasMensais` somam os totais diários (funil único do custo líquido).
- `src/app/(app)/receitas/total-diario-form.tsx` — **criar**. Formulário de lançamento/edição.
- `src/app/(app)/receitas/page.tsx` — **modificar**. Carrega os totais, alimenta métricas, renderiza o form e o editar/remover na vista Simples.
- `src/app/(app)/receitas/export/route.ts` — **modificar**. CSV inclui os totais diários.

---

### Task 1: Migration da tabela `receitas_descarregamento_diario`

**Files:**
- Create: `supabase/migrations/0013_receitas_descarregamento_diario.sql`

**Interfaces:**
- Produces: tabela `receitas_descarregamento_diario(id, data, descarregos, peso_kg, receita, observacao, created_at)` com RLS.

- [ ] **Step 1: Escrever a migration**

Espelha o padrão da `0009_receitas_diversas.sql` (índice em `data`, RLS com `public.is_admin()`).

```sql
-- Lançamento agregado de um dia de descarregamento: em vez de N linhas por
-- fornecedor em receitas_descarregamento, uma linha com o resultado do dia.
-- A assistente digita o total no fim do dia (nº de descarregos, peso e valor).
--
-- Tabela irmã de receitas_descarregamento, não extensão dela: um total do dia
-- não tem fornecedor, tipo, preço/ton nem mínimo — nenhum se aplica a um
-- agregado. `receita` é o valor final digitado, sem cálculo de piso.

create table receitas_descarregamento_diario (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  descarregos int not null check (descarregos > 0),
  peso_kg numeric(14,3) not null check (peso_kg >= 0),
  receita numeric(12,2) not null check (receita >= 0),
  observacao text,
  created_at timestamptz not null default now()
);

create index receitas_desc_diario_data_idx on receitas_descarregamento_diario(data);

alter table receitas_descarregamento_diario enable row level security;

-- RLS no padrão do projeto: leitura para logado, escrita só admin.
create policy "read receitas_descarregamento_diario" on receitas_descarregamento_diario
  for select to authenticated using (true);
create policy "write receitas_descarregamento_diario" on receitas_descarregamento_diario
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Verificar sintaxe/coerência com a 0009**

Run: `diff <(grep -oE 'is_admin\(\)|for select to authenticated|enable row level security' supabase/migrations/0009_receitas_diversas.sql) <(grep -oE 'is_admin\(\)|for select to authenticated|enable row level security' supabase/migrations/0013_receitas_descarregamento_diario.sql)`
Expected: sem diferenças nas três âncoras de RLS.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0013_receitas_descarregamento_diario.sql
git commit -m "feat(db): tabela receitas_descarregamento_diario (total do dia)"
```

> **Aplicação:** o Pedro roda este SQL no Supabase SQL Editor. As tarefas de código seguem sem depender disso (build/test não tocam o banco); só a verificação visual da Task 6 precisa da tabela aplicada.

---

### Task 2: Domínio — tipo, merge no `receitaPorDia`, extensão do `resumoReceitas`

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/receitas-metrics.ts`
- Test: `src/domain/receitas-metrics.test.ts`

**Interfaces:**
- Produces:
  - `interface TotalDiarioDescarregamento { id: string; data: string; descarregos: number; pesoKg: number; receita: number; observacao: string | null }`
  - `interface DiaDescarregamento { data: string; descarregos: number; pesoKg: number; receita: number; origem: "detalhado" | "total"; id?: string }`
  - `receitaPorDia(rs: Receita[], totais?: TotalDiarioDescarregamento[]): DiaDescarregamento[]`
  - `resumoReceitas(descarregamentos: Receita[], diversas: ReceitaDiversa[], totaisDiarios?: TotalDiarioDescarregamento[]): ResumoReceitas`

- [ ] **Step 1: Adicionar o tipo em `types.ts`**

Logo após a interface `Receita` (linha ~90):

```ts
/**
 * Resultado agregado de um dia de descarregamento, lançado direto (sem detalhar
 * fornecedor). `receita` é o valor final digitado — não passa por cálculo de
 * mínimo, que é regra do lançamento por fornecedor.
 */
export interface TotalDiarioDescarregamento {
  id: string;
  data: string; // ISO "yyyy-mm-dd"
  descarregos: number;
  pesoKg: number;
  receita: number;
  observacao: string | null;
}
```

- [ ] **Step 2: Escrever os testes que falham** (em `receitas-metrics.test.ts`)

Primeiro, importar o tipo e adicionar uma factory perto da factory `r` (linha ~10):

```ts
import type { Receita, ReceitaDiversa, TotalDiarioDescarregamento } from "./types";

const td = (over: Partial<TotalDiarioDescarregamento>): TotalDiarioDescarregamento => ({
  id: "t1", data: "2026-07-10", descarregos: 8, pesoKg: 20000, receita: 500,
  observacao: null, ...over,
});
```

Ajustar a asserção existente do primeiro teste de `receitaPorDia` (o `toEqual` da linha ~183) para incluir a origem:

```ts
    expect(dias).toEqual([
      { data: "2026-07-10", descarregos: 2, pesoKg: 3500, receita: 82.5, origem: "detalhado" },
    ]);
```

Adicionar, dentro do `describe("receitaPorDia", ...)`:

```ts
  it("inclui os totais diários como linhas de origem 'total', com id", () => {
    const dias = receitaPorDia([], [td({ id: "t9", data: "2026-07-15", descarregos: 12, pesoKg: 34000, receita: 900 })]);
    expect(dias).toEqual([
      { data: "2026-07-15", descarregos: 12, pesoKg: 34000, receita: 900, origem: "total", id: "t9" },
    ]);
  });

  it("no dia misto, mantém detalhado e total como linhas separadas", () => {
    const dias = receitaPorDia(
      [r({ id: "a", data: "2026-07-10", pesoKg: 1000, receita: 20 })],
      [td({ id: "t1", data: "2026-07-10", descarregos: 5, pesoKg: 9000, receita: 250 })],
    );
    expect(dias).toHaveLength(2);
    expect(dias.filter((d) => d.origem === "detalhado")).toHaveLength(1);
    expect(dias.filter((d) => d.origem === "total")).toHaveLength(1);
  });

  it("ordena detalhado e total juntos por data desc", () => {
    const dias = receitaPorDia(
      [r({ id: "a", data: "2026-07-03" })],
      [td({ id: "t1", data: "2026-07-21" }), td({ id: "t2", data: "2026-07-12" })],
    );
    expect(dias.map((d) => d.data)).toEqual(["2026-07-21", "2026-07-12", "2026-07-03"]);
  });
```

E, dentro do `describe("receitas-metrics", ...)`:

```ts
  it("soma os totais diários no descarregamento (card, peso e médio/ton)", () => {
    const resumo = resumoReceitas(
      [r({ pesoKg: 10000, receita: 200 })],
      [],
      [td({ pesoKg: 10000, receita: 300 })],
    );
    expect(resumo.totalDescarregamento).toBe(500); // 200 detalhado + 300 total do dia
    expect(resumo.toneladas).toBe(20);             // 10 t + 10 t
    expect(resumo.medioPorTonelada).toBe(25);      // 500 / 20 t
    expect(resumo.total).toBe(500);
  });
```

- [ ] **Step 3: Rodar os testes e ver falhar**

Run: `npm test -- receitas-metrics`
Expected: FAIL — `td` referenciado antes de existir / `receitaPorDia` e `resumoReceitas` ignoram o 2º/3º argumento; falta `origem` no retorno.

- [ ] **Step 4: Estender `DiaDescarregamento` e `receitaPorDia`** (em `receitas-metrics.ts`)

Substituir a interface `DiaDescarregamento` (linha ~58) e a função `receitaPorDia` (linha ~82). Importar o tipo no topo:

```ts
import type { Receita, DescarregamentoTipo, ReceitaDiversa, TotalDiarioDescarregamento } from "./types";
```

```ts
export interface DiaDescarregamento {
  data: string; // ISO "yyyy-mm-dd"
  descarregos: number;
  pesoKg: number;
  receita: number;
  /** Como o dia entrou: agregado dos lançamentos por fornecedor, ou digitado direto. */
  origem: "detalhado" | "total";
  /** Só presente em origem "total" — é a linha editável/removível na vista Simples. */
  id?: string;
}
```

```ts
export function receitaPorDia(
  rs: Receita[],
  totais: TotalDiarioDescarregamento[] = [],
): DiaDescarregamento[] {
  const mapa = new Map<string, DiaDescarregamento>();
  for (const r of rs) {
    const atual =
      mapa.get(r.data) ?? { data: r.data, descarregos: 0, pesoKg: 0, receita: 0, origem: "detalhado" as const };
    atual.descarregos += 1;
    atual.pesoKg += r.pesoKg;
    atual.receita = arredonda2(atual.receita + r.receita);
    mapa.set(r.data, atual);
  }
  // Totais diários NÃO se fundem com os derivados nem entre si: cada um é uma
  // linha própria, editável pelo id. Um dia misto vira duas linhas rotuladas.
  const lancados: DiaDescarregamento[] = totais.map((t) => ({
    data: t.data,
    descarregos: t.descarregos,
    pesoKg: t.pesoKg,
    receita: t.receita,
    origem: "total",
    id: t.id,
  }));
  // Datas ISO comparam corretamente como string (yyyy-mm-dd é ordenável lexicalmente).
  return [...mapa.values(), ...lancados].sort((a, b) => b.data.localeCompare(a.data));
}
```

- [ ] **Step 5: Estender `resumoReceitas`** (linha ~155)

```ts
export function resumoReceitas(
  descarregamentos: Receita[],
  diversas: ReceitaDiversa[],
  totaisDiarios: TotalDiarioDescarregamento[] = [],
): ResumoReceitas {
  const totalDetalhado = receitaTotal(descarregamentos);
  const totalTotaisDiarios = arredonda2(totaisDiarios.reduce((t, x) => t + x.receita, 0));
  const totalDescarregamento = arredonda2(totalDetalhado + totalTotaisDiarios);
  const totalDiversas = valorTotalDiversas(diversas);
  const tonsDetalhado = toneladasTotal(descarregamentos);
  const tonsTotaisDiarios = arredonda2(totaisDiarios.reduce((t, x) => t + toneladas(x.pesoKg), 0));
  const tons = arredonda2(tonsDetalhado + tonsTotaisDiarios);
  return {
    totalDescarregamento,
    totalDiversas,
    total: arredonda2(totalDescarregamento + totalDiversas),
    toneladas: tons,
    medioPorTonelada: tons === 0 ? 0 : arredonda2(totalDescarregamento / tons),
  };
}
```

- [ ] **Step 6: Rodar os testes e ver passar**

Run: `npm test -- receitas-metrics`
Expected: PASS (todos, inclusive os antigos — chamadas com menos argumentos usam os defaults).

- [ ] **Step 7: Commit**

```bash
git add src/domain/types.ts src/domain/receitas-metrics.ts src/domain/receitas-metrics.test.ts
git commit -m "feat(receitas): domínio do total do dia no receitaPorDia e resumoReceitas"
```

---

### Task 3: Mapper `mapTotalDiario`

**Files:**
- Modify: `src/data/mappers.ts`
- Test: `src/data/mappers.test.ts`

**Interfaces:**
- Consumes: `TotalDiarioDescarregamento` (Task 2).
- Produces: `mapTotalDiario(row): TotalDiarioDescarregamento`.

- [ ] **Step 1: Escrever o teste que falha** (em `mappers.test.ts`)

Adicionar `mapTotalDiario` ao import do topo e um bloco novo:

```ts
import { mapFuncionario, mapSetor, mapFalta, mapCustoFixo, mapCustoMensal, mapReceita, mapConfig, mapReceitaDiversa, mapTotalDiario } from "./mappers";
```

```ts
describe("mapTotalDiario", () => {
  it("converte snake_case e numéricos vindos como string", () => {
    const row = {
      id: "t1",
      data: "2026-07-15",
      descarregos: "12",
      peso_kg: "34000.000",
      receita: "900.00",
      observacao: null,
    };
    expect(mapTotalDiario(row)).toEqual({
      id: "t1",
      data: "2026-07-15",
      descarregos: 12,
      pesoKg: 34000,
      receita: 900,
      observacao: null,
    });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- mappers`
Expected: FAIL — `mapTotalDiario` não exportado.

- [ ] **Step 3: Implementar o mapper** (em `mappers.ts`)

Importar o tipo (juntar ao import de tipos existente no topo do arquivo) e adicionar a função após `mapReceitaDiversa`:

```ts
export function mapTotalDiario(row: {
  id: string; data: string; descarregos: string | number;
  peso_kg: string | number; receita: string | number; observacao: string | null;
}): TotalDiarioDescarregamento {
  return {
    id: row.id,
    data: row.data,
    descarregos: Number(row.descarregos),
    pesoKg: Number(row.peso_kg),
    receita: Number(row.receita),
    observacao: row.observacao,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- mappers`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/mappers.ts src/data/mappers.test.ts
git commit -m "feat(receitas): mapper mapTotalDiario"
```

---

### Task 4: Camada de dados — módulo `receitas-diario.ts` + funil do custo líquido

**Files:**
- Create: `src/data/receitas-diario.ts`
- Modify: `src/data/receitas.ts` (`receitaTotalDoMes` linha 41-55, `serieReceitasMensais` linha 61-80)

**Interfaces:**
- Consumes: `mapTotalDiario` (Task 3), `TotalDiarioDescarregamento` (Task 2), `assertAdmin`, `inicioFimDoMes`, `primeiroDiaDoMes`.
- Produces:
  - `listarTotaisDiariosDoMes(mes: string): Promise<TotalDiarioDescarregamento[]>`
  - `criarTotalDiario(formData: FormData): Promise<void>`
  - `editarTotalDiario(formData: FormData): Promise<void>`
  - `removerTotalDiario(id: string): Promise<void>`

- [ ] **Step 1: Ler o guia de server actions do Next**

Conferir `node_modules/next/dist/docs/` sobre server actions (`"use server"`, `revalidatePath`) — as APIs podem diferir do treino. Confirmar que o padrão de `src/data/receitas-diversas.ts` continua válido nesta versão.

- [ ] **Step 2: Criar o módulo** `src/data/receitas-diario.ts`

Espelha `receitas-diversas.ts` (mesmo padrão de `parseForm`/`toRow`/`revalidar`):

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapTotalDiario } from "./mappers";
import { assertAdmin } from "./auth";
import { inicioFimDoMes } from "@/domain/periodo";
import type { TotalDiarioDescarregamento } from "@/domain/types";

const COLS = "id, data, descarregos, peso_kg, receita, observacao";

export async function listarTotaisDiariosDoMes(mes: string): Promise<TotalDiarioDescarregamento[]> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receitas_descarregamento_diario")
    .select(COLS)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapTotalDiario(row as Parameters<typeof mapTotalDiario>[0]));
}

function parseForm(formData: FormData) {
  const data = String(formData.get("data") ?? "").trim();
  const descarregos = Number(formData.get("descarregos") ?? 0);
  const pesoKg = Number(formData.get("peso_kg") ?? 0);
  const receita = Number(formData.get("receita") ?? 0);
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  return { data, descarregos, pesoKg, receita, observacao };
}

/** Campos gravados no banco, compartilhados por criar e editar. */
function toRow(f: ReturnType<typeof parseForm>) {
  return {
    data: f.data,
    descarregos: f.descarregos,
    peso_kg: f.pesoKg,
    receita: f.receita,
    observacao: f.observacao,
  };
}

function revalidar() {
  revalidatePath("/receitas");
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function criarTotalDiario(formData: FormData): Promise<void> {
  await assertAdmin();
  const f = parseForm(formData);
  // descarregos e receita são o mínimo de um total do dia; peso pode ser 0.
  if (!f.data || !f.descarregos || !f.receita) return;
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento_diario").insert(toRow(f));
  if (error) throw new Error(error.message);
  revalidar();
}

export async function editarTotalDiario(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const f = parseForm(formData);
  if (!id || !f.data || !f.descarregos || !f.receita) return;
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento_diario").update(toRow(f)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}

export async function removerTotalDiario(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento_diario").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}
```

- [ ] **Step 3: Somar os totais diários no `receitaTotalDoMes`** (`receitas.ts` linha 41-55)

Substituir o corpo para incluir a terceira origem:

```ts
export async function receitaTotalDoMes(mes: string): Promise<number> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const [descarregamento, diarios, diversas] = await Promise.all([
    supabase.from("receitas_descarregamento").select("receita").gte("data", inicio).lte("data", fim),
    supabase.from("receitas_descarregamento_diario").select("receita").gte("data", inicio).lte("data", fim),
    totalDiversasDoMes(mes),
  ]);
  if (descarregamento.error) throw new Error(descarregamento.error.message);
  if (diarios.error) throw new Error(diarios.error.message);
  const somaDesc = (descarregamento.data ?? []).reduce((t, r) => t + Number(r.receita), 0);
  const somaDiarios = (diarios.data ?? []).reduce((t, r) => t + Number(r.receita), 0);
  return somaDesc + somaDiarios + diversas;
}
```

- [ ] **Step 4: Somar os totais diários no `serieReceitasMensais`** (`receitas.ts` linha 61-80)

```ts
export async function serieReceitasMensais(qtd = 12): Promise<{ mes: string; valor: number }[]> {
  const supabase = await createClient();
  const [desc, diarios, diversas] = await Promise.all([
    supabase.from("receitas_descarregamento").select("data, receita"),
    supabase.from("receitas_descarregamento_diario").select("data, receita"),
    serieDiversasMensais(),
  ]);
  if (desc.error) throw new Error(desc.error.message);
  if (diarios.error) throw new Error(diarios.error.message);
  const porMes = new Map<string, number>();
  for (const r of desc.data ?? []) {
    const mes = primeiroDiaDoMes(String(r.data));
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(r.receita));
  }
  for (const r of diarios.data ?? []) {
    const mes = primeiroDiaDoMes(String(r.data));
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(r.receita));
  }
  for (const d of diversas) {
    porMes.set(d.mes, (porMes.get(d.mes) ?? 0) + d.valor);
  }
  return [...porMes.entries()]
    .map(([mes, valor]) => ({ mes, valor }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .slice(-qtd);
}
```

- [ ] **Step 5: Typecheck/lint**

Run: `npm run lint`
Expected: sem erros nos arquivos tocados.

- [ ] **Step 6: Commit**

```bash
git add src/data/receitas-diario.ts src/data/receitas.ts
git commit -m "feat(receitas): dados do total do dia e soma no custo líquido"
```

---

### Task 5: Formulário `total-diario-form.tsx`

**Files:**
- Create: `src/app/(app)/receitas/total-diario-form.tsx`

**Interfaces:**
- Consumes: `criarTotalDiario`/`editarTotalDiario` (Task 4), `TotalDiarioDescarregamento` (Task 2), `formatBRL`, `toneladas`.
- Produces: `<TotalDiarioForm mes={string} total?={TotalDiarioDescarregamento} />`.

- [ ] **Step 1: Criar o componente**

Espelha `descarregamento-form.tsx` (mesmo `field`, mesmo botão navy, mesma lógica de `dataPadrao`), mas com só 4 campos e sem cálculo de mínimo — o valor é digitado.

```tsx
"use client";

import { useState } from "react";
import { criarTotalDiario, editarTotalDiario } from "@/data/receitas-diario";
import { toneladas } from "@/domain/receitas-metrics";
import { formatBRL } from "@/domain/format";
import type { TotalDiarioDescarregamento } from "@/domain/types";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function TotalDiarioForm({ mes, total }: { mes: string; total?: TotalDiarioDescarregamento }) {
  const [aberto, setAberto] = useState(false);
  const [peso, setPeso] = useState(total?.pesoKg ?? 0);
  const [valor, setValor] = useState(total?.receita ?? 0);

  if (!aberto) {
    return total ? (
      <button onClick={() => setAberto(true)} className="text-sm font-medium text-slate-500 hover:text-[#141a4d]">
        editar
      </button>
    ) : (
      <button
        onClick={() => setAberto(true)}
        className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]"
      >
        Lançar total do dia
      </button>
    );
  }

  const hoje = new Date().toLocaleDateString("en-CA"); // "yyyy-mm-dd" no fuso local
  const dataPadrao = total?.data ?? (hoje.slice(0, 7) === mes.slice(0, 7) ? hoje : mes);

  return (
    <form
      action={total ? editarTotalDiario : criarTotalDiario}
      className="flex flex-wrap items-end gap-2 text-sm"
    >
      {total && <input type="hidden" name="id" value={total.id} />}
      <input name="data" type="date" required defaultValue={dataPadrao} className={field} />
      <input
        name="descarregos"
        type="number"
        step="1"
        min="1"
        required
        placeholder="Nº descarregos"
        defaultValue={total?.descarregos || ""}
        className={field}
      />
      <input
        name="peso_kg"
        type="number"
        step="0.001"
        min="0"
        required
        placeholder="Peso total (kg)"
        value={peso || ""}
        onChange={(e) => setPeso(Number(e.target.value))}
        className={field}
      />
      <input
        name="receita"
        type="number"
        step="0.01"
        min="0"
        required
        placeholder="Valor total (R$)"
        value={valor || ""}
        onChange={(e) => setValor(Number(e.target.value))}
        className={field}
      />
      <input name="observacao" defaultValue={total?.observacao ?? ""} placeholder="Observação" className={field} />
      <span className="px-2 py-2 text-sm font-semibold text-emerald-700">
        {toneladas(peso || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t → {valor ? formatBRL(valor) : "—"}
      </span>
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">
        {total ? "Salvar" : "Adicionar"}
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50"
      >
        Cancelar
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(app\)/receitas/total-diario-form.tsx
git commit -m "feat(receitas): formulário de lançamento do total do dia"
```

---

### Task 6: `page.tsx` — carregar totais, alimentar métricas e editar/remover na vista Simples

**Files:**
- Modify: `src/app/(app)/receitas/page.tsx`

**Interfaces:**
- Consumes: `listarTotaisDiariosDoMes`, `removerTotalDiario` (Task 4), `TotalDiarioForm` (Task 5), `receitaPorDia`/`resumoReceitas` estendidos (Task 2), `TotalDiarioDescarregamento`.

- [ ] **Step 1: Imports**

Adicionar no topo (o tipo `DescarregamentoTipo` já é importado na linha 15; `totaisVisiveis` é inferido do retorno de `listarTotaisDiariosDoMes`, então não precisa importar `TotalDiarioDescarregamento` aqui — importá-lo sem uso quebraria o lint):

```ts
import { listarTotaisDiariosDoMes, removerTotalDiario } from "@/data/receitas-diario";
import { TotalDiarioForm } from "./total-diario-form";
```

- [ ] **Step 2: Carregar os totais e derivar as visíveis**

No `Promise.all` (linha 88-96), acrescentar a consulta:

```ts
  const [receitas, fornecedores, precos, config, serie, admin, diversas, totais] = await Promise.all([
    listarReceitasDoMes(mes, filtros),
    listarFornecedores(),
    listarPrecos(),
    lerConfig(),
    serieReceitasMensais(),
    isAdmin(),
    listarDiversasDoMes(mes),
    listarTotaisDiariosDoMes(mes),
  ]);
```

Logo após a linha `const diversasVisiveis = filtrandoDescarregamento ? [] : diversas;` (linha 104), adicionar — totais do dia não têm fornecedor/tipo, então saem do recorte pela mesma razão que as diversas:

```ts
  const totaisVisiveis = filtrandoDescarregamento ? [] : totais;
```

- [ ] **Step 3: Alimentar as métricas com os totais**

Substituir as linhas 106 e 109:

```ts
  const resumo = resumoReceitas(receitas, diversasVisiveis, totaisVisiveis);
```
```ts
  const porDia = receitaPorDia(receitas, totaisVisiveis);
```

Após a linha do `pesoTotalKg` (linha 113), derivar a contagem de descarregos do mês somando as duas origens (a contagem antiga `receitas.length` ignora os totais do dia):

```ts
  const descarregosTotal = porDia.reduce((t, d) => t + d.descarregos, 0);
```

- [ ] **Step 4: Card "Descarregamento" refletir a contagem consolidada**

No `StatCard` "Descarregamento" (linha ~136), trocar o hint:

```tsx
        <StatCard
          label="Descarregamento"
          value={formatBRL(resumo.totalDescarregamento)}
          hint={`${descarregosTotal} descarregos · ${fmtTon(resumo.toneladas)}`}
          accent="green"
        />
```

- [ ] **Step 5: Form "Lançar total do dia" no cabeçalho da vista Simples**

No cabeçalho da seção "Descarregamentos do mês" (linha ~197-200), mostrar o form só na vista Simples e para admin, ao lado do `SeletorVista`:

```tsx
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Descarregamentos do mês</SectionTitle>
          <div className="flex flex-wrap items-center gap-3">
            {admin && vista === "simples" && <TotalDiarioForm mes={mes} />}
            <SeletorVista mes={mes} filtros={filtros} vista={vista} />
          </div>
        </div>
```

- [ ] **Step 6: Editar/remover nas linhas de origem "total" da tabela Simples**

Na tabela Simples (bloco `vista === "simples"`, linha ~204-241):

1. No `<thead>`, adicionar uma coluna de ações só para admin, após "Receita":
```tsx
                    <th className="px-5 py-3 font-semibold">Receita</th>
                    {admin && <th className="px-5 py-3"></th>}
```
2. No `<tbody>`, na célula de "Descarregos", marcar a origem "total" com um rótulo discreto (navy, nunca verde) e adicionar a célula de ações:
```tsx
                    <tr key={d.id ?? d.data} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-500">{formatDataBR(d.data)}</td>
                      <td className="px-5 py-3 tabular-nums font-medium text-[#141a4d]">
                        {d.descarregos}
                        {d.origem === "total" && (
                          <span className="ml-2 align-middle text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                            total do dia
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-600">
                        {formatKg(d.pesoKg)} <span className="text-slate-400">({fmtTon(toneladas(d.pesoKg))})</span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap font-semibold tabular-nums text-emerald-700">{formatBRL(d.receita)}</td>
                      {admin && (
                        <td className="px-5 py-3">
                          {d.origem === "total" && d.id ? (
                            <div className="flex flex-col items-end gap-2">
                              <TotalDiarioForm mes={mes} total={totaisVisiveis.find((t) => t.id === d.id)} />
                              <form action={removerTotalDiario.bind(null, d.id)}>
                                <button className="text-sm font-medium text-rose-600 hover:text-rose-700">remover</button>
                              </form>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">detalhado</span>
                          )}
                        </td>
                      )}
                    </tr>
```
   (a chave da linha passa a `d.id ?? d.data` porque um dia misto tem duas linhas com a mesma data.)
3. No `<tfoot>`, a contagem do mês passa a `descarregosTotal`, e a coluna de ações ganha uma célula vazia quando admin:
```tsx
                    <td className="px-5 py-3 tabular-nums font-semibold text-[#141a4d]">{descarregosTotal}</td>
```
   e, ao final da linha do rodapé, antes de fechar `</tr>`:
```tsx
                    {admin && <td className="px-5 py-3"></td>}
```

- [ ] **Step 7: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros; build conclui.

- [ ] **Step 8: Verificação visual** (requer a migration da Task 1 aplicada)

Subir o dev server (via preview_start com o dev server do projeto), abrir `/receitas?vista=simples`, e conferir:
- Botão "Lançar total do dia" aparece na vista Simples (admin).
- Lançar data · nº descarregos · peso · valor cria uma linha rotulada "total do dia" com editar/remover.
- Card "Descarregamento", peso e "Valor médio/tonelada" incluem o total lançado.
- Vista Detalhado não mostra o botão do total do dia; linhas detalhadas na Simples mostram "detalhado" (sem editar/remover).

Capturar screenshot para o Pedro.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/receitas/page.tsx
git commit -m "feat(receitas): lançar e editar o total do dia na vista Simples"
```

---

### Task 7: Export CSV inclui os totais diários

**Files:**
- Modify: `src/app/(app)/receitas/export/route.ts`

**Interfaces:**
- Consumes: `listarTotaisDiariosDoMes` (Task 4), `toneladas`.

- [ ] **Step 1: Buscar e emitir os totais diários**

Importar no topo:

```ts
import { listarTotaisDiariosDoMes } from "@/data/receitas-diario";
```

No `Promise.all` (linha 19-22), acrescentar a busca; e, como fornecedor/tipo são exclusivos do detalhado, o total do dia sai do recorte quando há filtro — mesma regra das diversas:

```ts
  const [receitas, diversas, totais] = await Promise.all([
    listarReceitasDoMes(mes, { fornecedorId, tipo }),
    listarDiversasDoMes(mes),
    listarTotaisDiariosDoMes(mes),
  ]);
```

Após `const diversasVisiveis = filtrandoDescarregamento ? [] : diversas;` (linha 29):

```ts
  const totaisVisiveis = filtrandoDescarregamento ? [] : totais;
```

Após o bloco `linhasDiv` (linha ~67), adicionar as linhas do total do dia. O nº de descarregos vai na coluna "Quantidade" (a que as diversas usam para a quantidade); fornecedor/tipo/preço/mínimo ficam vazios:

```ts
  const linhasDiario = totaisVisiveis.map((t) => ({
    data: t.data,
    campos: [
      "Total do dia",
      t.data,
      "",                        // Fornecedor
      num(t.pesoKg),             // Peso (kg)
      num(toneladas(t.pesoKg)),  // Peso (t)
      "",                        // Tipo
      "",                        // Preço/ton
      "",                        // Mínimo aplicado
      "",                        // Material
      String(t.descarregos),     // Quantidade → nº de descarregos
      "",                        // Preço unitário
      num(t.receita),            // Valor
    ],
  }));
```

Incluir no merge final (linha ~69):

```ts
  const linhas = [...linhasDesc, ...linhasDiv, ...linhasDiario]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((l) => l.campos.join(";"));
```

- [ ] **Step 2: Lint + build**

Run: `npm run lint && npm run build`
Expected: sem erros.

- [ ] **Step 3: Verificação** (requer migration aplicada + ao menos 1 total lançado)

Baixar `/receitas/export?mes=<mes-atual>` e conferir que há uma linha "Total do dia" com Peso, Peso(t), Quantidade (= descarregos) e Valor preenchidos, fornecedor/tipo vazios.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/receitas/export/route.ts
git commit -m "feat(receitas): CSV inclui os totais do dia"
```

---

## Notas de verificação final

- `npm test` — toda a suíte verde (domínio + mappers).
- `npm run lint && npm run build` — sem erros.
- Verificação visual (Tasks 6 e 7) depende da migration `0013` aplicada no Supabase pelo Pedro.
- Custo líquido: conferir no dashboard (`/`) e em `/custos` que a receita do mês subiu pelo valor do total lançado (funil `receitaTotalDoMes`).

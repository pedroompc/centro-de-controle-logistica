# Receitas Logísticas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova aba Receitas Logísticas para registrar receitas de descarregamento (peso × preço/ton), com indicadores, relatório CSV e integração ao resultado logístico (custos brutos − receitas = líquido).

**Architecture:** Segue os padrões do módulo de custos: schema Postgres via migration Supabase (RLS read=logado/write=admin), tipos puros em `domain/`, cálculo centralizado no backend (`data/*.ts` com `"use server"` + `assertAdmin` + `revalidatePath`), UI em Server Components reutilizando `components/ui.tsx`. Cálculo puro e testado em `domain/receitas-metrics.ts`.

**Tech Stack:** Next.js 16 (App Router, Server Actions), Supabase (Postgres + RLS), TypeScript, Vitest, Tailwind.

## Global Constraints

- Dinheiro em `numeric` no banco; `Number` no JS; arredondar a 2 casas no cálculo centralizado (backend).
- Snapshot imutável: cada lançamento congela `preco_por_tonelada` e `receita`.
- RLS: leitura = qualquer logado; escrita = `is_admin()`. Backend chama `assertAdmin()` antes de escrever.
- Preço/ton é GLOBAL por tipo (batido/paletizado). Fornecedor é cadastro próprio.
- Período por mês (`?mes=YYYY-MM-01`, navegação ◀ ▶), consistente com Custos/Tendências.
- Peso canônico em kg; toneladas = kg/1000.
- Reutilizar `Card`, `PageHeader`, `SectionTitle`, `StatCard`, `HeroStat`, `BarList`, `Pill`, `BackLink` e `formatBRL/formatKg/formatPercent/formatDataBR`.

---

### Task 1: Migration do schema

**Files:**
- Create: `supabase/migrations/0006_receitas.sql`

**Interfaces:**
- Produces: tabelas `fornecedores`, `precos_descarregamento`, `receitas_descarregamento`; enum `descarregamento_tipo`.

- [ ] **Step 1: Escrever a migration**

```sql
create type descarregamento_tipo as enum ('batido', 'paletizado');

create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table precos_descarregamento (
  tipo descarregamento_tipo primary key,
  preco_por_tonelada numeric(14,2) not null default 0,
  atualizado_em timestamptz not null default now()
);
insert into precos_descarregamento (tipo, preco_por_tonelada)
  values ('batido', 0), ('paletizado', 0);

create table receitas_descarregamento (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  fornecedor_id uuid not null references fornecedores(id),
  peso_kg numeric(14,3) not null default 0,
  tipo descarregamento_tipo not null,
  preco_por_tonelada numeric(14,2) not null,
  receita numeric(14,2) not null,
  observacao text,
  created_at timestamptz not null default now()
);
create index receitas_desc_data_idx on receitas_descarregamento(data);
create index receitas_desc_fornecedor_idx on receitas_descarregamento(fornecedor_id);

alter table fornecedores enable row level security;
alter table precos_descarregamento enable row level security;
alter table receitas_descarregamento enable row level security;

create policy "read fornecedores" on fornecedores for select to authenticated using (true);
create policy "write fornecedores" on fornecedores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "read precos_descarregamento" on precos_descarregamento for select to authenticated using (true);
create policy "write precos_descarregamento" on precos_descarregamento for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "read receitas_descarregamento" on receitas_descarregamento for select to authenticated using (true);
create policy "write receitas_descarregamento" on receitas_descarregamento for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 2: Aplicar no Supabase** (manual — Pedro roda no SQL Editor ou via CLI). Verificar que as 3 tabelas existem e `precos_descarregamento` tem 2 linhas.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0006_receitas.sql
git commit -m "feat: schema de receitas logísticas (fornecedores, preços, descarregamentos)"
```

---

### Task 2: Tipos de domínio

**Files:**
- Modify: `src/domain/types.ts` (append)

**Interfaces:**
- Produces: `DescarregamentoTipo`, `Fornecedor`, `PrecoDescarregamento`, `Receita`.

- [ ] **Step 1: Adicionar os tipos ao fim de `src/domain/types.ts`**

```ts
export type DescarregamentoTipo = "batido" | "paletizado";

export interface Fornecedor {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface PrecoDescarregamento {
  tipo: DescarregamentoTipo;
  precoPorTonelada: number;
}

export interface Receita {
  id: string;
  data: string; // ISO "yyyy-mm-dd"
  fornecedorId: string;
  fornecedorNome: string;
  pesoKg: number;
  tipo: DescarregamentoTipo;
  precoPorTonelada: number;
  receita: number;
  observacao: string | null;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/domain/types.ts
git commit -m "feat: tipos de domínio de receitas logísticas"
```

---

### Task 3: Cálculo puro + testes (TDD)

**Files:**
- Create: `src/domain/receitas-metrics.ts`
- Test: `src/domain/receitas-metrics.test.ts`

**Interfaces:**
- Consumes: `Receita`, `DescarregamentoTipo` de `@/domain/types`.
- Produces:
  - `toneladas(pesoKg: number): number`
  - `arredonda2(n: number): number`
  - `calcularReceita(pesoKg: number, precoPorTonelada: number): number`
  - `receitaTotal(rs: Receita[]): number`
  - `toneladasTotal(rs: Receita[]): number`
  - `valorMedioPorTonelada(rs: Receita[]): number`
  - `receitaPorFornecedor(rs: Receita[]): { fornecedorId: string; nome: string; valor: number }[]`
  - `receitaPorTipo(rs: Receita[]): { batido: number; paletizado: number }`
  - `custoLiquido(custosBrutos: number, receitas: number): number`

- [ ] **Step 1: Escrever o teste que falha**

```ts
import { describe, it, expect } from "vitest";
import {
  toneladas, calcularReceita, arredonda2, receitaTotal, toneladasTotal,
  valorMedioPorTonelada, receitaPorFornecedor, receitaPorTipo, custoLiquido,
} from "./receitas-metrics";
import type { Receita } from "./types";

const r = (over: Partial<Receita>): Receita => ({
  id: "x", data: "2026-07-10", fornecedorId: "f1", fornecedorNome: "Forn 1",
  pesoKg: 1000, tipo: "batido", precoPorTonelada: 20, receita: 20, observacao: null, ...over,
});

describe("receitas-metrics", () => {
  it("converte kg para toneladas", () => {
    expect(toneladas(12500)).toBe(12.5);
  });

  it("calcula receita = toneladas × preço, 2 casas (exemplo do spec)", () => {
    expect(calcularReceita(12500, 20)).toBe(250);
  });

  it("arredonda a receita a centavos", () => {
    // 1234 kg = 1,234 t × 33,33 = 41,12922 → 41,13
    expect(calcularReceita(1234, 33.33)).toBe(41.13);
    expect(arredonda2(41.129)).toBe(41.13);
  });

  it("soma receita total e toneladas totais", () => {
    const rs = [r({ receita: 250, pesoKg: 12500 }), r({ receita: 100, pesoKg: 5000 })];
    expect(receitaTotal(rs)).toBe(350);
    expect(toneladasTotal(rs)).toBe(17.5);
  });

  it("valor médio por tonelada = receita total / toneladas totais", () => {
    const rs = [r({ receita: 250, pesoKg: 12500 }), r({ receita: 100, pesoKg: 5000 })];
    expect(valorMedioPorTonelada(rs)).toBe(20);
    expect(valorMedioPorTonelada([])).toBe(0);
  });

  it("agrupa receita por fornecedor, desc", () => {
    const rs = [
      r({ fornecedorId: "a", fornecedorNome: "A", receita: 100 }),
      r({ fornecedorId: "b", fornecedorNome: "B", receita: 300 }),
      r({ fornecedorId: "a", fornecedorNome: "A", receita: 50 }),
    ];
    expect(receitaPorFornecedor(rs)).toEqual([
      { fornecedorId: "b", nome: "B", valor: 300 },
      { fornecedorId: "a", nome: "A", valor: 150 },
    ]);
  });

  it("agrupa receita por tipo", () => {
    const rs = [r({ tipo: "batido", receita: 100 }), r({ tipo: "paletizado", receita: 40 }), r({ tipo: "batido", receita: 10 })];
    expect(receitaPorTipo(rs)).toEqual({ batido: 110, paletizado: 40 });
  });

  it("custo líquido = brutos − receitas", () => {
    expect(custoLiquido(50000, 8000)).toBe(42000);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- receitas-metrics`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/domain/receitas-metrics.ts`**

```ts
import type { Receita, DescarregamentoTipo } from "./types";

export function arredonda2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toneladas(pesoKg: number): number {
  return pesoKg / 1000;
}

export function calcularReceita(pesoKg: number, precoPorTonelada: number): number {
  return arredonda2(toneladas(pesoKg) * precoPorTonelada);
}

export function receitaTotal(rs: Receita[]): number {
  return arredonda2(rs.reduce((t, r) => t + r.receita, 0));
}

export function toneladasTotal(rs: Receita[]): number {
  return arredonda2(rs.reduce((t, r) => t + toneladas(r.pesoKg), 0));
}

export function valorMedioPorTonelada(rs: Receita[]): number {
  const tons = toneladasTotal(rs);
  return tons === 0 ? 0 : arredonda2(receitaTotal(rs) / tons);
}

export function receitaPorFornecedor(rs: Receita[]): { fornecedorId: string; nome: string; valor: number }[] {
  const mapa = new Map<string, { fornecedorId: string; nome: string; valor: number }>();
  for (const r of rs) {
    const atual = mapa.get(r.fornecedorId) ?? { fornecedorId: r.fornecedorId, nome: r.fornecedorNome, valor: 0 };
    atual.valor = arredonda2(atual.valor + r.receita);
    mapa.set(r.fornecedorId, atual);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

export function receitaPorTipo(rs: Receita[]): { batido: number; paletizado: number } {
  const acc = { batido: 0, paletizado: 0 };
  for (const r of rs) acc[r.tipo] = arredonda2(acc[r.tipo] + r.receita);
  return acc;
}

export function custoLiquido(custosBrutos: number, receitas: number): number {
  return arredonda2(custosBrutos - receitas);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test -- receitas-metrics`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add src/domain/receitas-metrics.ts src/domain/receitas-metrics.test.ts
git commit -m "feat: cálculo puro de receitas logísticas (com testes)"
```

---

### Task 4: Mappers

**Files:**
- Modify: `src/data/mappers.ts` (append + import)

**Interfaces:**
- Consumes: `Fornecedor`, `PrecoDescarregamento`, `Receita`, `DescarregamentoTipo`.
- Produces: `mapFornecedor(row)`, `mapPreco(row)`, `mapReceita(row)`.

- [ ] **Step 1: Adicionar ao import de tipos e ao fim de `src/data/mappers.ts`**

No import do topo, acrescente `Fornecedor, PrecoDescarregamento, Receita, DescarregamentoTipo`.

```ts
export function mapFornecedor(row: { id: string; nome: string; ativo: boolean }): Fornecedor {
  return { id: row.id, nome: row.nome, ativo: row.ativo };
}

export function mapPreco(row: {
  tipo: string; preco_por_tonelada: string | number;
}): PrecoDescarregamento {
  return { tipo: row.tipo as DescarregamentoTipo, precoPorTonelada: Number(row.preco_por_tonelada) };
}

export function mapReceita(row: {
  id: string; data: string; fornecedor_id: string;
  fornecedores?: { nome: string } | { nome: string }[] | null;
  peso_kg: string | number; tipo: string;
  preco_por_tonelada: string | number; receita: string | number; observacao: string | null;
}): Receita {
  const forn = Array.isArray(row.fornecedores) ? row.fornecedores[0] : row.fornecedores;
  return {
    id: row.id,
    data: row.data,
    fornecedorId: row.fornecedor_id,
    fornecedorNome: forn?.nome ?? "—",
    pesoKg: Number(row.peso_kg),
    tipo: row.tipo as DescarregamentoTipo,
    precoPorTonelada: Number(row.preco_por_tonelada),
    receita: Number(row.receita),
    observacao: row.observacao,
  };
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: mappers de fornecedores/preços/receitas"`

---

### Task 5: Data — fornecedores

**Files:**
- Create: `src/data/fornecedores.ts`

**Interfaces:**
- Consumes: `createClient`, `assertAdmin`, `mapFornecedor`.
- Produces: `listarFornecedores(): Promise<Fornecedor[]>`, `criarFornecedor(fd)`, `editarFornecedor(fd)`, `encerrarFornecedor(id)`.

- [ ] **Step 1: Implementar** (padrão de `src/data/custos-fixos.ts`)

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapFornecedor } from "./mappers";
import { assertAdmin } from "./auth";
import type { Fornecedor } from "@/domain/types";

export async function listarFornecedores(): Promise<Fornecedor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fornecedores").select("id, nome, ativo").eq("ativo", true).order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFornecedor);
}

export async function criarFornecedor(formData: FormData): Promise<void> {
  await assertAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").insert({ nome });
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/fornecedores");
  revalidatePath("/receitas");
}

export async function editarFornecedor(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update({ nome }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/fornecedores");
  revalidatePath("/receitas");
}

export async function encerrarFornecedor(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update({ ativo: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/fornecedores");
  revalidatePath("/receitas");
}
```

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: data layer de fornecedores"`

---

### Task 6: Data — preços de descarregamento

**Files:**
- Create: `src/data/precos-descarregamento.ts`

**Interfaces:**
- Produces: `listarPrecos(): Promise<PrecoDescarregamento[]>`, `precoDoTipo(tipo): Promise<number>`, `editarPreco(fd)`.

- [ ] **Step 1: Implementar**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapPreco } from "./mappers";
import { assertAdmin } from "./auth";
import type { PrecoDescarregamento, DescarregamentoTipo } from "@/domain/types";

export async function listarPrecos(): Promise<PrecoDescarregamento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("precos_descarregamento").select("tipo, preco_por_tonelada").order("tipo");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPreco);
}

export async function precoDoTipo(tipo: DescarregamentoTipo): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("precos_descarregamento").select("preco_por_tonelada").eq("tipo", tipo).maybeSingle();
  if (error) throw new Error(error.message);
  return Number(data?.preco_por_tonelada ?? 0);
}

export async function editarPreco(formData: FormData): Promise<void> {
  await assertAdmin();
  const tipo = String(formData.get("tipo") ?? "") as DescarregamentoTipo;
  const raw = formData.get("preco");
  if (!tipo || raw === null || String(raw).trim() === "") return;
  const preco = Number(raw);
  if (Number.isNaN(preco)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("precos_descarregamento")
    .update({ preco_por_tonelada: preco, atualizado_em: new Date().toISOString() })
    .eq("tipo", tipo);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/precos");
  revalidatePath("/receitas");
}
```

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: data layer de preços de descarregamento"`

---

### Task 7: Data — receitas (CRUD + cálculo centralizado)

**Files:**
- Create: `src/data/receitas.ts`

**Interfaces:**
- Consumes: `calcularReceita` de `@/domain/receitas-metrics`; `mapReceita`; `precoDoTipo`.
- Produces: `listarReceitasDoMes(mes, filtros?)`, `criarReceita(fd)`, `editarReceita(fd)`, `removerReceita(id)`, `receitaTotalDoMes(mes): Promise<number>`, `serieReceitasMensais(qtd): Promise<{mes,valor}[]>`.

- [ ] **Step 1: Implementar**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapReceita } from "./mappers";
import { assertAdmin } from "./auth";
import { calcularReceita } from "@/domain/receitas-metrics";
import { inicioFimDoMes, primeiroDiaDoMes } from "@/domain/periodo";
import type { Receita, DescarregamentoTipo } from "@/domain/types";

const COLS = "id, data, fornecedor_id, peso_kg, tipo, preco_por_tonelada, receita, observacao, fornecedores(nome)";

export interface FiltrosReceita { fornecedorId?: string; tipo?: DescarregamentoTipo }

export async function listarReceitasDoMes(mes: string, filtros: FiltrosReceita = {}): Promise<Receita[]> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  let q = supabase.from("receitas_descarregamento").select(COLS)
    .gte("data", inicio).lte("data", fim).order("data", { ascending: false });
  if (filtros.fornecedorId) q = q.eq("fornecedor_id", filtros.fornecedorId);
  if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapReceita);
}

export async function receitaTotalDoMes(mes: string): Promise<number> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const { data, error } = await supabase.from("receitas_descarregamento")
    .select("receita").gte("data", inicio).lte("data", fim);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((t, r) => t + Number(r.receita), 0);
}

export async function serieReceitasMensais(qtd = 12): Promise<{ mes: string; valor: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("receitas_descarregamento").select("data, receita");
  if (error) throw new Error(error.message);
  const porMes = new Map<string, number>();
  for (const r of data ?? []) {
    const mes = primeiroDiaDoMes(String(r.data));
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(r.receita));
  }
  return [...porMes.entries()].map(([mes, valor]) => ({ mes, valor }))
    .sort((a, b) => a.mes.localeCompare(b.mes)).slice(-qtd);
}

function parseForm(formData: FormData) {
  const data = String(formData.get("data") ?? "").trim();
  const fornecedorId = String(formData.get("fornecedor_id") ?? "");
  const pesoKg = Number(formData.get("peso_kg") ?? 0);
  const tipo = String(formData.get("tipo") ?? "batido") as DescarregamentoTipo;
  const precoPorTonelada = Number(formData.get("preco_por_tonelada") ?? 0);
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  return { data, fornecedorId, pesoKg, tipo, precoPorTonelada, observacao };
}

export async function criarReceita(formData: FormData): Promise<void> {
  await assertAdmin();
  const f = parseForm(formData);
  if (!f.data || !f.fornecedorId || !f.pesoKg) return;
  const receita = calcularReceita(f.pesoKg, f.precoPorTonelada); // cálculo no backend
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento").insert({
    data: f.data, fornecedor_id: f.fornecedorId, peso_kg: f.pesoKg, tipo: f.tipo,
    preco_por_tonelada: f.precoPorTonelada, receita, observacao: f.observacao,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/receitas"); revalidatePath("/custos"); revalidatePath("/");
}

export async function editarReceita(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const f = parseForm(formData);
  if (!id || !f.data || !f.fornecedorId || !f.pesoKg) return;
  const receita = calcularReceita(f.pesoKg, f.precoPorTonelada);
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento").update({
    data: f.data, fornecedor_id: f.fornecedorId, peso_kg: f.pesoKg, tipo: f.tipo,
    preco_por_tonelada: f.precoPorTonelada, receita, observacao: f.observacao,
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas"); revalidatePath("/custos"); revalidatePath("/");
}

export async function removerReceita(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas"); revalidatePath("/custos"); revalidatePath("/");
}
```

Nota: confirmar que `inicioFimDoMes(mes)` existe em `@/domain/periodo` (usado em `faturamento-mensal.ts`) e retorna `{ inicio, fim }` ISO "yyyy-mm-dd". Se `inicio/fim` forem outra convenção, ajustar as comparações `gte/lte`.

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: data layer de receitas (CRUD + cálculo centralizado)"`

---

### Task 8: Data — custo bruto do mês (para o consolidado)

**Files:**
- Create: `src/data/resultado-logistico.ts`

**Interfaces:**
- Consumes: `listarLancamentosDoMes` (`@/data/custos-mensais`), `listarFuncionarios` (`@/data/funcionarios`), `custoTotalAtivos` (`@/domain/metrics`), `somaLancamentos` (`@/domain/custos-metrics`), `receitaTotalDoMes`, `custoLiquido`.
- Produces: `resultadoLogisticoDoMes(mes): Promise<{ brutos: number; receitas: number; liquido: number }>`.

- [ ] **Step 1: Implementar**

```ts
import { listarLancamentosDoMes } from "./custos-mensais";
import { listarFuncionarios } from "./funcionarios";
import { receitaTotalDoMes } from "./receitas";
import { custoTotalAtivos } from "@/domain/metrics";
import { somaLancamentos } from "@/domain/custos-metrics";
import { custoLiquido } from "@/domain/receitas-metrics";

export async function resultadoLogisticoDoMes(mes: string): Promise<{ brutos: number; receitas: number; liquido: number }> {
  const [lancamentos, funcionarios, receitas] = await Promise.all([
    listarLancamentosDoMes(mes), listarFuncionarios(), receitaTotalDoMes(mes),
  ]);
  const salario = custoTotalAtivos(funcionarios);
  const brutos = salario + somaLancamentos(lancamentos, "fixo") + somaLancamentos(lancamentos, "variavel");
  return { brutos, receitas, liquido: custoLiquido(brutos, receitas) };
}
```

Nota: confirmar assinaturas de `custoTotalAtivos` e `somaLancamentos` (usadas em `custos/page.tsx`). Se `somaLancamentos(lancamentos, "fixo")` não existir com essa assinatura, reproduzir a soma como na página de custos.

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: cálculo do resultado logístico do mês"`

---

### Task 9: UI — cadastro de fornecedores

**Files:**
- Create: `src/app/(app)/receitas/fornecedores/page.tsx`
- Create: `src/app/(app)/receitas/fornecedores/fornecedor-form.tsx`

**Interfaces:**
- Consumes: `listarFornecedores`, `criarFornecedor`, `editarFornecedor`, `encerrarFornecedor`, `isAdmin`.

- [ ] **Step 1: Form (client)** — `fornecedor-form.tsx` (padrão de `custo-fixo-form.tsx`)

```tsx
"use client";
import { criarFornecedor } from "@/data/fornecedores";
const field = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";
export function FornecedorForm() {
  return (
    <form action={criarFornecedor} className="flex flex-wrap items-end gap-2 text-sm">
      <input name="nome" required placeholder="Nome do fornecedor" className={field} />
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">Adicionar</button>
    </form>
  );
}
```

- [ ] **Step 2: Página** — `fornecedores/page.tsx` (padrão de `custos/fixos/page.tsx`: `BackLink href="/receitas"`, `PageHeader` com `FornecedorForm` se admin, tabela com editar-nome inline (form `editarFornecedor`) e "encerrar" (`encerrarFornecedor.bind(null, f.id)`), estado vazio "Nenhum fornecedor cadastrado.").

- [ ] **Step 3: Typecheck** → sem erros.
- [ ] **Step 4: Commit** — `git commit -am "feat: tela de cadastro de fornecedores"`

---

### Task 10: UI — configuração de preços

**Files:**
- Create: `src/app/(app)/receitas/precos/page.tsx`
- Create: `src/app/(app)/receitas/precos/preco-form.tsx`

**Interfaces:**
- Consumes: `listarPrecos`, `editarPreco`, `isAdmin`.

- [ ] **Step 1: Página + form** — lista os 2 preços (batido/paletizado). Cada linha: label do tipo + input `preco` + hidden `tipo` + botão salvar (form `action={editarPreco}`), só se admin; senão mostra `formatBRL`. `BackLink href="/receitas"`, `PageHeader title="Preços por tonelada" subtitle="Valores globais para batido e paletizado"`.

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: tela de configuração de preços por tonelada"`

---

### Task 11: UI — formulário de lançar/editar descarregamento (client, preview ao vivo)

**Files:**
- Create: `src/app/(app)/receitas/descarregamento-form.tsx`

**Interfaces:**
- Consumes: `criarReceita`, `editarReceita` (`@/data/receitas`), `calcularReceita` (`@/domain/receitas-metrics`), `formatBRL`, `formatKg`.
- Produces: `<DescarregamentoForm fornecedores precos mes receita? />` (receita opcional = modo edição).

- [ ] **Step 1: Implementar** o form client com estado local de peso/tipo/preço e **preview ao vivo** da receita (`calcularReceita`). Campos: `data` (date, default hoje/1º do mês navegado), `fornecedor_id` (select dos fornecedores), `peso_kg` (number), `tipo` (select batido/paletizado — ao mudar, preenche `preco_por_tonelada` com `precos[tipo]`), `preco_por_tonelada` (number, editável, default do config), `observacao` (text). Mostra "Receita: R$ X" e "Peso: Y t" calculados no cliente. `action` = `criarReceita` (ou `editarReceita` com hidden `id` no modo edição). Botão abre/fecha via `useState` (padrão `LancarVariavelForm`).

```tsx
"use client";
import { useState } from "react";
import { criarReceita, editarReceita } from "@/data/receitas";
import { calcularReceita, toneladas } from "@/domain/receitas-metrics";
import { formatBRL } from "@/domain/format";
import type { Fornecedor, PrecoDescarregamento, Receita, DescarregamentoTipo } from "@/domain/types";

const field = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function DescarregamentoForm({ fornecedores, precos, mes, receita }: {
  fornecedores: Fornecedor[]; precos: PrecoDescarregamento[]; mes: string; receita?: Receita;
}) {
  const precoDe = (t: DescarregamentoTipo) => precos.find((p) => p.tipo === t)?.precoPorTonelada ?? 0;
  const [aberto, setAberto] = useState(!!receita);
  const [tipo, setTipo] = useState<DescarregamentoTipo>(receita?.tipo ?? "batido");
  const [peso, setPeso] = useState(receita?.pesoKg ?? 0);
  const [preco, setPreco] = useState(receita?.precoPorTonelada ?? precoDe("batido"));
  const previa = calcularReceita(peso || 0, preco || 0);

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
        Lançar descarregamento
      </button>
    );
  }
  const hoje = new Date().toLocaleDateString("en-CA");
  const dataPadrao = receita?.data ?? (hoje.slice(0, 7) === mes.slice(0, 7) ? hoje : mes);
  return (
    <form action={receita ? editarReceita : criarReceita} className="flex flex-wrap items-end gap-2 text-sm">
      {receita && <input type="hidden" name="id" value={receita.id} />}
      <input name="data" type="date" required defaultValue={dataPadrao} className={field} />
      <select name="fornecedor_id" required defaultValue={receita?.fornecedorId ?? ""} className={field}>
        <option value="" disabled>Fornecedor</option>
        {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
      </select>
      <input name="peso_kg" type="number" step="0.001" min="0" required placeholder="Peso (kg)"
        value={peso || ""} onChange={(e) => setPeso(Number(e.target.value))} className={field} />
      <select name="tipo" value={tipo} onChange={(e) => { const t = e.target.value as DescarregamentoTipo; setTipo(t); setPreco(precoDe(t)); }} className={field}>
        <option value="batido">Batido</option>
        <option value="paletizado">Paletizado</option>
      </select>
      <input name="preco_por_tonelada" type="number" step="0.01" min="0" required placeholder="R$/ton"
        value={preco || ""} onChange={(e) => setPreco(Number(e.target.value))} className={field} />
      <input name="observacao" defaultValue={receita?.observacao ?? ""} placeholder="Observação" className={field} />
      <span className="px-2 py-2 text-sm font-semibold text-emerald-700">
        {toneladas(peso || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t → {formatBRL(previa)}
      </span>
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">
        {receita ? "Salvar" : "Adicionar"}
      </button>
      <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">Cancelar</button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: formulário de descarregamento com prévia ao vivo"`

---

### Task 12: UI — página principal de Receitas

**Files:**
- Create: `src/app/(app)/receitas/page.tsx`

**Interfaces:**
- Consumes: `listarReceitasDoMes`, `listarFornecedores`, `listarPrecos`, `serieReceitasMensais`, `removerReceita` (`@/data/receitas`), métricas de `@/domain/receitas-metrics`, `isAdmin`, componentes UI, `DescarregamentoForm`.

- [ ] **Step 1: Implementar** a página (Server Component) — `searchParams: { mes?, fornecedor?, tipo? }`:
  - Resolve `mes` (default `primeiroDiaDoMes()`), lê filtros.
  - `Promise.all`: receitas do mês (com filtros), fornecedores, preços, admin.
  - `PageHeader title="Receitas Logísticas"` + navegação ◀ ▶ (`/receitas?mes=...` preservando filtros).
  - Indicadores: `HeroStat`/`StatCard` — receita total (`receitaTotal`), toneladas (`toneladasTotal`, `formatKg`/"t"), qtd (`receitas.length`), médio/ton (`valorMedioPorTonelada`, `formatBRL`).
  - `BarList` receita por fornecedor (`receitaPorFornecedor`) e por tipo (`receitaPorTipo`).
  - Filtros: um form GET com selects de fornecedor e tipo (submete via `?fornecedor=&tipo=&mes=`).
  - Botões: `DescarregamentoForm` (se admin), link "Exportar CSV" (`/receitas/export?mes=&fornecedor=&tipo=`), links "Fornecedores" (`/receitas/fornecedores`) e "Preços" (`/receitas/precos`).
  - Tabela: data (`formatDataBR`), fornecedor, peso (kg via `formatKg`), peso (t), tipo (`Pill`), preço/ton (`formatBRL`), receita (`formatBRL`), observação; ações editar (`DescarregamentoForm receita={r}`) e remover (`removerReceita.bind(null, r.id)`) se admin. Estado vazio: "Nenhum descarregamento no período."
  - Comparação mensal: `serieReceitasMensais()` renderizada como `BarList` (ou mini-série no padrão de `tendencias/page.tsx`).

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: página principal de Receitas Logísticas"`

---

### Task 13: UI — export CSV

**Files:**
- Create: `src/app/(app)/receitas/export/route.ts`

**Interfaces:**
- Consumes: `listarReceitasDoMes` (`@/data/receitas`), `toneladas` (`@/domain/receitas-metrics`).

- [ ] **Step 1: Implementar** o route handler GET

```ts
import { NextRequest } from "next/server";
import { listarReceitasDoMes } from "@/data/receitas";
import { toneladas } from "@/domain/receitas-metrics";
import { primeiroDiaDoMes } from "@/domain/periodo";
import type { DescarregamentoTipo } from "@/domain/types";

const esc = (s: string) => `"${s.replace(/"/g, '""')}"`;
const num = (n: number) => String(n).replace(".", ",");

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const mes = sp.get("mes") ? primeiroDiaDoMes(sp.get("mes")!) : primeiroDiaDoMes();
  const fornecedorId = sp.get("fornecedor") || undefined;
  const tipo = (sp.get("tipo") as DescarregamentoTipo) || undefined;
  const receitas = await listarReceitasDoMes(mes, { fornecedorId, tipo });

  const header = ["Data", "Fornecedor", "Peso (kg)", "Peso (t)", "Tipo", "Preço/ton", "Receita"];
  const linhas = receitas.map((r) => [
    r.data, esc(r.fornecedorNome), num(r.pesoKg), num(toneladas(r.pesoKg)),
    r.tipo, num(r.precoPorTonelada), num(r.receita),
  ].join(";"));
  const csv = "﻿" + [header.join(";"), ...linhas].join("\n"); // BOM p/ Excel PT-BR

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="receitas-${mes}.csv"`,
    },
  });
}
```

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: exportação CSV das receitas"`

---

### Task 14: Nav — aba Receitas

**Files:**
- Modify: `src/app/(app)/sidebar-nav.tsx` (array `items`)

- [ ] **Step 1: Adicionar** o item entre "Custos" e "Devoluções":

```tsx
{
  href: "/receitas",
  label: "Receitas",
  icon: (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3v18" />
      <path d="M16 7.5c0-1.4-1.8-2.5-4-2.5S8 6.1 8 7.5 9.8 10 12 10s4 1.1 4 2.5S14.2 15 12 15s-4-1.1-4-2.5" />
    </svg>
  ),
},
```

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: aba Receitas na navegação"`

---

### Task 15: Integração — bloco Resultado Logístico na aba Custos

**Files:**
- Modify: `src/app/(app)/custos/page.tsx`

**Interfaces:**
- Consumes: `resultadoLogisticoDoMes` (`@/data/resultado-logistico`), `formatBRL`.

- [ ] **Step 1: Implementar** — no `CustosPage`, chamar `resultadoLogisticoDoMes(mes)` (adicionar ao `Promise.all` existente) e renderizar um bloco **"Resultado logístico do mês"** após o card de total, com 3 valores distintos:
  - **Custos brutos** (ícone/rótulo em navy, cor neutra) — `formatBRL(brutos)`.
  - **Receitas de descarregamento** (verde, ícone de entrada/seta pra baixo) — `− formatBRL(receitas)`.
  - **Custo líquido após abatimento** (destaque dourado/azul) — `formatBRL(liquido)`.
  - Texto curto: "A receita é demonstrada como compensação; não altera os lançamentos de custo." Link "ver receitas →" para `/receitas`.
  - Usar `Card` + grid; cores via classes Tailwind (ex.: receita `text-emerald-600`, líquido `text-[#141a4d]` em destaque). Deixar brutos e líquido visíveis lado a lado (antes/depois).

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: bloco de resultado logístico (bruto/receita/líquido) na aba Custos"`

---

### Task 16: Integração — Dashboard

**Files:**
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Consumes: `resultadoLogisticoDoMes`, `primeiroDiaDoMes`, `formatBRL`.

- [ ] **Step 1: Implementar** — adicionar ao dashboard um card com o **custo logístico líquido** do mês corrente (e a receita do mês como subtítulo), reutilizando `StatCard`/`HeroStat`. Chamar `resultadoLogisticoDoMes(primeiroDiaDoMes())`.

- [ ] **Step 2: Typecheck** → sem erros.
- [ ] **Step 3: Commit** — `git commit -am "feat: custo logístico líquido no dashboard"`

---

### Task 17: Verificação final

- [ ] **Step 1: Typecheck** — `npx tsc --noEmit` → sem erros.
- [ ] **Step 2: Testes** — `npm test` → todos os testes de receitas passam (a falha pré-existente de `mapCustoMensal`, se ainda houver, é não relacionada).
- [ ] **Step 3: Build** — `npm run build` → build limpo.
- [ ] **Step 4: Verificação no app** (Pedro, após aplicar a migration 0006 no Supabase e `npm run build` + restart): cadastrar fornecedor, configurar preços, lançar descarregamento (conferir 12.500 kg × R$20 = R$250,00), editar, excluir, filtrar, exportar CSV; conferir bloco consolidado na aba Custos e no Dashboard.

---

## Self-Review

**Spec coverage:** data ✓, fornecedor ✓, peso+conversão ✓ (kg canônico, toneladas derivada), tipo batido/paletizado ✓, valor/ton ✓, observações ✓, preços configuráveis global ✓, cálculo automático ✓ (backend + preview), editar/excluir/consultar/filtrar ✓, indicadores (total/toneladas/qtd/por fornecedor/por tipo/médio-ton/comparação mensal) ✓, resultado consolidado bruto/receita/líquido ✓, cores/ícones distintos ✓, receita não altera custos ✓ (só demonstrada), relatório exportável CSV ✓, snapshot de preço ✓, cálculo centralizado no backend ✓, precisão decimal ✓, permissões ✓.

**Placeholders:** nenhum passo com TODO/TBD; código real nas partes de lógica. UI de páginas descrita com padrão + componentes exatos (mesma estrutura já existente em custos).

**Type consistency:** `calcularReceita`, `toneladas`, `receitaTotal`, `custoLiquido`, `mapReceita`, `listarReceitasDoMes`, `resultadoLogisticoDoMes` consistentes entre tasks.

**Dependências a confirmar durante a execução:** `inicioFimDoMes` e `primeiroDiaDoMes` em `@/domain/periodo`; `custoTotalAtivos` em `@/domain/metrics`; `somaLancamentos` em `@/domain/custos-metrics` (assinaturas usadas em `custos/page.tsx`).

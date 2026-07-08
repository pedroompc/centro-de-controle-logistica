# Módulo de Custos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo de custos mês a mês — fixos recorrentes, variáveis por mês e salário vindo do efetivo — com total do mês e histórico navegável.

**Architecture:** Estende o app Next.js + Supabase existente. Lógica pura nova em `src/domain` (helpers de mês, soma de custos), 100% testável com Vitest. Data layer em `src/data` (mappers + Server Actions). Telas sob `src/app/(app)/custos`. Reusa auth, layout, `formatBRL` e `periodo.ts`.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind, Supabase (`@supabase/ssr`), Vitest.

## Global Constraints

- Idioma: **português (BR)**. Dinheiro em BRL via `formatBRL`.
- `mes` sempre o **1º dia do mês** (`date`, ex: `2026-07-01`). Começa em julho/2026 pra frente.
- Tabelas/colunas em português: `custos_fixos`, `custos_mensais`.
- `custos_mensais.tipo`: enum `custo_tipo` = `fixo` / `variavel`.
- Valores: `numeric(10,2)`, mapeados para `number` no domínio.
- **Salário NÃO é digitado** — é `SUM(funcionarios.custo_mensal) WHERE status='ativo'`, somado ao total do mês.
- **Materialização via botão "Abrir mês"** (Server Action), não durante render.
- RLS: acesso total a `authenticated` (igual efetivo). Package manager: **npm**. Commits em português (`feat:/test:/chore:`).

---

## Estrutura de arquivos

```
supabase/migrations/0002_custos.sql   # enum + custos_fixos + custos_mensais + RLS
src/domain/
  types.ts            # + CustoTipo, CustoFixo, CustoMensal (append)
  periodo.ts          # + primeiroDiaDoMes, mesAnterior, mesProximo, formatMesAno (append)
  periodo.test.ts     # + testes dos helpers de mês
  metrics.ts          # + custoTotalAtivos (append)
  metrics.test.ts     # + teste de custoTotalAtivos
  custos-metrics.ts   # somaLancamentos, totalDoMes (novo)
  custos-metrics.test.ts
src/data/
  mappers.ts          # + mapCustoFixo, mapCustoMensal (append)
  mappers.test.ts     # + testes dos novos mappers
  custos-fixos.ts     # Server Actions do molde recorrente (novo)
  custos-mensais.ts   # Server Actions dos lançamentos + materializarMes (novo)
src/app/(app)/
  layout.tsx          # + link "Custos" na nav (modify)
  page.tsx            # + card custo total do mês (modify)
  custos/page.tsx     # tela de custos (mês selecionável) (novo)
  custos/lancar-variavel-form.tsx  # form client (novo)
  custos/abrir-mes-button.tsx      # botão client (novo)
  custos/fixos/page.tsx            # gerenciar molde (novo)
  custos/fixos/custo-fixo-form.tsx # form client (novo)
```

---

## Task 1: Migration do banco de custos

**Files:**
- Create: `supabase/migrations/0002_custos.sql`

**Interfaces:**
- Produces: enum `custo_tipo`; tabelas `custos_fixos`, `custos_mensais` com RLS.

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0002_custos.sql`:
```sql
create type custo_tipo as enum ('fixo', 'variavel');

create table custos_fixos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  valor numeric(10,2) not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

create table custos_mensais (
  id uuid primary key default gen_random_uuid(),
  mes date not null,
  nome text not null,
  tipo custo_tipo not null,
  valor numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);
create index custos_mensais_mes_idx on custos_mensais(mes);

alter table custos_fixos enable row level security;
alter table custos_mensais enable row level security;

create policy "auth full access custos_fixos" on custos_fixos
  for all to authenticated using (true) with check (true);
create policy "auth full access custos_mensais" on custos_mensais
  for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Aplicar no Supabase**

Aplicar via SQL Editor do painel (checkpoint manual — o controller entrega o SQL ao usuário). Não usar CLI.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_custos.sql
git commit -m "feat: schema de custos (custos_fixos, custos_mensais) com RLS"
```

---

## Task 2: Tipos de domínio de custos

**Files:**
- Modify: `src/domain/types.ts` (append)

**Interfaces:**
- Produces:
  - `type CustoTipo = "fixo" | "variavel"`
  - `interface CustoFixo { id: string; nome: string; valor: number; ativo: boolean }`
  - `interface CustoMensal { id: string; mes: string; nome: string; tipo: CustoTipo; valor: number }`

- [ ] **Step 1: Adicionar os tipos**

Append em `src/domain/types.ts`:
```ts
export type CustoTipo = "fixo" | "variavel";

export interface CustoFixo {
  id: string;
  nome: string;
  valor: number;
  ativo: boolean;
}

export interface CustoMensal {
  id: string;
  mes: string; // ISO "yyyy-mm-01"
  nome: string;
  tipo: CustoTipo;
  valor: number;
}
```

- [ ] **Step 2: Verificar tipos e commit**

Run: `npx tsc --noEmit` → sem erros.
```bash
git add src/domain/types.ts
git commit -m "feat: tipos de domínio de custos"
```

---

## Task 3: Helpers de mês (periodo.ts) — TDD

**Files:**
- Modify: `src/domain/periodo.ts` (append)
- Modify/Create test: `src/domain/periodo.test.ts`

**Interfaces:**
- Produces:
  - `primeiroDiaDoMes(base?: string | Date): string` → `"2026-07-01"`
  - `mesAnterior(mesISO: string): string`
  - `mesProximo(mesISO: string): string`
  - `formatMesAno(mesISO: string): string` → `"Julho/2026"`

- [ ] **Step 1: Escrever os testes**

Create/append `src/domain/periodo.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { primeiroDiaDoMes, mesAnterior, mesProximo, formatMesAno } from "./periodo";

describe("primeiroDiaDoMes", () => {
  it("de uma data ISO string", () => {
    expect(primeiroDiaDoMes("2026-07-08")).toBe("2026-07-01");
  });
  it("de um Date", () => {
    expect(primeiroDiaDoMes(new Date(2026, 6, 20))).toBe("2026-07-01");
  });
});

describe("mesAnterior / mesProximo", () => {
  it("mês anterior dentro do ano", () => {
    expect(mesAnterior("2026-07-01")).toBe("2026-06-01");
  });
  it("mês anterior virando o ano", () => {
    expect(mesAnterior("2026-01-01")).toBe("2025-12-01");
  });
  it("mês próximo virando o ano", () => {
    expect(mesProximo("2026-12-01")).toBe("2027-01-01");
  });
});

describe("formatMesAno", () => {
  it("formata em pt-BR", () => {
    expect(formatMesAno("2026-07-01")).toBe("Julho/2026");
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test` → FAIL (funções não existem).

- [ ] **Step 3: Implementar**

Append em `src/domain/periodo.ts`:
```ts
const MESES_PT = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function primeiroDiaDoMes(base: string | Date = new Date()): string {
  if (typeof base === "string") return base.slice(0, 7) + "-01";
  const ano = base.getFullYear();
  const mes = String(base.getMonth() + 1).padStart(2, "0");
  return `${ano}-${mes}-01`;
}

export function mesAnterior(mesISO: string): string {
  let [ano, mes] = mesISO.split("-").map(Number);
  mes -= 1;
  if (mes === 0) { mes = 12; ano -= 1; }
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

export function mesProximo(mesISO: string): string {
  let [ano, mes] = mesISO.split("-").map(Number);
  mes += 1;
  if (mes === 13) { mes = 1; ano += 1; }
  return `${ano}-${String(mes).padStart(2, "0")}-01`;
}

export function formatMesAno(mesISO: string): string {
  const [ano, mes] = mesISO.split("-").map(Number);
  return `${MESES_PT[mes - 1]}/${ano}`;
}
```

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/periodo.ts src/domain/periodo.test.ts
git commit -m "feat: helpers de mês (primeiro dia, navegação, formatação)"
```

---

## Task 4: Métricas de custos (puras) — TDD

**Files:**
- Create: `src/domain/custos-metrics.ts`
- Test: `src/domain/custos-metrics.test.ts`
- Modify: `src/domain/metrics.ts` (append `custoTotalAtivos`)
- Modify: `src/domain/metrics.test.ts` (append teste)

**Interfaces:**
- Consumes: `CustoMensal`, `CustoTipo`, `Funcionario`.
- Produces:
  - `somaLancamentos(custos: CustoMensal[], tipo?: CustoTipo): number`
  - `totalDoMes(custos: CustoMensal[], salarioEfetivo: number): number`
  - `custoTotalAtivos(funcionarios: Funcionario[]): number`

- [ ] **Step 1: Testes de custos-metrics**

Create `src/domain/custos-metrics.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { somaLancamentos, totalDoMes } from "./custos-metrics";
import type { CustoMensal } from "./types";

const c = (over: Partial<CustoMensal>): CustoMensal => ({
  id: "1", mes: "2026-07-01", nome: "X", tipo: "fixo", valor: 100, ...over,
});

describe("somaLancamentos", () => {
  const custos = [
    c({ tipo: "fixo", valor: 1000 }),
    c({ tipo: "fixo", valor: 500 }),
    c({ tipo: "variavel", valor: 300 }),
  ];
  it("soma todos sem filtro", () => {
    expect(somaLancamentos(custos)).toBe(1800);
  });
  it("soma só os fixos", () => {
    expect(somaLancamentos(custos, "fixo")).toBe(1500);
  });
  it("soma só os variáveis", () => {
    expect(somaLancamentos(custos, "variavel")).toBe(300);
  });
});

describe("totalDoMes", () => {
  it("soma lançamentos + salário do efetivo", () => {
    const custos = [c({ valor: 1000 }), c({ tipo: "variavel", valor: 500 })];
    expect(totalDoMes(custos, 749398)).toBe(750898);
  });
});
```

- [ ] **Step 2: Teste de custoTotalAtivos**

Append em `src/domain/metrics.test.ts`:
```ts
import { custoTotalAtivos } from "./metrics";

describe("custoTotalAtivos", () => {
  it("soma custo_mensal só dos ativos", () => {
    const funcs = [
      f({ id: "1", custoMensal: 3034, status: "ativo" }),
      f({ id: "2", custoMensal: 3034, status: "ativo" }),
      f({ id: "3", custoMensal: 3034, status: "desligado" }),
    ];
    expect(custoTotalAtivos(funcs)).toBe(6068);
  });
});
```
> Nota: `f(...)` já é o helper definido no topo de `metrics.test.ts` (Task 3 do efetivo). Reuse-o.

- [ ] **Step 3: Rodar e verificar que falha**

Run: `npm test` → FAIL (módulo/funcões não existem).

- [ ] **Step 4: Implementar**

Create `src/domain/custos-metrics.ts`:
```ts
import type { CustoMensal, CustoTipo } from "./types";

export function somaLancamentos(custos: CustoMensal[], tipo?: CustoTipo): number {
  return custos
    .filter((c) => (tipo ? c.tipo === tipo : true))
    .reduce((total, c) => total + c.valor, 0);
}

export function totalDoMes(custos: CustoMensal[], salarioEfetivo: number): number {
  return somaLancamentos(custos) + salarioEfetivo;
}
```

Append em `src/domain/metrics.ts`:
```ts
export function custoTotalAtivos(funcionarios: Funcionario[]): number {
  return funcionarios
    .filter((f) => f.status === "ativo")
    .reduce((total, f) => total + f.custoMensal, 0);
}
```
> `Funcionario` já está importado no topo de `metrics.ts`.

- [ ] **Step 5: Rodar e verificar que passa**

Run: `npm test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/domain/custos-metrics.ts src/domain/custos-metrics.test.ts src/domain/metrics.ts src/domain/metrics.test.ts
git commit -m "feat: métricas de custos (soma por tipo, total do mês, custo do efetivo ativo)"
```

---

## Task 5: Mappers de custos — TDD

**Files:**
- Modify: `src/data/mappers.ts` (append)
- Modify: `src/data/mappers.test.ts` (append)

**Interfaces:**
- Produces:
  - `mapCustoFixo(row): CustoFixo`
  - `mapCustoMensal(row): CustoMensal` — `valor` (string do numeric) → number; `mes` mantém string ISO.

- [ ] **Step 1: Testes**

Append em `src/data/mappers.test.ts`:
```ts
import { mapCustoFixo, mapCustoMensal } from "./mappers";

describe("mapCustoFixo", () => {
  it("mapeia e converte valor string em number", () => {
    expect(mapCustoFixo({ id: "cf1", nome: "Galpão", valor: "12000.00", ativo: true }))
      .toEqual({ id: "cf1", nome: "Galpão", valor: 12000, ativo: true });
  });
});

describe("mapCustoMensal", () => {
  it("mapeia lançamento mensal", () => {
    const row = { id: "cm1", mes: "2026-07-01", nome: "Gasolina", tipo: "variavel", valor: "3500.50" };
    expect(mapCustoMensal(row)).toEqual({
      id: "cm1", mes: "2026-07-01", nome: "Gasolina", tipo: "variavel", valor: 3500.5,
    });
  });
});
```

- [ ] **Step 2: Rodar e verificar que falha**

Run: `npm test` → FAIL.

- [ ] **Step 3: Implementar**

Append em `src/data/mappers.ts`:
```ts
import type { CustoFixo, CustoMensal, CustoTipo } from "@/domain/types";

export function mapCustoFixo(row: {
  id: string; nome: string; valor: string | number; ativo: boolean;
}): CustoFixo {
  return { id: row.id, nome: row.nome, valor: Number(row.valor), ativo: row.ativo };
}

export function mapCustoMensal(row: {
  id: string; mes: string; nome: string; tipo: string; valor: string | number;
}): CustoMensal {
  return {
    id: row.id,
    mes: row.mes,
    nome: row.nome,
    tipo: row.tipo as CustoTipo,
    valor: Number(row.valor),
  };
}
```
> Se o import de tipos já existir no topo do arquivo, só acrescente os novos nomes ao import existente em vez de duplicar a linha `import`.

- [ ] **Step 4: Rodar e verificar que passa**

Run: `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/mappers.ts src/data/mappers.test.ts
git commit -m "feat: mappers de custos (fixo e mensal)"
```

---

## Task 6: Data layer — custos fixos (molde)

**Files:**
- Create: `src/data/custos-fixos.ts`

**Interfaces:**
- Consumes: `createClient` (server), `mapCustoFixo`.
- Produces:
  - `listarCustosFixos(): Promise<CustoFixo[]>` — só `ativo = true`, ordenados por nome.
  - `criarCustoFixo(formData: FormData): Promise<void>`
  - `editarValorCustoFixo(formData: FormData): Promise<void>` — campos `id`, `valor`.
  - `encerrarCustoFixo(id: string): Promise<void>` — seta `ativo = false`.

- [ ] **Step 1: Implementar**

Create `src/data/custos-fixos.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapCustoFixo } from "./mappers";
import type { CustoFixo } from "@/domain/types";

export async function listarCustosFixos(): Promise<CustoFixo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custos_fixos")
    .select("id, nome, valor, ativo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCustoFixo);
}

export async function criarCustoFixo(formData: FormData): Promise<void> {
  const nome = String(formData.get("nome") ?? "").trim();
  const valor = Number(formData.get("valor") ?? 0);
  if (!nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("custos_fixos").insert({ nome, valor });
  if (error) throw new Error(error.message);
  revalidatePath("/custos/fixos");
}

export async function editarValorCustoFixo(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const valor = Number(formData.get("valor") ?? 0);
  const supabase = await createClient();
  const { error } = await supabase.from("custos_fixos").update({ valor }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/custos/fixos");
}

export async function encerrarCustoFixo(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("custos_fixos").update({ ativo: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/custos/fixos");
}
```

- [ ] **Step 2: Verificar tipos e commit**

Run: `npx tsc --noEmit` → sem erros.
```bash
git add src/data/custos-fixos.ts
git commit -m "feat: data layer dos custos fixos (molde recorrente)"
```

---

## Task 7: Data layer — custos mensais + materialização

**Files:**
- Create: `src/data/custos-mensais.ts`

**Interfaces:**
- Consumes: `createClient` (server), `mapCustoMensal`.
- Produces:
  - `listarLancamentosDoMes(mes: string): Promise<CustoMensal[]>`
  - `materializarMes(mes: string): Promise<void>` — se o mês ainda não tem lançamento `fixo`, copia os `custos_fixos` ativos para o mês.
  - `adicionarLancamento(formData: FormData): Promise<void>` — campos `mes`, `nome`, `tipo`, `valor`.
  - `editarLancamento(formData: FormData): Promise<void>` — campos `id`, `valor`.
  - `removerLancamento(id: string): Promise<void>`

- [ ] **Step 1: Implementar**

Create `src/data/custos-mensais.ts`:
```ts
"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapCustoMensal } from "./mappers";
import type { CustoMensal } from "@/domain/types";

const COLUNAS = "id, mes, nome, tipo, valor";

export async function listarLancamentosDoMes(mes: string): Promise<CustoMensal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custos_mensais")
    .select(COLUNAS)
    .eq("mes", mes)
    .order("tipo")
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCustoMensal);
}

export async function materializarMes(mes: string): Promise<void> {
  const supabase = await createClient();
  const { data: jaTem, error: e1 } = await supabase
    .from("custos_mensais")
    .select("id")
    .eq("mes", mes)
    .eq("tipo", "fixo")
    .limit(1);
  if (e1) throw new Error(e1.message);
  if (jaTem && jaTem.length > 0) return;

  const { data: fixos, error: e2 } = await supabase
    .from("custos_fixos")
    .select("nome, valor")
    .eq("ativo", true);
  if (e2) throw new Error(e2.message);
  if (!fixos || fixos.length === 0) {
    revalidatePath("/custos");
    return;
  }
  const rows = fixos.map((fx) => ({
    mes, nome: fx.nome, tipo: "fixo" as const, valor: fx.valor,
  }));
  const { error: e3 } = await supabase.from("custos_mensais").insert(rows);
  if (e3) throw new Error(e3.message);
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function adicionarLancamento(formData: FormData): Promise<void> {
  const registro = {
    mes: String(formData.get("mes") ?? ""),
    nome: String(formData.get("nome") ?? "").trim(),
    tipo: String(formData.get("tipo") ?? "variavel"),
    valor: Number(formData.get("valor") ?? 0),
  };
  if (!registro.mes || !registro.nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("custos_mensais").insert(registro);
  if (error) throw new Error(error.message);
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function editarLancamento(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const valor = Number(formData.get("valor") ?? 0);
  const supabase = await createClient();
  const { error } = await supabase.from("custos_mensais").update({ valor }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function removerLancamento(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("custos_mensais").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/custos");
  revalidatePath("/");
}
```

- [ ] **Step 2: Verificar tipos e commit**

Run: `npx tsc --noEmit` → sem erros.
```bash
git add src/data/custos-mensais.ts
git commit -m "feat: data layer dos custos mensais + materialização do mês"
```

---

## Task 8: Tela de Custos — visão do mês + navegação + abrir mês

**Files:**
- Create: `src/app/(app)/custos/page.tsx`
- Create: `src/app/(app)/custos/abrir-mes-button.tsx`

**Interfaces:**
- Consumes: `listarLancamentosDoMes`, `materializarMes`, `listarFuncionarios`, `custoTotalAtivos`, `somaLancamentos`, `totalDoMes`, `formatBRL`, `primeiroDiaDoMes`, `mesAnterior`, `mesProximo`, `formatMesAno`.
- Produces: rota `/custos` com seletor de mês (`?mes=`), total do mês, blocos Fixos/Variáveis/Salário, e botão "Abrir mês" quando o mês está vazio de fixos.

- [ ] **Step 1: Botão "Abrir mês" (client)**

Create `src/app/(app)/custos/abrir-mes-button.tsx`:
```tsx
"use client";

import { materializarMes } from "@/data/custos-mensais";

export function AbrirMesButton({ mes }: { mes: string }) {
  return (
    <form action={materializarMes.bind(null, mes)}>
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">
        Abrir mês (gerar custos fixos)
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Página de custos**

Create `src/app/(app)/custos/page.tsx`:
```tsx
import Link from "next/link";
import { listarLancamentosDoMes } from "@/data/custos-mensais";
import { listarFuncionarios } from "@/data/funcionarios";
import { custoTotalAtivos } from "@/domain/metrics";
import { somaLancamentos, totalDoMes } from "@/domain/custos-metrics";
import { formatBRL } from "@/domain/format";
import { primeiroDiaDoMes, mesAnterior, mesProximo, formatMesAno } from "@/domain/periodo";
import { AbrirMesButton } from "./abrir-mes-button";
import { LancarVariavelForm } from "./lancar-variavel-form";
import { editarLancamento, removerLancamento } from "@/data/custos-mensais";

export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams;
  const mes = mesParam ? primeiroDiaDoMes(mesParam) : primeiroDiaDoMes();

  const [lancamentos, funcionarios] = await Promise.all([
    listarLancamentosDoMes(mes),
    listarFuncionarios(),
  ]);

  const salario = custoTotalAtivos(funcionarios);
  const fixos = lancamentos.filter((l) => l.tipo === "fixo");
  const variaveis = lancamentos.filter((l) => l.tipo === "variavel");
  const total = totalDoMes(lancamentos, salario);
  const mesVazio = fixos.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Custos</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/custos?mes=${mesAnterior(mes)}`} className="rounded-lg border px-3 py-1">◀</Link>
          <span className="font-semibold text-slate-700">{formatMesAno(mes)}</span>
          <Link href={`/custos?mes=${mesProximo(mes)}`} className="rounded-lg border px-3 py-1">▶</Link>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm text-slate-500">Total do mês</p>
        <p className="text-3xl font-bold text-slate-900">{formatBRL(total)}</p>
        <p className="mt-1 text-sm text-slate-500">
          Fixos {formatBRL(somaLancamentos(lancamentos, "fixo"))} · Variáveis {formatBRL(somaLancamentos(lancamentos, "variavel"))} · Salário {formatBRL(salario)}
        </p>
      </div>

      {mesVazio && (
        <div className="flex items-center justify-between rounded-xl border border-dashed bg-white p-4">
          <p className="text-slate-600">Este mês ainda não foi aberto (sem custos fixos gerados).</p>
          <AbrirMesButton mes={mes} />
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-800">Fixos</h2>
        <BlocoLancamentos itens={fixos} vazio="Nenhum custo fixo neste mês." />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Variáveis</h2>
          <LancarVariavelForm mes={mes} />
        </div>
        <BlocoLancamentos itens={variaveis} vazio="Nenhum custo variável lançado." />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-800">Salário (do efetivo)</h2>
        <div className="rounded-xl border bg-white p-4 text-slate-700">
          {formatBRL(salario)} · <Link href="/funcionarios" className="text-slate-500 underline">ver efetivo</Link>
        </div>
      </section>
    </div>
  );
}

function BlocoLancamentos({ itens, vazio }: { itens: import("@/domain/types").CustoMensal[]; vazio: string }) {
  if (itens.length === 0) return <p className="text-sm text-slate-500">{vazio}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-slate-500">
          <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Valor</th><th className="px-4 py-2"></th></tr>
        </thead>
        <tbody>
          {itens.map((l) => (
            <tr key={l.id} className="border-b last:border-0">
              <td className="px-4 py-2 text-slate-700">{l.nome}</td>
              <td className="px-4 py-2">
                <form action={editarLancamento} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <input name="valor" type="number" step="0.01" min="0" defaultValue={l.valor}
                    className="w-32 rounded-lg border border-slate-300 px-2 py-1" />
                  <button className="text-xs text-slate-600 underline">salvar</button>
                </form>
              </td>
              <td className="px-4 py-2 text-right">
                <form action={removerLancamento.bind(null, l.id)}>
                  <button className="text-sm text-red-600">remover</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 3: Verificar build**

Run: `npm run build`
Expected: build sem erros (depende do form da Task 8b — se executar em ordem, crie primeiro o arquivo `lancar-variavel-form.tsx` da Task 8b, que é pré-requisito do import; ou adiante o Step 1 da Task 8b).

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/custos/page.tsx" "src/app/(app)/custos/abrir-mes-button.tsx"
git commit -m "feat: tela de custos (mês, total, blocos, abrir mês)"
```

---

## Task 8b: Form de lançar variável

**Files:**
- Create: `src/app/(app)/custos/lancar-variavel-form.tsx`

**Interfaces:**
- Consumes: `adicionarLancamento`.
- Produces: `LancarVariavelForm({ mes })` — form client que adiciona um lançamento `variavel` ao mês.

- [ ] **Step 1: Form**

Create `src/app/(app)/custos/lancar-variavel-form.tsx`:
```tsx
"use client";

import { useState } from "react";
import { adicionarLancamento } from "@/data/custos-mensais";

export function LancarVariavelForm({ mes }: { mes: string }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">
        Lançar variável
      </button>
    );
  }
  return (
    <form action={adicionarLancamento} className="flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="tipo" value="variavel" />
      <input name="nome" required placeholder="Item (ex: Gasolina)"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <input name="valor" type="number" step="0.01" min="0" required placeholder="Valor"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">Adicionar</button>
      <button type="button" onClick={() => setAberto(false)} className="rounded-lg border px-4 py-2 text-slate-600">Cancelar</button>
    </form>
  );
}
```

- [ ] **Step 2: Build + commit**

Run: `npm run build` → sem erros.
```bash
git add "src/app/(app)/custos/lancar-variavel-form.tsx"
git commit -m "feat: form de lançar custo variável"
```

---

## Task 9: Tela de Custos Fixos (gerenciar o molde)

**Files:**
- Create: `src/app/(app)/custos/fixos/page.tsx`
- Create: `src/app/(app)/custos/fixos/custo-fixo-form.tsx`

**Interfaces:**
- Consumes: `listarCustosFixos`, `criarCustoFixo`, `editarValorCustoFixo`, `encerrarCustoFixo`, `formatBRL`.
- Produces: rota `/custos/fixos` — lista dos fixos vigentes com adicionar / editar valor / encerrar.

- [ ] **Step 1: Form de novo fixo (client)**

Create `src/app/(app)/custos/fixos/custo-fixo-form.tsx`:
```tsx
"use client";

import { criarCustoFixo } from "@/data/custos-fixos";

export function CustoFixoForm() {
  return (
    <form action={criarCustoFixo} className="flex flex-wrap items-end gap-2 text-sm">
      <input name="nome" required placeholder="Nome (ex: Empilhadeira 2)"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <input name="valor" type="number" step="0.01" min="0" required placeholder="Valor mensal"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">Adicionar fixo</button>
    </form>
  );
}
```

- [ ] **Step 2: Página de fixos**

Create `src/app/(app)/custos/fixos/page.tsx`:
```tsx
import Link from "next/link";
import { listarCustosFixos, editarValorCustoFixo, encerrarCustoFixo } from "@/data/custos-fixos";
import { formatBRL } from "@/domain/format";
import { CustoFixoForm } from "./custo-fixo-form";

export default async function CustosFixosPage() {
  const fixos = await listarCustosFixos();
  const total = fixos.reduce((t, f) => t + f.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Custos fixos</h1>
          <Link href="/custos" className="text-sm text-slate-500 underline">← voltar aos custos</Link>
        </div>
        <CustoFixoForm />
      </div>

      <p className="text-sm text-slate-500">
        Total fixo mensal vigente: <span className="font-semibold text-slate-800">{formatBRL(total)}</span>
      </p>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Valor mensal</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody>
            {fixos.map((f) => (
              <tr key={f.id} className="border-b last:border-0">
                <td className="px-4 py-2 text-slate-700">{f.nome}</td>
                <td className="px-4 py-2">
                  <form action={editarValorCustoFixo} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={f.id} />
                    <input name="valor" type="number" step="0.01" min="0" defaultValue={f.valor}
                      className="w-32 rounded-lg border border-slate-300 px-2 py-1" />
                    <button className="text-xs text-slate-600 underline">salvar</button>
                  </form>
                </td>
                <td className="px-4 py-2 text-right">
                  <form action={encerrarCustoFixo.bind(null, f.id)}>
                    <button className="text-sm text-red-600">encerrar</button>
                  </form>
                </td>
              </tr>
            ))}
            {fixos.length === 0 && (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">Nenhum custo fixo cadastrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

Run: `npm run build` → sem erros.
```bash
git add "src/app/(app)/custos/fixos"
git commit -m "feat: tela de gerenciamento dos custos fixos"
```

---

## Task 10: Integração — nav + card no Dashboard

**Files:**
- Modify: `src/app/(app)/layout.tsx` (nav)
- Modify: `src/app/(app)/page.tsx` (dashboard card)

**Interfaces:**
- Consumes: `listarLancamentosDoMes`, `custoTotalAtivos`, `totalDoMes`, `formatBRL`, `primeiroDiaDoMes`.
- Produces: link "Custos" na nav; card "Custo total do mês" no dashboard.

- [ ] **Step 1: Link na nav**

Em `src/app/(app)/layout.tsx`, adicionar o link "Custos" na `<nav>`, após "Funcionários":
```tsx
<Link href="/custos">Custos</Link>
```

- [ ] **Step 2: Card no dashboard**

Em `src/app/(app)/page.tsx`, adicionar (dentro do `Promise.all`, junto dos outros loads):
```tsx
import { listarLancamentosDoMes } from "@/data/custos-mensais";
import { totalDoMes } from "@/domain/custos-metrics";
import { primeiroDiaDoMes } from "@/domain/periodo";
```
No corpo, computar o total do mês corrente e mostrar um card. Exemplo de trecho a integrar (ajuste ao `Promise.all` existente):
```tsx
const mesAtual = primeiroDiaDoMes();
const lancamentosMes = await listarLancamentosDoMes(mesAtual);
const custoTotalMes = totalDoMes(lancamentosMes, custoTotal); // custoTotal = soma salário ativos já calculada no dashboard
```
E um card novo na grade de totais:
```tsx
<div className="rounded-xl border bg-white p-4">
  <p className="text-sm text-slate-500">Custo total do mês</p>
  <p className="text-2xl font-bold">{formatBRL(custoTotalMes)}</p>
</div>
```
> Nota: o dashboard já calcula `custoTotal` (soma do `custoMensal` dos ativos) na Task 15 do efetivo. Reuse essa variável como `salarioEfetivo` em `totalDoMes`. Se o nome local diferir, ajuste para a variável existente que representa a soma dos salários ativos.

- [ ] **Step 3: Build + commit**

Run: `npm run build && npm test`
Expected: build sem erros; testes verdes.
```bash
git add "src/app/(app)/layout.tsx" "src/app/(app)/page.tsx"
git commit -m "feat: nav de custos e card de custo total do mês no dashboard"
```

- [ ] **Step 4: Checkpoint manual (ponta a ponta)**

Aplicar a migration `0002_custos.sql` no Supabase. Rodar `npm run dev`. Em `/custos/fixos`, cadastrar os fixos (galpão, empilhadeira, paleteira, aluguéis). Em `/custos`, clicar "Abrir mês" → os fixos aparecem. Lançar um variável (ex: Gasolina). Conferir o total do mês = fixos + variáveis + salário do efetivo, e o card no dashboard.

---

## Self-Review (cobertura da spec)

- **Modelo de dados (custos_fixos, custos_mensais, enum, RLS):** Task 1. ✅
- **Tipos de domínio:** Task 2. ✅
- **Mês a mês + navegação + formatação pt-BR:** Task 3 (helpers) + Task 8 (seletor). ✅
- **Fixos recorrentes materializados por mês, editáveis, sem mexer no passado:** Task 7 (`materializarMes`, idempotente) + Task 9 (molde) + Task 8 (editar/remover no mês). ✅
- **Variáveis lançados por mês:** Task 7 (`adicionarLancamento`) + Task 8b (form). ✅
- **Salário derivado do efetivo (não digitado):** Task 4 (`custoTotalAtivos`) + Task 8 (bloco salário) + Task 10 (dashboard). ✅
- **Total do mês (fixos+variáveis+salário):** Task 4 (`totalDoMes`) usado nas Tasks 8 e 10. ✅
- **Telas Custos, Custos fixos, card no Dashboard + nav:** Tasks 8, 8b, 9, 10. ✅
- **Fora de escopo (snapshot de salário, rendimentos, orçamento):** não incluídos. ✅

Dependência de ordem: Task 8 importa o form da Task 8b — criar o form (Task 8b Step 1) antes do build da Task 8, ou executar 8b logo após 8 tolerando um build intermediário. Materialização é via botão "Abrir mês" (decisão registrada nas Global Constraints), não em render.

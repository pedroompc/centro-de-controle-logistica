# Snapshot histórico + aba Tendências — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Congelar os totais mensais do Winthor (faturamento + devolução) numa tabela do Supabase via lazy backfill e expor uma aba **Tendências** com 4 gráficos de evolução mês a mês.

**Architecture:** Segue o padrão do projeto — `domain/` (lógica pura, testada com vitest), `data/` (Supabase + Winthor, server-only), `app/` (RSC). Uma tabela nova `faturamento_mensal` guarda a foto de cada mês fechado; `getFaturamentoMensal(mes)` lê do Supabase e, se faltar e o mês estiver fechado, calcula do Winthor uma vez e grava (`INSERT ... ON CONFLICT DO NOTHING`). A página `/tendencias` lê a série dos últimos 12 meses fechados e desenha gráficos SVG à mão.

**Tech Stack:** Next.js 16 (App Router / RSC), TypeScript, Supabase (`@supabase/ssr`, anon key + RLS), Oracle read-only (`queryWinthor`), Tailwind, vitest. Gráficos em SVG puro (zero dependência nova).

## Global Constraints

- Next.js 16 App Router com React Server Components; componentes de dados são `async` e server-only.
- Supabase acessado só com **anon key + JWT do usuário** (`src/lib/supabase/server.ts`); **não há service role**. Escrita da foto passa pela RLS `insert` liberada ao autenticado.
- Winthor é **read-only** via `queryWinthor` (`src/lib/oracle/client.ts`); filial fixa `'1'`.
- **Zero dependência nova** — gráficos em SVG feitos à mão, no estilo das barras de `devolucoes/page.tsx`.
- TDD com vitest para toda lógica pura em `domain/`. Rodar: `npx vitest run`.
- **Congelado é congelado:** foto de mês fechado nunca é reescrita. Só meses fechados entram no histórico; o mês corrente nunca é gravado.
- Datas de mês no formato ISO 1º-dia (`YYYY-MM-01`), como no resto do projeto.
- Seguir o split existente `data/ | domain/ | app/`; arquivos focados e pequenos.

---

### Task 1: Migration `0005_faturamento_mensal` (tabela + RLS)

**Files:**
- Create: `supabase/migrations/0005_faturamento_mensal.sql`

**Interfaces:**
- Produces: tabela `faturamento_mensal (mes date, filial text, venda_faturada numeric, venda_liquida numeric, valor_devolucao numeric, valor_devolucao_avulsa numeric, devolvidas int, devolvidas_avulsas int, peso_faturado numeric, peso_devolucao numeric, emitidas int, positivados int, criado_em timestamptz)`, PK `(mes, filial)`. Depende de `public.is_admin()` (criada em `0003_roles.sql`).

- [ ] **Step 1: Escrever a migration**

Create `supabase/migrations/0005_faturamento_mensal.sql`:

```sql
-- Snapshot mensal do faturamento (rotina 111): congela os totais de cada mês
-- fechado. Populado sob demanda (lazy backfill) quando alguém abre Tendências.
-- Uma linha por mês/filial; foto congelada, nunca reescrita.
create table faturamento_mensal (
  mes date not null,
  filial text not null default '1',
  venda_faturada numeric(14,2) not null default 0,
  venda_liquida numeric(14,2) not null default 0,
  valor_devolucao numeric(14,2) not null default 0,
  valor_devolucao_avulsa numeric(14,2) not null default 0,
  devolvidas int not null default 0,
  devolvidas_avulsas int not null default 0,
  peso_faturado numeric(14,2) not null default 0,
  peso_devolucao numeric(14,2) not null default 0,
  emitidas int not null default 0,
  positivados int not null default 0,
  criado_em timestamptz not null default now(),
  primary key (mes, filial)
);

alter table faturamento_mensal enable row level security;

-- Leitura para qualquer logado.
create policy "read faturamento_mensal" on faturamento_mensal
  for select to authenticated using (true);

-- INSERT liberado ao logado: a foto é cache derivado gerado pelo sistema
-- (lazy backfill grava quando qualquer usuário abre a aba). Idempotente pela PK.
create policy "insert faturamento_mensal" on faturamento_mensal
  for insert to authenticated with check (true);

-- UPDATE/DELETE só admin (foto congelada; correção manual é exceção).
create policy "update faturamento_mensal" on faturamento_mensal
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "delete faturamento_mensal" on faturamento_mensal
  for delete to authenticated using (public.is_admin());
```

- [ ] **Step 2: Aplicar no Supabase**

Aplicar via painel do Supabase (SQL Editor) ou CLI. Verificar que a tabela existe:

Run (SQL Editor): `select * from faturamento_mensal limit 1;`
Expected: retorna 0 linhas, sem erro (tabela criada).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_faturamento_mensal.sql
git commit -m "feat: tabela faturamento_mensal (snapshot mensal + RLS)"
```

---

### Task 2: Helper de período `inicioFimDoMes`

**Files:**
- Modify: `src/domain/periodo.ts`
- Test: `src/domain/periodo.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `inicioFimDoMes(mesISO: string): { inicio: string; fim: string }` — 1º e último dia do mês em ISO.

- [ ] **Step 1: Escrever o teste que falha**

Adicionar em `src/domain/periodo.test.ts`:

```ts
import { inicioFimDoMes } from "./periodo";

describe("inicioFimDoMes", () => {
  it("retorna 1º e último dia de um mês de 31 dias", () => {
    expect(inicioFimDoMes("2026-05-01")).toEqual({ inicio: "2026-05-01", fim: "2026-05-31" });
  });
  it("trata fevereiro corretamente", () => {
    expect(inicioFimDoMes("2026-02-01")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
  });
});
```

(Se o arquivo já importa de `./periodo`, adicione só `inicioFimDoMes` ao import existente e o bloco `describe`.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/periodo.test.ts`
Expected: FAIL — `inicioFimDoMes is not a function`.

- [ ] **Step 3: Implementar**

Adicionar em `src/domain/periodo.ts`:

```ts
export function inicioFimDoMes(mesISO: string): { inicio: string; fim: string } {
  const [ano, mes] = mesISO.split("-").map(Number);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { inicio: iso(new Date(ano, mes - 1, 1)), fim: iso(new Date(ano, mes, 0)) };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/periodo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/periodo.ts src/domain/periodo.test.ts
git commit -m "feat: inicioFimDoMes(mesISO) em periodo"
```

---

### Task 3: Domínio de tendências (`domain/tendencias.ts`)

**Files:**
- Create: `src/domain/tendencias.ts`
- Test: `src/domain/tendencias.test.ts`

**Interfaces:**
- Consumes: `primeiroDiaDoMes`, `mesAnterior` de `@/domain/periodo`.
- Produces:
  - `interface PontoTendencia { mes: string; vendaFaturada: number; vendaLiquida: number; valorDevolucao: number; valorDevolucaoAvulsa: number; devolvidas: number; devolvidasAvulsas: number; pesoFaturado: number; pesoDevolucao: number; emitidas: number; positivados: number }`
  - `mesesFechados(hoje: Date, qtd: number): string[]` — últimos `qtd` meses fechados (exclui o corrente), do mais antigo ao mais novo.
  - `taxaDevolucaoMensal(p: Pick<PontoTendencia, "valorDevolucao" | "vendaFaturada">): number`
  - `pontosLinha(valores: number[], largura: number, altura: number, pad?: number): { pontos: string; marcadores: { x: number; y: number; v: number }[] }`

- [ ] **Step 1: Escrever o teste que falha**

Create `src/domain/tendencias.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mesesFechados, taxaDevolucaoMensal, pontosLinha } from "./tendencias";

describe("mesesFechados", () => {
  it("retorna os N meses fechados, do mais antigo ao mais novo, sem o corrente", () => {
    const r = mesesFechados(new Date(2026, 6, 13), 3); // julho/2026
    expect(r).toEqual(["2026-04-01", "2026-05-01", "2026-06-01"]);
  });
  it("cruza a virada de ano", () => {
    const r = mesesFechados(new Date(2026, 0, 10), 2); // janeiro/2026
    expect(r).toEqual(["2025-11-01", "2025-12-01"]);
  });
});

describe("taxaDevolucaoMensal", () => {
  it("é devolução / venda faturada", () => {
    expect(taxaDevolucaoMensal({ valorDevolucao: 100, vendaFaturada: 1000 })).toBeCloseTo(0.1, 6);
  });
  it("é 0 quando não houve venda", () => {
    expect(taxaDevolucaoMensal({ valorDevolucao: 50, vendaFaturada: 0 })).toBe(0);
  });
});

describe("pontosLinha", () => {
  it("mapeia o maior valor no topo e o menor na base (dentro do padding)", () => {
    const { pontos, marcadores } = pontosLinha([0, 10], 100, 100, 5);
    // 2 pontos: x nas bordas (pad e largura-pad), y invertido (maior em cima)
    expect(marcadores[0]).toEqual({ x: 5, y: 95, v: 0 });   // menor → base
    expect(marcadores[1]).toEqual({ x: 95, y: 5, v: 10 });  // maior → topo
    expect(pontos).toBe("5.0,95.0 95.0,5.0");
  });
  it("valores iguais ficam no meio (sem divisão por zero)", () => {
    const { marcadores } = pontosLinha([7, 7], 100, 100, 5);
    expect(marcadores.every((m) => m.y === 95)).toBe(true);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/tendencias.test.ts`
Expected: FAIL — módulo `./tendencias` não existe.

- [ ] **Step 3: Implementar**

Create `src/domain/tendencias.ts`:

```ts
import { primeiroDiaDoMes, mesAnterior } from "./periodo";

/** Ponto mensal do histórico de faturamento (uma foto da rotina 111). */
export interface PontoTendencia {
  mes: string; // 1º dia do mês, ISO
  vendaFaturada: number;
  vendaLiquida: number;
  valorDevolucao: number;
  valorDevolucaoAvulsa: number;
  devolvidas: number;
  devolvidasAvulsas: number;
  pesoFaturado: number;
  pesoDevolucao: number;
  emitidas: number;
  positivados: number;
}

/** Últimos `qtd` meses FECHADOS (exclui o mês corrente), do mais antigo ao mais novo. */
export function mesesFechados(hoje: Date, qtd: number): string[] {
  let m = mesAnterior(primeiroDiaDoMes(hoje)); // começa no mês anterior ao corrente
  const lista: string[] = [];
  for (let i = 0; i < qtd; i++) {
    lista.push(m);
    m = mesAnterior(m);
  }
  return lista.reverse();
}

/** Taxa de devolução (0..1) = devolução / venda faturada. 0 se não houve venda. */
export function taxaDevolucaoMensal(
  p: Pick<PontoTendencia, "valorDevolucao" | "vendaFaturada">,
): number {
  if (p.vendaFaturada <= 0) return 0;
  return p.valorDevolucao / p.vendaFaturada;
}

/**
 * Converte uma série de valores em pontos "x,y" para um <polyline> SVG.
 * Maior valor no topo, menor na base, respeitando o padding. Assume série sem
 * buracos (os pontos sem foto são filtrados antes de chamar).
 */
export function pontosLinha(
  valores: number[], largura: number, altura: number, pad = 4,
): { pontos: string; marcadores: { x: number; y: number; v: number }[] } {
  const min = valores.length ? Math.min(...valores) : 0;
  const max = valores.length ? Math.max(...valores) : 1;
  const span = max - min || 1;
  const n = valores.length;
  const stepX = n > 1 ? (largura - 2 * pad) / (n - 1) : 0;
  const marcadores = valores.map((v, i) => {
    const x = n > 1 ? pad + i * stepX : largura / 2;
    const y = altura - pad - ((v - min) / span) * (altura - 2 * pad);
    return { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), v };
  });
  return { pontos: marcadores.map((m) => `${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(" "), marcadores };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/tendencias.test.ts`
Expected: PASS (todos os describes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/tendencias.ts src/domain/tendencias.test.ts
git commit -m "feat: domínio de tendências (mesesFechados, taxa, pontosLinha)"
```

---

### Task 4: Generalizar `faturamento.ts` para período arbitrário

**Files:**
- Modify: `src/data/faturamento.ts`

**Interfaces:**
- Consumes: `SQL`, `LinhaResumo`, `n`, `hojeISO` (já existentes no arquivo); `primeiroDiaDoMes` de `@/domain/periodo`.
- Produces: `getResumoFaturamento(ini: string, fim: string, filial?: string): Promise<ResumoFaturamento | null>` — mesmo cálculo de hoje, com período/filial parametrizados. `getResumoFaturamentoMesAtual` passa a delegar para ela.

- [ ] **Step 1: Extrair a função parametrizada**

Em `src/data/faturamento.ts`, substituir o corpo de `getResumoFaturamentoMesAtual` por uma função nova + o wrapper do mês atual. O bloco atual é:

```ts
export const getResumoFaturamentoMesAtual = cache(async (): Promise<ResumoFaturamento | null> => {
  const ini = primeiroDiaDoMes(); // "yyyy-mm-01"
  const fim = hojeISO();
  try {
    const rows = await queryWinthor<LinhaResumo>(SQL, { filial: FILIAL, ini, fim });
    const r = rows[0];
    if (!r) return null;
    // ... mapeamento ...
  } catch (erro) {
    console.error("[faturamento] Winthor indisponível:", (erro as Error).message);
    return null;
  }
});
```

Trocar por:

```ts
/**
 * Resumo de faturamento da rotina 111 para um período/filial arbitrários.
 * Retorna `null` se o Winthor estiver indisponível ou não houver dados.
 */
export async function getResumoFaturamento(
  ini: string, fim: string, filial: string = FILIAL,
): Promise<ResumoFaturamento | null> {
  try {
    const rows = await queryWinthor<LinhaResumo>(SQL, { filial, ini, fim });
    const r = rows[0];
    if (!r) return null;

    const vendaFaturada = n(r.VENDA_FATURADA);
    const valorDevolucao = n(r.VALOR_DEVOLUCAO);
    const valorDevolucaoAvulsa = n(r.VALOR_DEVOLUCAO_AVULSA);
    const pesoVenda = n(r.PESO_VENDA);
    const pesoDevolucao = n(r.PESO_DEVOLUCAO);

    return {
      emitidas: n(r.EMITIDAS),
      positivados: n(r.POSITIVADOS),
      devolvidas: n(r.DEVOLVIDAS),
      devolvidasAvulsas: n(r.DEVOLVIDAS_AVULSAS),
      vendaFaturada,
      valorDevolucao,
      valorDevolucaoAvulsa,
      vendaLiquida: vendaFaturada - valorDevolucao - valorDevolucaoAvulsa,
      pesoFaturado: pesoVenda - pesoDevolucao,
      pesoDevolucao,
    };
  } catch (erro) {
    console.error("[faturamento] Winthor indisponível:", (erro as Error).message);
    return null;
  }
}

/** Resumo do mês corrente (1º dia → hoje), memoizado por request. */
export const getResumoFaturamentoMesAtual = cache(
  async (): Promise<ResumoFaturamento | null> =>
    getResumoFaturamento(primeiroDiaDoMes(), hojeISO(), FILIAL),
);
```

(O corpo do mapeamento é idêntico ao que já existia — só passou para a função parametrizada. Manter os imports `cache`, `primeiroDiaDoMes`, `hojeISO` como estão.)

- [ ] **Step 2: Verificar typecheck e testes existentes**

Run: `npx tsc --noEmit && npx vitest run src/domain/faturamento.test.ts`
Expected: sem erros de tipo; testes de `taxaDevolucao`/`percentualCustoLogistico` continuam passando (não dependem da mudança).

- [ ] **Step 3: Validar contra o banco (mês fechado conhecido)**

Criar script temporário `_valida-fat.mjs` na raiz (é apagado no fim), carregando `.env.local`, chamando a MESMA `SQL` para maio/2026 (`ini=2026-05-01, fim=2026-05-31, filial=1`) e conferindo `VALOR_DEVOLUCAO_AVULSA ≈ 4390`/`9160`-família e `EMITIDAS`. (Reusar o formato dos scripts `_diag*.mjs` do histórico da branch de devolução.)

Run: `node _valida-fat.mjs && rm -f _valida-fat.mjs`
Expected: números coerentes com a rotina 111 de maio (avulsa 9.160,80, emitidas 31769).

- [ ] **Step 4: Commit**

```bash
git add src/data/faturamento.ts
git commit -m "refactor: getResumoFaturamento(ini,fim,filial) parametrizado"
```

---

### Task 5: Serviço de snapshot (`data/faturamento-mensal.ts`)

**Files:**
- Create: `src/data/faturamento-mensal.ts`

**Interfaces:**
- Consumes: `createClient` de `@/lib/supabase/server`; `getResumoFaturamento` de `./faturamento`; `primeiroDiaDoMes`, `inicioFimDoMes` de `@/domain/periodo`; `mesesFechados`, `PontoTendencia` de `@/domain/tendencias`.
- Produces:
  - `getFaturamentoMensal(mes: string): Promise<PontoTendencia | null>`
  - `getSerieTendencias(qtd?: number): Promise<PontoTendencia[]>`

- [ ] **Step 1: Implementar o serviço**

Create `src/data/faturamento-mensal.ts`:

```ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getResumoFaturamento } from "./faturamento";
import type { ResumoFaturamento } from "@/domain/faturamento";
import { primeiroDiaDoMes, inicioFimDoMes } from "@/domain/periodo";
import { mesesFechados, type PontoTendencia } from "@/domain/tendencias";

const FILIAL = "1";
const COLUNAS =
  "mes, venda_faturada, venda_liquida, valor_devolucao, valor_devolucao_avulsa, " +
  "devolvidas, devolvidas_avulsas, peso_faturado, peso_devolucao, emitidas, positivados";

const num = (v: unknown): number => Number(v) || 0;

function rowToPonto(row: Record<string, unknown>): PontoTendencia {
  return {
    mes: primeiroDiaDoMes(String(row.mes)), // normaliza p/ "YYYY-MM-01"
    vendaFaturada: num(row.venda_faturada),
    vendaLiquida: num(row.venda_liquida),
    valorDevolucao: num(row.valor_devolucao),
    valorDevolucaoAvulsa: num(row.valor_devolucao_avulsa),
    devolvidas: num(row.devolvidas),
    devolvidasAvulsas: num(row.devolvidas_avulsas),
    pesoFaturado: num(row.peso_faturado),
    pesoDevolucao: num(row.peso_devolucao),
    emitidas: num(row.emitidas),
    positivados: num(row.positivados),
  };
}

function resumoToPonto(mes: string, r: ResumoFaturamento): PontoTendencia {
  return {
    mes,
    vendaFaturada: r.vendaFaturada,
    vendaLiquida: r.vendaLiquida,
    valorDevolucao: r.valorDevolucao,
    valorDevolucaoAvulsa: r.valorDevolucaoAvulsa,
    devolvidas: r.devolvidas,
    devolvidasAvulsas: r.devolvidasAvulsas,
    pesoFaturado: r.pesoFaturado,
    pesoDevolucao: r.pesoDevolucao,
    emitidas: r.emitidas,
    positivados: r.positivados,
  };
}

/**
 * Foto de um mês. Lê do Supabase; se faltar e o mês estiver FECHADO, calcula do
 * Winthor uma vez e grava (INSERT ... ON CONFLICT DO NOTHING). Mês corrente/futuro
 * é calculado ao vivo e NÃO gravado. `null` se o Winthor estiver indisponível.
 */
export async function getFaturamentoMensal(mes: string): Promise<PontoTendencia | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faturamento_mensal")
    .select(COLUNAS)
    .eq("mes", mes)
    .eq("filial", FILIAL)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return rowToPonto(data as Record<string, unknown>);

  const { inicio, fim } = inicioFimDoMes(mes);
  const r = await getResumoFaturamento(inicio, fim, FILIAL);
  if (!r) return null; // Winthor offline: não grava

  const ponto = resumoToPonto(mes, r);

  // Só congela mês FECHADO (o corrente muda ao longo do dia).
  if (mes < primeiroDiaDoMes()) {
    await supabase.from("faturamento_mensal").upsert(
      {
        mes, filial: FILIAL,
        venda_faturada: r.vendaFaturada,
        venda_liquida: r.vendaLiquida,
        valor_devolucao: r.valorDevolucao,
        valor_devolucao_avulsa: r.valorDevolucaoAvulsa,
        devolvidas: r.devolvidas,
        devolvidas_avulsas: r.devolvidasAvulsas,
        peso_faturado: r.pesoFaturado,
        peso_devolucao: r.pesoDevolucao,
        emitidas: r.emitidas,
        positivados: r.positivados,
      },
      { onConflict: "mes,filial", ignoreDuplicates: true }, // = INSERT ... ON CONFLICT DO NOTHING
    );
  }
  return ponto;
}

/** Série dos últimos `qtd` meses fechados (backfill dos que faltam). */
export const getSerieTendencias = cache(
  async (qtd = 12): Promise<PontoTendencia[]> => {
    const meses = mesesFechados(new Date(), qtd);
    const pontos = await Promise.all(meses.map((m) => getFaturamentoMensal(m)));
    return pontos.filter((p): p is PontoTendencia => p !== null);
  },
);
```

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Validar o lazy backfill contra o banco**

Com o dev server logado ou um script server-side, chamar `getSerieTendencias(3)` duas vezes:
- 1ª chamada: gera as fotos (verificar que `select count(*) from faturamento_mensal` subiu no Supabase).
- 2ª chamada: retorna os mesmos números **sem** novas linhas (idempotência).
- Conferir que um mês fechado (ex.: maio/2026) tem `valor_devolucao_avulsa = 9160.80` gravado.

Expected: 2ª chamada não cria linhas; valores conferem com a rotina 111.

- [ ] **Step 4: Commit**

```bash
git add src/data/faturamento-mensal.ts
git commit -m "feat: serviço de snapshot mensal (lazy backfill)"
```

---

### Task 6: Componente de gráfico SVG (`components/line-chart.tsx`)

**Files:**
- Create: `src/components/line-chart.tsx`

**Interfaces:**
- Consumes: `pontosLinha` de `@/domain/tendencias`.
- Produces: `LineChart({ titulo, valores, rotulos, formato, cor }: LineChartProps)` — componente RSC que desenha uma linha SVG com o último valor destacado.
  - `interface LineChartProps { titulo: string; valores: number[]; rotulos: string[]; formato: (v: number) => string; cor?: string }`

- [ ] **Step 1: Implementar o componente**

Create `src/components/line-chart.tsx`:

```tsx
import { pontosLinha } from "@/domain/tendencias";
import { Card } from "@/components/ui";

export interface LineChartProps {
  titulo: string;
  valores: number[];
  rotulos: string[]; // mesmo tamanho de `valores` (ex.: "Mai/26")
  formato: (v: number) => string;
  cor?: string; // cor da linha; default azul-marinho DIA
}

const W = 320;
const H = 120;

export function LineChart({ titulo, valores, rotulos, formato, cor = "#1b2168" }: LineChartProps) {
  const temDados = valores.length > 0;
  const { pontos, marcadores } = pontosLinha(valores, W, H, 8);
  const ultimo = marcadores[marcadores.length - 1];

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium text-slate-500">{titulo}</h3>
        {temDados && (
          <span className="text-lg font-semibold tabular-nums text-[#141a4d]">
            {formato(valores[valores.length - 1])}
          </span>
        )}
      </div>
      {temDados ? (
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={titulo}>
          <polyline points={pontos} fill="none" stroke={cor} strokeWidth="2"
            strokeLinejoin="round" strokeLinecap="round" />
          {ultimo && <circle cx={ultimo.x} cy={ultimo.y} r="3.5" fill={cor} />}
        </svg>
      ) : (
        <p className="py-6 text-center text-sm text-slate-400">Sem dados no período.</p>
      )}
      {temDados && (
        <div className="mt-1 flex justify-between text-[10px] text-slate-400">
          <span>{rotulos[0]}</span>
          <span>{rotulos[rotulos.length - 1]}</span>
        </div>
      )}
    </Card>
  );
}
```

(Se `Card` não for exportado de `@/components/ui`, conferir o caminho real usado em `devolucoes/page.tsx` — lá `Card` vem de `@/components/ui` — e usar o mesmo.)

- [ ] **Step 2: Verificar typecheck**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/line-chart.tsx
git commit -m "feat: componente LineChart (SVG)"
```

---

### Task 7: Página Tendências + item no menu

**Files:**
- Create: `src/app/(app)/tendencias/page.tsx`
- Create: `src/app/(app)/tendencias/loading.tsx`
- Modify: `src/app/(app)/sidebar-nav.tsx`

**Interfaces:**
- Consumes: `getSerieTendencias` de `@/data/faturamento-mensal`; `LineChart` de `@/components/line-chart`; `taxaDevolucaoMensal` de `@/domain/tendencias`; `formatBRL`, `formatPercent`, `formatKg` de `@/domain/format`; `formatMesAno` de `@/domain/periodo`; `PageHeader` de `@/components/ui`.
- Produces: rota `/tendencias`; novo item de menu.

- [ ] **Step 1: Criar a página**

Create `src/app/(app)/tendencias/page.tsx`:

```tsx
import { getSerieTendencias } from "@/data/faturamento-mensal";
import { taxaDevolucaoMensal } from "@/domain/tendencias";
import { formatBRL, formatPercent, formatKg } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { LineChart } from "@/components/line-chart";
import { PageHeader, Card } from "@/components/ui";

export default async function TendenciasPage() {
  const serie = await getSerieTendencias(12);
  const rotulos = serie.map((p) => formatMesAno(p.mes).replace(/(\w{3})\w*\/(\d{2})\d{2}/, "$1/$2"));

  if (serie.length === 0) {
    return (
      <div>
        <PageHeader title="Tendências" subtitle="Evolução mês a mês · Winthor" />
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Sem histórico disponível — sem conexão com o Winthor (o banco só responde de dentro
            da rede da empresa) ou ainda não há meses fechados.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Tendências" subtitle={`Últimos ${serie.length} meses fechados · filial 1`} />
      <div className="grid gap-4 sm:grid-cols-2">
        <LineChart
          titulo="Taxa de devolução"
          valores={serie.map((p) => taxaDevolucaoMensal(p) * 100)}
          rotulos={rotulos}
          formato={(v) => formatPercent(v / 100)}
          cor="#e11d48"
        />
        <LineChart
          titulo="Venda líquida"
          valores={serie.map((p) => p.vendaLiquida)}
          rotulos={rotulos}
          formato={formatBRL}
        />
        <LineChart
          titulo="Valor devolução"
          valores={serie.map((p) => p.valorDevolucao)}
          rotulos={rotulos}
          formato={formatBRL}
          cor="#e11d48"
        />
        <LineChart
          titulo="Peso devolvido"
          valores={serie.map((p) => p.pesoDevolucao)}
          rotulos={rotulos}
          formato={formatKg}
          cor="#f59e0b"
        />
      </div>
    </div>
  );
}
```

(Conferir a assinatura real de `PageHeader`/`formatKg` em `devolucoes/page.tsx` e `domain/format.ts`; ajustar props se diferirem. Se `formatPercent` já espera 0..1, passar `taxaDevolucaoMensal(p)` direto e simplificar o `formato`.)

- [ ] **Step 2: Criar o loading skeleton**

Create `src/app/(app)/tendencias/loading.tsx`:

```tsx
export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-9 w-48 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Adicionar o item no menu**

Em `src/app/(app)/sidebar-nav.tsx`, adicionar ao array `items` (depois de "Devoluções"):

```tsx
  {
    href: "/tendencias",
    label: "Tendências",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M17 7h4v4" />
      </svg>
    ),
  },
```

- [ ] **Step 4: Verificar typecheck e build**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 5: Verificar no navegador (dev server logado)**

Subir o dev server (`preview_start name: "dev"`), logar, abrir `/tendencias`. Conferir: 4 gráficos com linha e último valor; item "Tendências" no menu ativo; skeleton aparece no carregamento. Conferir `preview_logs` sem erro.
Expected: página renderiza os 4 gráficos com os meses fechados.

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/tendencias/ src/app/\(app\)/sidebar-nav.tsx
git commit -m "feat: aba Tendências (4 gráficos SVG) + item no menu"
```

---

## Self-Review

**Spec coverage:**
- Tabela `faturamento_mensal` + RLS → Task 1. ✓
- Lazy backfill (mês fechado grava, corrente não) → Task 5. ✓
- Refactor `getResumoFaturamento(ini,fim,filial)` → Task 4. ✓
- Domínio testável (`mesesFechados`, taxa, escala) → Tasks 2–3. ✓
- Aba Tendências, 4 indicadores (taxa %, venda líquida, valor devolução, NFs/peso) → Task 7. ✓ (Peso devolvido como 4º; "NFs devolvidas" pode substituir/adicionar — ver nota abaixo.)
- Gráficos SVG sem dependência → Tasks 6–7. ✓
- Estados de erro (Winthor offline, sem dados) → Tasks 5 (null, não grava) e 7 (tela vazia). ✓
- Testes → Tasks 2, 3 (vitest) + validação de banco em 4, 5. ✓

**Nota de escopo (indicadores):** o spec lista "NFs / peso devolvido" como um indicador. O plano usa **peso devolvido** no 4º gráfico. Se preferir NFs devolvidas (ou os dois), trocar `valores={serie.map(p => p.pesoDevolucao)}`/`formato={formatKg}` por `p.devolvidas`/`(v)=>String(v)`. Decisão cosmética, resolvível na Task 7 sem mudar a arquitetura.

**Placeholder scan:** sem TBD/TODO; todo passo com código ou comando concreto. Passos de validação de banco (Tasks 4/5) descrevem exatamente o que rodar e o número esperado (avulsa maio 9.160,80). ✓

**Type consistency:** `PontoTendencia` definido na Task 3 e consumido idêntico em 5 e 7; `getResumoFaturamento(ini,fim,filial)` definido em 4 e consumido em 5; `pontosLinha`/`LineChartProps` consistentes entre 3, 6 e 7. ✓

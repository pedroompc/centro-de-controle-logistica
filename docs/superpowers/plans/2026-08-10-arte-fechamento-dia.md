# Arte de Fechamento do Dia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma página `/fechamento` que gera uma arte (PNG) com o resumo do dia/período da operação e a compartilha pela bandeja nativa do celular.

**Architecture:** Camada de domínio pura (view-model + rótulos, testável) → camada de dados que orquestra faturamento (Winthor/Oracle), receitas e faltas (Supabase) → rota `next/og` que rasteriza um card flexbox em PNG → página com seletor de dia/período, preview (`<img>`) e botão de compartilhar.

**Tech Stack:** Next 16 (App Router, modificado), React 19, `next/og` (`ImageResponse`/Satori), Supabase, Oracle (Winthor), Tailwind v4, Vitest.

## Global Constraints

- **Next modificado:** antes de codar a rota, reler `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md` — API confirmada nesta versão: `import { ImageResponse } from "next/og"`.
- **`ImageResponse` só suporta FLEXBOX** — `display: grid` **não funciona** (Satori). A grade 2×2 do card é feita com flex (duas linhas × dois tiles).
- **Fontes:** só `ttf`/`otf`/`woff`; carregar via `readFile`. Bundle do OG ≤ 500KB (3 pesos de Sora ~210KB, ok).
- **Sem novas dependências npm** (o projeto mantém `dependencies` enxuto).
- **Identidade:** verde **só** para receita; navy + âmbar; nunca verde em status/categoria.
- **Devolução no card = taxa do MÊS** (acumulada), via `taxaDevolucao()` do resumo mensal — nunca a devolução do dia.
- **Peso em kg** (via `formatKg`). Faturamento consolidado das **filiais 1 + 11** (já embutido em `getResumoFaturamento`).
- **Faturamento é server-only** (Oracle interno); quando indisponível, `getResumoFaturamento` retorna `null` e o card mostra "—".

---

## Task 1: Domínio — view-model e rótulos do fechamento

**Files:**
- Create: `src/domain/fechamento.ts`
- Test: `src/domain/fechamento.test.ts`

**Interfaces:**
- Consumes: `ResumoFaturamento` e `taxaDevolucao` de `src/domain/faturamento.ts`; `INICIO_HISTORICO` de `src/domain/periodo.ts`.
- Produces:
  - `interface ResumoFechamento` (campos abaixo).
  - `montarResumoFechamento(input): ResumoFechamento`
  - `rotuloPeriodo(ini: string, fim: string): { eyebrow: string; titulo: string }`
  - `intervaloDias(a: string, b: string): { ini: string; fim: string }` (ordena)
  - `clampDia(iso: string, hoje?: Date): string`
  - `hojeISO(hoje?: Date): string`

- [ ] **Step 1: Write the failing test**

Create `src/domain/fechamento.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  montarResumoFechamento,
  rotuloPeriodo,
  intervaloDias,
  clampDia,
  hojeISO,
} from "./fechamento";
import type { ResumoFaturamento } from "./faturamento";

const fatur = (over: Partial<ResumoFaturamento> = {}): ResumoFaturamento => ({
  emitidas: 1240, positivados: 300, atendimentos: 318,
  devolvidas: 10, devolvidasAvulsas: 2,
  vendaFaturada: 487320, valorDevolucao: 23400, valorDevolucaoAvulsa: 0,
  vendaLiquida: 463920, pesoFaturado: 128400, pesoDevolucao: 6000,
  ...over,
});

describe("montarResumoFechamento", () => {
  it("mapeia faturamento presente e calcula a taxa do mês", () => {
    const r = montarResumoFechamento({
      ini: "2026-08-10", fim: "2026-08-10",
      faturamentoPeriodo: fatur(),
      faturamentoMes: fatur({ vendaFaturada: 1000000, valorDevolucao: 48000 }),
      receitasLogisticas: 3210, faltas: 2,
    });
    expect(r.isPeriodo).toBe(false);
    expect(r.faturamentoBruto).toBe(487320);
    expect(r.pdvsAtendidos).toBe(318);
    expect(r.notasEmitidas).toBe(1240);
    expect(r.pesoFaturadoKg).toBe(128400);
    expect(r.taxaDevolucaoMes).toBeCloseTo(0.048, 3);
    expect(r.receitasLogisticas).toBe(3210);
    expect(r.faltas).toBe(2);
  });

  it("Winthor indisponível → campos do faturamento e taxa viram null", () => {
    const r = montarResumoFechamento({
      ini: "2026-08-01", fim: "2026-08-10",
      faturamentoPeriodo: null, faturamentoMes: null,
      receitasLogisticas: 500, faltas: 0,
    });
    expect(r.isPeriodo).toBe(true);
    expect(r.faturamentoBruto).toBeNull();
    expect(r.taxaDevolucaoMes).toBeNull();
    expect(r.receitasLogisticas).toBe(500);
  });
});

describe("rotuloPeriodo", () => {
  it("dia único", () => {
    const { eyebrow, titulo } = rotuloPeriodo("2026-08-10", "2026-08-10");
    expect(eyebrow).toContain("Fechamento do dia");
    expect(titulo).toContain("10 de agosto");
  });
  it("período no mesmo mês", () => {
    const { eyebrow, titulo } = rotuloPeriodo("2026-08-01", "2026-08-10");
    expect(eyebrow).toContain("Período");
    expect(titulo).toBe("1 a 10 de agosto");
  });
  it("período entre meses", () => {
    const { titulo } = rotuloPeriodo("2026-07-28", "2026-08-03");
    expect(titulo).toBe("28 de julho a 3 de agosto");
  });
});

describe("intervaloDias / clampDia", () => {
  it("ordena datas trocadas", () => {
    expect(intervaloDias("2026-08-10", "2026-08-01")).toEqual({ ini: "2026-08-01", fim: "2026-08-10" });
  });
  it("prende ao histórico e a hoje", () => {
    const hoje = new Date("2026-08-10T12:00:00Z");
    expect(clampDia("2026-06-01", hoje)).toBe("2026-07-01");
    expect(clampDia("2026-12-31", hoje)).toBe("2026-08-10");
    expect(clampDia("2026-08-05", hoje)).toBe("2026-08-05");
  });
  it("hojeISO formata a data local", () => {
    expect(hojeISO(new Date("2026-08-10T12:00:00Z"))).toBe("2026-08-10");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/fechamento.test.ts`
Expected: FAIL (module `./fechamento` não existe).

- [ ] **Step 3: Write minimal implementation**

Create `src/domain/fechamento.ts`:

```ts
import type { ResumoFaturamento } from "./faturamento";
import { taxaDevolucao } from "./faturamento";
import { INICIO_HISTORICO } from "./periodo";

/** Resumo consolidado do dia/período para a arte de fechamento. */
export interface ResumoFechamento {
  isPeriodo: boolean;
  // Vindos do Winthor — null quando indisponível (fora da rede).
  faturamentoBruto: number | null;
  pdvsAtendidos: number | null;
  notasEmitidas: number | null;
  pesoFaturadoKg: number | null;
  taxaDevolucaoMes: number | null; // 0..1
  // Vindos do Supabase — sempre disponíveis.
  receitasLogisticas: number;
  faltas: number;
}

export function montarResumoFechamento(input: {
  ini: string;
  fim: string;
  faturamentoPeriodo: ResumoFaturamento | null;
  faturamentoMes: ResumoFaturamento | null;
  receitasLogisticas: number;
  faltas: number;
}): ResumoFechamento {
  const f = input.faturamentoPeriodo;
  return {
    isPeriodo: input.ini !== input.fim,
    faturamentoBruto: f ? f.vendaFaturada : null,
    pdvsAtendidos: f ? f.atendimentos : null,
    notasEmitidas: f ? f.emitidas : null,
    pesoFaturadoKg: f ? f.pesoFaturado : null,
    taxaDevolucaoMes: input.faturamentoMes ? taxaDevolucao(input.faturamentoMes) : null,
    receitasLogisticas: input.receitasLogisticas,
    faltas: input.faltas,
  };
}

// Datas em UTC para o texto não "escorregar" um dia por fuso.
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const diaNum = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", timeZone: "UTC" }).format(d(iso));
const mesLongo = (iso: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(d(iso));
const diaMes = (iso: string) => `${diaNum(iso)} de ${mesLongo(iso)}`;
const semanaExtenso = (iso: string) =>
  cap(new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(d(iso)));

export function rotuloPeriodo(ini: string, fim: string): { eyebrow: string; titulo: string } {
  if (ini === fim) {
    return {
      eyebrow: "Centro de Controle · Fechamento do dia",
      titulo: `${semanaExtenso(ini)}, ${diaMes(ini)}`,
    };
  }
  const mesmoMes = ini.slice(0, 7) === fim.slice(0, 7);
  const titulo = mesmoMes
    ? `${diaNum(ini)} a ${diaNum(fim)} de ${mesLongo(fim)}`
    : `${diaMes(ini)} a ${diaMes(fim)}`;
  return { eyebrow: "Centro de Controle · Período", titulo };
}

export function intervaloDias(a: string, b: string): { ini: string; fim: string } {
  return a <= b ? { ini: a, fim: b } : { ini: b, fim: a };
}

export function hojeISO(hoje: Date = new Date()): string {
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function clampDia(iso: string, hoje: Date = new Date()): string {
  const hj = hojeISO(hoje);
  if (iso < INICIO_HISTORICO) return INICIO_HISTORICO;
  if (iso > hj) return hj;
  return iso;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/domain/fechamento.test.ts`
Expected: PASS (todos os casos).

- [ ] **Step 5: Commit**

```bash
git add src/domain/fechamento.ts src/domain/fechamento.test.ts
git commit -m "feat(fechamento): domínio do resumo do dia/período (view-model + rótulos)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Camada de dados — `montarFechamento(ini, fim)`

**Files:**
- Create: `src/data/fechamento.ts`

**Interfaces:**
- Consumes: `getResumoFaturamento` (`src/data/faturamento.ts`), `listarFaltas` (`src/data/faltas.ts`), `listarFuncionarios` (`src/data/funcionarios.ts`), `createClient` (`src/lib/supabase/server.ts`), `primeiroDiaDoMes` (`src/domain/periodo.ts`), `faltasNoPeriodo` (`src/domain/metrics.ts`), `montarResumoFechamento`/`ResumoFechamento` (`src/domain/fechamento.ts`).
- Produces: `montarFechamento(ini: string, fim: string): Promise<ResumoFechamento>`

> Sem teste unitário: é orquestração de I/O (Oracle + Supabase), no mesmo espírito dos outros `src/data/*.ts` de I/O. A lógica pura já é coberta pela Task 1.

- [ ] **Step 1: Write the implementation**

Create `src/data/fechamento.ts`:

```ts
import { getResumoFaturamento } from "./faturamento";
import { listarFaltas } from "./faltas";
import { listarFuncionarios } from "./funcionarios";
import { createClient } from "@/lib/supabase/server";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { faltasNoPeriodo } from "@/domain/metrics";
import { montarResumoFechamento, type ResumoFechamento } from "@/domain/fechamento";

/** Soma das três origens de receita logística no intervalo [ini, fim]. */
async function receitaTotalDoPeriodo(ini: string, fim: string): Promise<number> {
  const supabase = await createClient();
  const [desc, diarios, diversas] = await Promise.all([
    supabase.from("receitas_descarregamento").select("receita").gte("data", ini).lte("data", fim),
    supabase.from("receitas_descarregamento_diario").select("receita").gte("data", ini).lte("data", fim),
    supabase.from("receitas_diversas").select("valor").gte("data", ini).lte("data", fim),
  ]);
  if (desc.error) throw new Error(desc.error.message);
  if (diarios.error) throw new Error(diarios.error.message);
  if (diversas.error) throw new Error(diversas.error.message);
  const soma = (rows: Array<Record<string, unknown>> | null, col: string) =>
    (rows ?? []).reduce((t, r) => t + Number(r[col]), 0);
  return soma(desc.data, "receita") + soma(diarios.data, "receita") + soma(diversas.data, "valor");
}

/**
 * Monta o resumo de fechamento para o intervalo [ini, fim]. O faturamento vem do
 * Winthor (dia/período e mês, este p/ a taxa de devolução); receitas e faltas do
 * Supabase. Se o Winthor estiver fora, os campos dele vêm null (o card mostra "—").
 */
export async function montarFechamento(ini: string, fim: string): Promise<ResumoFechamento> {
  const [faturamentoPeriodo, faturamentoMes, receitasLogisticas, faltasLista, funcionarios] =
    await Promise.all([
      getResumoFaturamento(ini, fim),
      getResumoFaturamento(primeiroDiaDoMes(fim), fim),
      receitaTotalDoPeriodo(ini, fim),
      listarFaltas(),
      listarFuncionarios(),
    ]);
  const faltas = faltasNoPeriodo(faltasLista, funcionarios.map((f) => f.id), ini, fim);
  return montarResumoFechamento({ ini, fim, faturamentoPeriodo, faturamentoMes, receitasLogisticas, faltas });
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/data/fechamento.ts
git commit -m "feat(fechamento): camada de dados montarFechamento(ini,fim)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Fonte Sora para o OG

**Files:**
- Create: `src/assets/fonts/sora-600.ttf`, `src/assets/fonts/sora-700.ttf`, `src/assets/fonts/sora-800.ttf`

> `ImageResponse` precisa dos bytes da fonte (não usa `next/font`). Usamos os `.ttf` estáticos da Sora (Fontsource, via jsdelivr — sem dependência npm).

- [ ] **Step 1: Baixar os três pesos**

```bash
mkdir -p src/assets/fonts
curl -fsSL -o src/assets/fonts/sora-600.ttf https://cdn.jsdelivr.net/fontsource/fonts/sora@latest/latin-600-normal.ttf
curl -fsSL -o src/assets/fonts/sora-700.ttf https://cdn.jsdelivr.net/fontsource/fonts/sora@latest/latin-700-normal.ttf
curl -fsSL -o src/assets/fonts/sora-800.ttf https://cdn.jsdelivr.net/fontsource/fonts/sora@latest/latin-800-normal.ttf
```

- [ ] **Step 2: Conferir que são TTF válidos e < 500KB somados**

Run: `file src/assets/fonts/*.ttf && ls -l src/assets/fonts/*.ttf`
Expected: cada um reportado como "TrueType Font"/"OpenType" e soma bem abaixo de 500KB.

- [ ] **Step 3: Commit**

```bash
git add src/assets/fonts/sora-600.ttf src/assets/fonts/sora-700.ttf src/assets/fonts/sora-800.ttf
git commit -m "chore(fechamento): fontes Sora (ttf) para o next/og

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Componente da arte (JSX flexbox p/ o OG)

**Files:**
- Create: `src/app/(app)/fechamento/arte-card.tsx`

**Interfaces:**
- Consumes: `ResumoFechamento`, `rotuloPeriodo` (`@/domain/fechamento`); `formatBRL`, `formatKg`, `formatPercent` (`@/domain/format`).
- Produces: `ArteFechamento(props: { resumo: ResumoFechamento; ini: string; fim: string; geradoEm: string }): ReactElement` (JSX **só flexbox**, para o `ImageResponse`).

> ⚠️ Nada de `display: grid`, `gap` em grid, `box-shadow` complexa ou unidades não suportadas — só flexbox, cores sólidas, `linear-gradient` de fundo, `border`, `borderRadius`. Todo texto usa `fontFamily: "Sora"`.

- [ ] **Step 1: Write the implementation**

Create `src/app/(app)/fechamento/arte-card.tsx`:

```tsx
import type { ReactElement } from "react";
import type { ResumoFechamento } from "@/domain/fechamento";
import { rotuloPeriodo } from "@/domain/fechamento";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";

const WHITE = "#ffffff";
const AMBER = "#f5b301";
const GREEN = "#34d399";
const MUTED = "rgba(255,255,255,0.55)";
const FAINT = "rgba(255,255,255,0.42)";

function Tile({ label, value, color = WHITE }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", flex: 1,
        backgroundColor: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)",
        borderRadius: 22, padding: "26px 28px",
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, color: MUTED, textTransform: "uppercase" }}>
        {label}
      </div>
      <div style={{ fontSize: 48, fontWeight: 800, color, marginTop: 12 }}>{value}</div>
    </div>
  );
}

export function ArteFechamento({
  resumo, ini, fim, geradoEm,
}: {
  resumo: ResumoFechamento; ini: string; fim: string; geradoEm: string;
}): ReactElement {
  const { eyebrow, titulo } = rotuloPeriodo(ini, fim);
  const fatur = resumo.faturamentoBruto === null ? "—" : formatBRL(resumo.faturamentoBruto);
  const sub =
    resumo.faturamentoBruto === null
      ? "Faturamento indisponível (fora da rede)"
      : `${resumo.pdvsAtendidos} PDVs atendidos · ${resumo.notasEmitidas} notas emitidas`;
  const peso = resumo.pesoFaturadoKg === null ? "—" : formatKg(resumo.pesoFaturadoKg);
  const taxa = resumo.taxaDevolucaoMes === null ? "—" : formatPercent(resumo.taxaDevolucaoMes);

  return (
    <div
      style={{
        width: "100%", height: "100%", display: "flex", flexDirection: "column",
        padding: 72, color: WHITE, fontFamily: "Sora",
        backgroundImage: "linear-gradient(160deg, #0a1650 0%, #111c5b 55%, #16205f 100%)",
      }}
    >
      {/* Marca */}
      <div style={{ display: "flex", alignItems: "baseline" }}>
        <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -1, color: WHITE }}>DIA</div>
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: 10, color: MUTED, marginLeft: 20, textTransform: "uppercase" }}>
          Distribuição
        </div>
      </div>

      {/* Contexto + data */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: 56 }}>
        <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 3, color: "#f5c451", textTransform: "uppercase" }}>
          {eyebrow}
        </div>
        <div style={{ fontSize: 44, fontWeight: 700, color: WHITE, marginTop: 10 }}>{titulo}</div>
      </div>

      {/* Herói — faturamento bruto */}
      <div style={{ display: "flex", marginTop: 48 }}>
        <div style={{ width: 10, backgroundColor: AMBER, borderRadius: 6, marginRight: 26 }} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 4, color: MUTED, textTransform: "uppercase" }}>
            Faturamento bruto
          </div>
          <div style={{ fontSize: 104, fontWeight: 800, letterSpacing: -3, color: WHITE, marginTop: 8 }}>{fatur}</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: "rgba(255,255,255,0.5)", marginTop: 12 }}>{sub}</div>
        </div>
      </div>

      {/* Tiles 2x2 (flexbox) */}
      <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
        <div style={{ display: "flex" }}>
          <Tile label="Receitas logísticas" value={formatBRL(resumo.receitasLogisticas)} color={GREEN} />
          <div style={{ width: 22 }} />
          <Tile label="Peso faturado" value={peso} />
        </div>
        <div style={{ height: 22 }} />
        <div style={{ display: "flex" }}>
          <Tile label="Devolução · mês" value={taxa} color={AMBER} />
          <div style={{ width: 22 }} />
          <Tile label="Faltas no dia" value={String(resumo.faltas)} />
        </div>
      </div>

      {/* Rodapé */}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 44, paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.12)", fontSize: 20, fontWeight: 600, color: FAINT }}>
        <div>Gerado {geradoEm}</div>
        <div>Filiais 1 + 11</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/fechamento/arte-card.tsx"
git commit -m "feat(fechamento): componente da arte (JSX flexbox p/ next/og)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Rota `next/og` que gera o PNG

**Files:**
- Create: `src/app/(app)/fechamento/arte/route.ts`

**Interfaces:**
- Consumes: `ImageResponse` (`next/og`); `montarFechamento` (`@/data/fechamento`); `intervaloDias`, `clampDia`, `hojeISO` (`@/domain/fechamento`); `ArteFechamento` (`../arte-card`).
- Produces: `GET(request: Request): Promise<Response>` (PNG) na rota `/fechamento/arte?ini=&fim=`.

> Auth: a rota está sob `(app)`, e o `proxy` protege tudo que não é asset com extensão — `/fechamento/arte` (sem extensão) exige login. Admin e viewer podem gerar.

- [ ] **Step 1: (Reler a doc)** `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/image-response.md` — confirmar assinatura de `ImageResponse` e do array `fonts`.

- [ ] **Step 2: Write the implementation**

Create `src/app/(app)/fechamento/arte/route.ts`:

```ts
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { montarFechamento } from "@/data/fechamento";
import { intervaloDias, clampDia, hojeISO } from "@/domain/fechamento";
import { ArteFechamento } from "../arte-card";

// readFile/Node APIs → runtime Node (não Edge).
export const runtime = "nodejs";
// Sempre ao vivo (bate no Winthor a cada request).
export const dynamic = "force-dynamic";

function geradoEmBR(agora = new Date()): string {
  const fmt = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  // "10/08, 17:42" → "10/08 · 17:42"
  return fmt.format(agora).replace(", ", " · ");
}

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const hoje = hojeISO();
    const iniBruto = clampDia(searchParams.get("ini") ?? hoje);
    const fimBruto = clampDia(searchParams.get("fim") ?? iniBruto);
    const { ini, fim } = intervaloDias(iniBruto, fimBruto);

    const resumo = await montarFechamento(ini, fim);

    const dir = join(process.cwd(), "src/assets/fonts");
    const [s600, s700, s800] = await Promise.all([
      readFile(join(dir, "sora-600.ttf")),
      readFile(join(dir, "sora-700.ttf")),
      readFile(join(dir, "sora-800.ttf")),
    ]);

    return new ImageResponse(
      ArteFechamento({ resumo, ini, fim, geradoEm: geradoEmBR() }),
      {
        width: 1080,
        height: 1350,
        fonts: [
          { name: "Sora", data: s600, weight: 600, style: "normal" },
          { name: "Sora", data: s700, weight: 700, style: "normal" },
          { name: "Sora", data: s800, weight: 800, style: "normal" },
        ],
      },
    );
  } catch (e) {
    console.error("[fechamento/arte]", (e as Error).message);
    return new Response("Falha ao gerar a arte", { status: 500 });
  }
}
```

- [ ] **Step 3: Verify — subir o dev e conferir o PNG**

Passos (com sessão logada no preview):
1. `preview_start { name: "dev" }`.
2. Autenticar (login Supabase no preview) e abrir `http://localhost:3000/fechamento/arte?ini=2026-08-10&fim=2026-08-10`.
3. Verificar `read_network_requests` para a rota: `Content-Type: image/png`, status 200, tamanho > 20KB.
4. Conferir visualmente (screenshot) — layout do card conforme o mockup aprovado.

Expected: PNG 1080×1350 renderiza; sem erro no `preview_logs`. (Fora da rede, faturamento aparece "—" — comportamento esperado.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/fechamento/arte/route.ts"
git commit -m "feat(fechamento): rota next/og que gera o PNG da arte

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Botão de compartilhar (client)

**Files:**
- Create: `src/app/(app)/fechamento/compartilhar-button.tsx`

**Interfaces:**
- Consumes: nada do projeto (usa Web APIs).
- Produces: `<CompartilharButton src={string} />` — `fetch` do PNG → `navigator.share({ files })` ou download.

- [ ] **Step 1: Write the implementation**

Create `src/app/(app)/fechamento/compartilhar-button.tsx`:

```tsx
"use client";

import { useState } from "react";

export function CompartilharButton({ src }: { src: string }) {
  const [ocupado, setOcupado] = useState(false);

  async function compartilhar() {
    setOcupado(true);
    try {
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok) throw new Error("falha ao gerar a arte");
      const blob = await res.blob();
      const file = new File([blob], "fechamento-dia.png", { type: "image/png" });

      const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Fechamento do dia — DIA" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "fechamento-dia.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // AbortError = usuário fechou a bandeja; ignorar.
      if ((e as Error).name !== "AbortError") console.error(e);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      disabled={ocupado}
      className="inline-flex items-center gap-2 rounded-xl bg-[#181d55] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#10143f] active:bg-[#10143f] disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
      </svg>
      {ocupado ? "Gerando…" : "Compartilhar"}
    </button>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/fechamento/compartilhar-button.tsx"
git commit -m "feat(fechamento): botão compartilhar (Web Share + fallback download)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Seletor de dia/período (client)

**Files:**
- Create: `src/app/(app)/fechamento/seletor-periodo.tsx`

**Interfaces:**
- Consumes: `useRouter` (`next/navigation`).
- Produces: `<SeletorPeriodo ini={string} fim={string} />` — inputs de data que dão `router.push("/fechamento?ini=&fim=")`.

- [ ] **Step 1: Write the implementation**

Create `src/app/(app)/fechamento/seletor-periodo.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const input =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function SeletorPeriodo({ ini, fim }: { ini: string; fim: string }) {
  const router = useRouter();
  const [periodo, setPeriodo] = useState(ini !== fim);
  const [dini, setDini] = useState(ini);
  const [dfim, setDfim] = useState(fim);

  function aplicar(novoIni: string, novoFim: string) {
    router.push(`/fechamento?ini=${novoIni}&fim=${novoFim}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500">{periodo ? "De" : "Dia"}</span>
        <input
          type="date"
          value={dini}
          max={dfim}
          onChange={(e) => {
            const v = e.target.value;
            setDini(v);
            aplicar(v, periodo ? dfim : v);
          }}
          className={input}
        />
      </label>

      {periodo && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Até</span>
          <input
            type="date"
            value={dfim}
            min={dini}
            onChange={(e) => {
              const v = e.target.value;
              setDfim(v);
              aplicar(dini, v);
            }}
            className={input}
          />
        </label>
      )}

      <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={periodo}
          onChange={(e) => {
            const on = e.target.checked;
            setPeriodo(on);
            if (!on) {
              setDfim(dini);
              aplicar(dini, dini);
            }
          }}
          className="h-4 w-4 accent-[#181d55]"
        />
        Período
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/fechamento/seletor-periodo.tsx"
git commit -m "feat(fechamento): seletor de dia/período

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Página `/fechamento` (preview + ações)

**Files:**
- Create: `src/app/(app)/fechamento/page.tsx`

**Interfaces:**
- Consumes: `PageHeader` (`@/components/ui`); `SeletorPeriodo`, `CompartilharButton` (locais); `clampDia`, `intervaloDias`, `hojeISO` (`@/domain/fechamento`).
- Produces: a rota de página `/fechamento`.

- [ ] **Step 1: Write the implementation**

Create `src/app/(app)/fechamento/page.tsx`:

```tsx
import { PageHeader, Card } from "@/components/ui";
import { clampDia, intervaloDias, hojeISO } from "@/domain/fechamento";
import { SeletorPeriodo } from "./seletor-periodo";
import { CompartilharButton } from "./compartilhar-button";

export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ ini?: string; fim?: string }>;
}) {
  const sp = await searchParams;
  const hoje = hojeISO();
  const iniBruto = clampDia(sp.ini ?? hoje);
  const fimBruto = clampDia(sp.fim ?? iniBruto);
  const { ini, fim } = intervaloDias(iniBruto, fimBruto);

  const src = `/fechamento/arte?ini=${ini}&fim=${fim}`;

  return (
    <div>
      <PageHeader title="Fechamento" subtitle="Gere e compartilhe o resumo do dia ou período" />

      <Card className="mb-5 p-4">
        <SeletorPeriodo ini={ini} fim={fim} />
      </Card>

      <div className="flex flex-col items-center gap-5">
        {/* Preview = a própria arte gerada pela rota (WYSIWYG). key força recarregar ao trocar datas. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={src}
          src={src}
          alt="Prévia da arte de fechamento"
          className="w-full max-w-sm rounded-3xl shadow-lg"
        />
        <CompartilharButton src={src} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify — página renderiza e o preview aparece**

Passos (dev logado):
1. Abrir `http://localhost:3000/fechamento`.
2. `read_page` / screenshot: cabeçalho "Fechamento", seletor de data, imagem do card e botão "Compartilhar".
3. Marcar "Período", escolher segunda data → a imagem recarrega com o novo intervalo.
4. `preview_logs` sem erros.

Expected: preview do card renderiza; alternar dia/período atualiza a imagem.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(app)/fechamento/page.tsx"
git commit -m "feat(fechamento): página com seletor, preview e compartilhar

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Navegação — item "Fechamento" + atalho no Dashboard

**Files:**
- Modify: `src/app/(app)/sidebar-nav.tsx` (array `items`)
- Modify: `src/app/(app)/page.tsx` (children do `PageHeader` do Dashboard)

**Interfaces:**
- Consumes: o array `items` já existente em `sidebar-nav.tsx` (a `MobileNav` filtra `primary`; sem `primary`, "Fechamento" cai na folha "Mais" e na lateral do desktop).

- [ ] **Step 1: Adicionar o item de navegação**

Em `src/app/(app)/sidebar-nav.tsx`, dentro do array `items`, **após** o item `"/tendencias"`, adicionar:

```tsx
  {
    href: "/fechamento",
    label: "Fechamento",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
      </svg>
    ),
  },
```

- [ ] **Step 2: Adicionar o atalho no Dashboard**

Em `src/app/(app)/page.tsx`, o `PageHeader` do dashboard hoje é:

```tsx
      <PageHeader
        title="Visão geral"
        subtitle={`Operação de logística · ${formatMesAno(mesAtual)}${mesFechado ? " · mês fechado" : " · em andamento"}`}
      >
        <MesNav mes={mesAtual} hrefFor={(m) => `/?mes=${m}`} />
      </PageHeader>
```

Substituir o bloco dos children por (mantendo o `MesNav` e adicionando o atalho antes dele):

```tsx
      <PageHeader
        title="Visão geral"
        subtitle={`Operação de logística · ${formatMesAno(mesAtual)}${mesFechado ? " · mês fechado" : " · em andamento"}`}
      >
        <Link
          href="/fechamento"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
            <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
          </svg>
          Compartilhar fechamento
        </Link>
        <MesNav mes={mesAtual} hrefFor={(m) => `/?mes=${m}`} />
      </PageHeader>
```

Garantir o import de `Link` no topo de `src/app/(app)/page.tsx` (adicionar se ausente):

```tsx
import Link from "next/link";
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npx eslint "src/app/(app)/sidebar-nav.tsx" "src/app/(app)/page.tsx"`
Expected: sem erros. No preview (mobile 375px): "Fechamento" aparece na folha "Mais"; no desktop, na lateral; no Dashboard, o botão "Compartilhar fechamento".

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/sidebar-nav.tsx" "src/app/(app)/page.tsx"
git commit -m "feat(fechamento): item de nav + atalho no dashboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Verificação final

- [ ] **Step 1: Suíte completa + lint + build**

```bash
npx vitest run && npx tsc --noEmit && npx eslint src && npm run build
```
Expected: testes verdes (incluindo `fechamento.test.ts`), sem erros de tipo/lint, build conclui e lista a rota `/fechamento` e `/fechamento/arte`.

- [ ] **Step 2: Verificação visual (dev logado)**

1. `/fechamento` — trocar dia e período, ver o preview atualizar.
2. `/fechamento/arte?ini=…&fim=…` — `Content-Type: image/png`, layout conforme o mockup aprovado (marca "DIA Distribuição", herói faturamento com barra âmbar, receitas em verde, devolução do mês em âmbar, peso em kg, faltas).
3. Simular Winthor fora (se aplicável): campos do faturamento em "—" com o aviso; receitas/faltas preenchidos.
4. Mobile (375px): botão "Compartilhar" chama a bandeja nativa (em HTTPS) ou baixa o PNG.

---

## Self-Review (cobertura da spec)

- §3 conteúdo do card → Tasks 4 (layout) + 1/2 (dados) ✓ (faturamento bruto, PDVs/notas na subline, receitas verde, peso kg, devolução mês âmbar, faltas, rodapé).
- §4 taxa de devolução do mês → reuso de `taxaDevolucao` em `montarResumoFechamento` (Task 1) alimentado por `getResumoFaturamento(primeiroDiaDoMes(fim), fim)` (Task 2) ✓.
- §5 geração `next/og` (fonte Sora, flexbox, servidor) → Tasks 3, 4, 5 ✓.
- §6 página + navegação (Mais + atalho dashboard, admin/viewer) → Tasks 7, 8, 9 ✓.
- §7 compartilhamento (Web Share + download) → Task 6 ✓.
- §8 casos de borda (Winthor null → "—"; período; datas presas) → Tasks 1 (clamp/intervalo/null), 4 (render "—"), 5 (clamp na rota) ✓.
- §10 testes → Task 1 (`fechamento.test.ts`) ✓.
- **Nota de escopo:** wordmark é texto Sora (sem PNG), conforme mockup aprovado.

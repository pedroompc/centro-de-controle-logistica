# Devoluções — Layout "Vivo" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repaginar a página de Devoluções com os padrões de layout/interação do "Projeto Principal" (cabeçalho com chip de ícone, painéis roláveis, busca instantânea, colunas ordenáveis, barras inline, lado a lado), mantendo a identidade navy/dourado/Sora deste site.

**Architecture:** `page.tsx` continua server component (fetch + KPIs âncora + filtro SQL motivo/setor). A interatividade (busca, ordenação) vira client components que recebem os arrays já buscados. A lógica pura de busca/ordenação/semáforo fica num módulo `domain/` testado com Vitest; os componentes visuais são verificados no browser preview.

**Tech Stack:** Next.js 16 (App Router, React 19), Tailwind v4, Vitest + jsdom, SVG inline (sem `lucide-react`).

## Global Constraints

- **Sem `lucide-react`**: ícones são SVG inline, viewBox `0 0 24 24`, `fill="none"`, `stroke="currentColor"`, `strokeWidth={1.8}` — igual a `src/app/(app)/sidebar-nav.tsx`.
- **Identidade**: navy `#141a4d` / `#1b2168`, dourado (`amber-400/500`), fonte Sora via `font-[family-name:var(--font-sora)]`, cantos `2xl` no `Card`. Chips de ícone: navy-tint `bg-[#eef0fb] text-[#1b2168]` ou `bg-amber-50 text-amber-600`. Foco de input: `focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50`. **Nunca** usar laranja (`orange-*`) nem emerald/verde no dinheiro (isso é do Projeto Principal).
- **Testes**: só lógica pura em `src/domain/`. Componentes não têm teste unitário neste projeto — verificar no browser preview.
- **Comando de teste**: `npm test` (roda `vitest run`). Um teste só: `npx vitest run <arquivo>`.
- **Dados**: nenhuma query nova de negócio. A única mudança no data layer é o teto de clientes (`ROWNUM <= 10` → `<= 50`).

---

### Task 1: Subir o teto de clientes no SQL (10 → 50)

Sem isso, a busca e a rolagem do painel de clientes têm no máximo 10 linhas.

**Files:**
- Modify: `src/data/devolucoes.ts:93`

**Interfaces:**
- Produces: nada de novo (a assinatura de `getDevolucoesMesAtual` não muda; `topClientes` passa a trazer até 50 linhas).

- [ ] **Step 1: Trocar o limite**

Em `src/data/devolucoes.ts`, dentro de `sqlCliente`, a última linha é:

```
) WHERE ROWNUM <= 10`;
```

Trocar por:

```
) WHERE ROWNUM <= 50`;
```

- [ ] **Step 2: Verificar que não há outra ocorrência de `ROWNUM <= 10`**

Run: `grep -n "ROWNUM <= 10" src/data/devolucoes.ts`
Expected: nenhuma linha (saída vazia).

- [ ] **Step 3: Commit**

```bash
git add src/data/devolucoes.ts
git commit -m "feat: top 50 clientes na devolução (para busca/rolagem do painel)"
```

---

### Task 2: Lógica pura de busca, ordenação e semáforo (TDD)

Módulo puro que os client components vão consumir. É o único código com teste unitário neste plano.

**Files:**
- Create: `src/domain/devolucoes-ui.ts`
- Test: `src/domain/devolucoes-ui.test.ts`

**Interfaces:**
- Consumes: `DevolucaoPorMotorista` de `src/domain/devolucoes.ts` (campos: `codMotorista`, `nome`, `expedidas`, `devolvidas`, `taxa`, `valorDevolvido`).
- Produces:
  - `filtrarPorBusca<T>(lista: T[], busca: string, campos: (item: T) => (string | number)[]): T[]`
  - `type ColunaMotorista = "expedidas" | "devolvidas" | "taxa" | "valorDevolvido"`
  - `type Direcao = "asc" | "desc"`
  - `ordenarMotoristas(lista: DevolucaoPorMotorista[], col: ColunaMotorista, dir: Direcao): DevolucaoPorMotorista[]`
  - `corTaxa(taxa: number): string`

- [ ] **Step 1: Escrever os testes que falham**

Criar `src/domain/devolucoes-ui.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { filtrarPorBusca, ordenarMotoristas, corTaxa } from "./devolucoes-ui";
import type { DevolucaoPorMotorista } from "./devolucoes";

const m = (over: Partial<DevolucaoPorMotorista>): DevolucaoPorMotorista => ({
  codMotorista: 1, nome: "Fulano", expedidas: 100, devolvidas: 5, taxa: 5, valorDevolvido: 1000, ...over,
});

describe("filtrarPorBusca", () => {
  const lista = [
    { nome: "João Silva", cod: 12 },
    { nome: "Maria Souza", cod: 34 },
  ];
  const campos = (x: { nome: string; cod: number }) => [x.nome, x.cod];

  it("retorna tudo quando a busca é vazia", () => {
    expect(filtrarPorBusca(lista, "", campos)).toHaveLength(2);
    expect(filtrarPorBusca(lista, "   ", campos)).toHaveLength(2);
  });

  it("filtra por nome, sem diferenciar maiúsculas", () => {
    const r = filtrarPorBusca(lista, "joão", campos);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("João Silva");
  });

  it("filtra por código numérico", () => {
    const r = filtrarPorBusca(lista, "34", campos);
    expect(r).toHaveLength(1);
    expect(r[0].nome).toBe("Maria Souza");
  });
});

describe("ordenarMotoristas", () => {
  const lista = [
    m({ codMotorista: 1, taxa: 5, valorDevolvido: 300 }),
    m({ codMotorista: 2, taxa: 20, valorDevolvido: 100 }),
    m({ codMotorista: 3, taxa: 12, valorDevolvido: 200 }),
  ];

  it("ordena por taxa desc", () => {
    const r = ordenarMotoristas(lista, "taxa", "desc");
    expect(r.map((x) => x.codMotorista)).toEqual([2, 3, 1]);
  });

  it("ordena por valorDevolvido asc", () => {
    const r = ordenarMotoristas(lista, "valorDevolvido", "asc");
    expect(r.map((x) => x.codMotorista)).toEqual([2, 3, 1]);
  });

  it("não muta a lista original", () => {
    const antes = lista.map((x) => x.codMotorista);
    ordenarMotoristas(lista, "taxa", "asc");
    expect(lista.map((x) => x.codMotorista)).toEqual(antes);
  });
});

describe("corTaxa (semáforo)", () => {
  it("verde abaixo de 8%", () => expect(corTaxa(5)).toBe("text-emerald-600"));
  it("âmbar de 8% a 15%", () => expect(corTaxa(10)).toBe("text-amber-600"));
  it("vermelho em 15% ou mais", () => expect(corTaxa(15)).toBe("text-rose-600"));
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/domain/devolucoes-ui.test.ts`
Expected: FAIL — "Failed to resolve import ./devolucoes-ui" (o módulo ainda não existe).

- [ ] **Step 3: Implementar o módulo**

Criar `src/domain/devolucoes-ui.ts`:

```ts
import type { DevolucaoPorMotorista } from "./devolucoes";

/** Filtro em memória por texto: casa a busca contra qualquer um dos `campos`. */
export function filtrarPorBusca<T>(
  lista: T[],
  busca: string,
  campos: (item: T) => (string | number)[],
): T[] {
  const q = busca.toLowerCase().trim();
  if (!q) return lista;
  return lista.filter((item) =>
    campos(item).some((c) => String(c).toLowerCase().includes(q)),
  );
}

export type ColunaMotorista = "expedidas" | "devolvidas" | "taxa" | "valorDevolvido";
export type Direcao = "asc" | "desc";

/** Ordena por coluna numérica sem mutar a lista original. */
export function ordenarMotoristas(
  lista: DevolucaoPorMotorista[],
  col: ColunaMotorista,
  dir: Direcao,
): DevolucaoPorMotorista[] {
  return [...lista].sort((a, b) => (dir === "asc" ? a[col] - b[col] : b[col] - a[col]));
}

/** Semáforo da taxa de devolução: verde < 8%, âmbar 8–15%, vermelho >= 15%. */
export function corTaxa(taxa: number): string {
  if (taxa >= 15) return "text-rose-600";
  if (taxa >= 8) return "text-amber-600";
  return "text-emerald-600";
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/domain/devolucoes-ui.test.ts`
Expected: PASS (todos os testes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/devolucoes-ui.ts src/domain/devolucoes-ui.test.ts
git commit -m "feat: lógica pura de busca/ordenação/semáforo da devolução"
```

---

### Task 3: Ícones SVG inline + PanelHeader compartilhado

Scaffolding visual reutilizado pelos painéis. Sem teste unitário (verificação visual acontece na Task 6).

**Files:**
- Create: `src/app/(app)/devolucoes/icons.tsx`
- Modify: `src/components/ui.tsx` (adicionar `PanelHeader` no fim do arquivo)

**Interfaces:**
- Produces (icons.tsx): componentes `IconeCaminhao`, `IconePredio`, `IconeEtiqueta`, `IconeBusca`, `IconeChevronCima`, `IconeChevronBaixo`, `IconeUsuario` — cada um `(props: { className?: string }) => JSX.Element`.
- Produces (ui.tsx): `PanelHeader({ icon, tone?, title, context?, right? })` onde `icon: ReactNode`, `tone?: "navy" | "gold"` (default `"navy"`), `title: string`, `context?: string`, `right?: ReactNode`.

- [ ] **Step 1: Criar os ícones**

Criar `src/app/(app)/devolucoes/icons.tsx`:

```tsx
type Props = { className?: string };
const base = "h-4 w-4";

function Svg({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" className={className ?? base}>
      {children}
    </svg>
  );
}

export const IconeCaminhao = (p: Props) => (
  <Svg className={p.className}>
    <path d="M3 6h11v9H3zM14 9h4l3 3v3h-7z" />
    <circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
  </Svg>
);
export const IconePredio = (p: Props) => (
  <Svg className={p.className}>
    <path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17M15 21V9h3a1 1 0 0 1 1 1v11M3 21h18" />
    <path d="M8 7h2M8 11h2M8 15h2" />
  </Svg>
);
export const IconeEtiqueta = (p: Props) => (
  <Svg className={p.className}>
    <path d="M4 6h10l6 6-6 6H4z" /><circle cx="8" cy="12" r="1.3" />
  </Svg>
);
export const IconeBusca = (p: Props) => (
  <Svg className={p.className}>
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
  </Svg>
);
export const IconeChevronCima = (p: Props) => (
  <Svg className={p.className}><path d="m6 15 6-6 6 6" /></Svg>
);
export const IconeChevronBaixo = (p: Props) => (
  <Svg className={p.className}><path d="m6 9 6 6 6-6" /></Svg>
);
export const IconeUsuario = (p: Props) => (
  <Svg className={p.className}>
    <circle cx="12" cy="8" r="3.2" /><path d="M5 20a7 7 0 0 1 14 0" />
  </Svg>
);
```

- [ ] **Step 2: Adicionar `PanelHeader` ao `ui.tsx`**

No fim de `src/components/ui.tsx` (o `import type { ReactNode }` já existe no topo):

```tsx
/** Cabeçalho de painel — chip de ícone + título + contexto + slot à direita (busca). */
export function PanelHeader({
  icon,
  tone = "navy",
  title,
  context,
  right,
}: {
  icon: ReactNode;
  tone?: "navy" | "gold";
  title: string;
  context?: string;
  right?: ReactNode;
}) {
  const chip = tone === "gold" ? "bg-amber-50 text-amber-600" : "bg-[#eef0fb] text-[#1b2168]";
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${chip}`}>{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-[#141a4d]">{title}</h2>
          {context && <p className="mt-0.5 text-xs text-slate-400">{context}</p>}
        </div>
      </div>
      {right && <div className="sm:ml-auto">{right}</div>}
    </div>
  );
}
```

- [ ] **Step 3: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros nos arquivos novos (`icons.tsx`, `ui.tsx`).

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/devolucoes/icons.tsx src/components/ui.tsx
git commit -m "feat: ícones SVG inline e PanelHeader compartilhado da devolução"
```

---

### Task 4: Painel de Clientes (client component)

Busca instantânea + ranking + mini-barra inline.

**Files:**
- Create: `src/app/(app)/devolucoes/painel-clientes.tsx`

**Interfaces:**
- Consumes: `DevolucaoPorCliente` (`codcli`, `nome`, `notas`, `valor`); `filtrarPorBusca`; `PanelHeader`, `Card`; `formatBRL`; `IconePredio`, `IconeBusca`.
- Produces: `default function PainelClientes({ clientes }: { clientes: DevolucaoPorCliente[] })`.

- [ ] **Step 1: Criar o componente**

Criar `src/app/(app)/devolucoes/painel-clientes.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { filtrarPorBusca } from "@/domain/devolucoes-ui";
import { formatBRL } from "@/domain/format";
import type { DevolucaoPorCliente } from "@/domain/devolucoes";
import { IconePredio, IconeBusca } from "./icons";

export default function PainelClientes({ clientes }: { clientes: DevolucaoPorCliente[] }) {
  const [busca, setBusca] = useState("");
  const lista = useMemo(
    () => filtrarPorBusca(clientes, busca, (c) => [c.nome, c.codcli]),
    [clientes, busca],
  );
  const maxNotas = Math.max(1, ...clientes.map((c) => c.notas));

  const campoBusca = (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <IconeBusca />
      </span>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar cliente…"
        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50 sm:w-48"
      />
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconePredio />}
        title="Clientes que mais devolvem"
        context={`${lista.length} clientes · por nº de notas`}
        right={campoBusca}
      />
      <div className="max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-center font-semibold">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Cliente</th>
              <th className="min-w-[160px] px-3 py-2.5 text-right font-semibold">Notas</th>
              <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-slate-400">
                  {busca ? `Nenhum cliente para "${busca}".` : "Sem devoluções no período."}
                </td>
              </tr>
            ) : (
              lista.map((c, i) => (
                <tr key={c.codcli} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="max-w-[280px] truncate text-[#141a4d]">{c.nome}</div>
                    <div className="text-[10px] text-slate-400">Cód. {c.codcli}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(c.notas / maxNotas) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right font-semibold tabular-nums text-[#141a4d]">{c.notas}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#141a4d]">{formatBRL(c.valor)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros em `painel-clientes.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/devolucoes/painel-clientes.tsx
git commit -m "feat: painel de clientes com busca instantânea e barra inline"
```

---

### Task 5: Tabela de Motoristas (client component)

Busca instantânea + colunas ordenáveis + semáforo. Substitui o `<form>` de busca por reload.

**Files:**
- Create: `src/app/(app)/devolucoes/tabela-motoristas.tsx`

**Interfaces:**
- Consumes: `DevolucaoPorMotorista`; `filtrarPorBusca`, `ordenarMotoristas`, `corTaxa`, `ColunaMotorista`, `Direcao`; `Card`, `PanelHeader`; `formatBRL`, `formatPercent`; `IconeCaminhao`, `IconeUsuario`, `IconeBusca`, `IconeChevronCima`, `IconeChevronBaixo`.
- Produces: `default function TabelaMotoristas({ motoristas }: { motoristas: DevolucaoPorMotorista[] })`.

- [ ] **Step 1: Criar o componente**

Criar `src/app/(app)/devolucoes/tabela-motoristas.tsx`:

```tsx
"use client";

import { useState, useMemo } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { filtrarPorBusca, ordenarMotoristas, corTaxa } from "@/domain/devolucoes-ui";
import type { ColunaMotorista, Direcao } from "@/domain/devolucoes-ui";
import { formatBRL, formatPercent } from "@/domain/format";
import { piorMotorista } from "@/domain/devolucoes";
import type { DevolucaoPorMotorista } from "@/domain/devolucoes";
import { IconeCaminhao, IconeUsuario, IconeBusca, IconeChevronCima, IconeChevronBaixo } from "./icons";

type Sort = { col: ColunaMotorista; dir: Direcao };

function Th({
  col, rotulo, sort, onSort,
}: {
  col: ColunaMotorista; rotulo: string; sort: Sort; onSort: (c: ColunaMotorista) => void;
}) {
  const ativo = sort.col === col;
  return (
    <th
      onClick={() => onSort(col)}
      className="cursor-pointer select-none px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100 hover:text-slate-700"
    >
      <span className="inline-flex items-center gap-1">
        {rotulo}
        {ativo ? (
          sort.dir === "asc" ? (
            <IconeChevronCima className="h-3 w-3 text-amber-500" />
          ) : (
            <IconeChevronBaixo className="h-3 w-3 text-amber-500" />
          )
        ) : (
          <IconeChevronBaixo className="h-3 w-3 opacity-20" />
        )}
      </span>
    </th>
  );
}

export default function TabelaMotoristas({ motoristas }: { motoristas: DevolucaoPorMotorista[] }) {
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState<Sort>({ col: "taxa", dir: "desc" });

  function onSort(col: ColunaMotorista) {
    setSort((p) => (p.col === col ? { col, dir: p.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" }));
  }

  const filtrados = useMemo(
    () => filtrarPorBusca(motoristas, busca, (m) => [m.nome, m.codMotorista]),
    [motoristas, busca],
  );
  const lista = useMemo(() => ordenarMotoristas(filtrados, sort.col, sort.dir), [filtrados, sort]);
  const pior = useMemo(() => piorMotorista(filtrados), [filtrados]);

  const campoBusca = (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <IconeBusca />
      </span>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar motorista…"
        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50 sm:w-56"
      />
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconeCaminhao />}
        title="Taxa de devolução por motorista"
        context={`${lista.length} motoristas · ordene pelas colunas`}
        right={campoBusca}
      />
      {pior && (
        <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
          Maior taxa (com 50+ entregas):{" "}
          <span className="font-semibold text-rose-600">{pior.nome}</span> —{" "}
          {formatPercent(pior.taxa / 100)} ({pior.devolvidas} de {pior.expedidas}).
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="w-10 px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">#</th>
              <th className="min-w-[180px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Motorista</th>
              <Th col="expedidas" rotulo="Entregas" sort={sort} onSort={onSort} />
              <Th col="devolvidas" rotulo="Devolvidas" sort={sort} onSort={onSort} />
              <Th col="taxa" rotulo="Taxa" sort={sort} onSort={onSort} />
              <Th col="valorDevolvido" rotulo="Valor devolvido" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                  {busca ? `Nenhum motorista para "${busca}".` : "Sem entregas em carga no período."}
                </td>
              </tr>
            ) : (
              lista.map((m, i) => (
                <tr key={m.codMotorista} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-3 py-3 text-center font-mono text-xs text-slate-400">{i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="shrink-0 rounded-lg bg-[#eef0fb] p-1.5 text-[#1b2168]">
                        <IconeUsuario />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-none text-[#141a4d]">{m.nome}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Cód. {m.codMotorista}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500">{m.expedidas}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-600">{m.devolvidas}</td>
                  <td className={`px-3 py-3 text-right text-base font-bold tabular-nums ${corTaxa(m.taxa)}`}>
                    {formatPercent(m.taxa / 100)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#141a4d]">{formatBRL(m.valorDevolvido)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Checar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros em `tabela-motoristas.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/devolucoes/tabela-motoristas.tsx
git commit -m "feat: tabela de motoristas com busca instantânea, ordenação e semáforo"
```

---

### Task 6: Reescrever a página (setor + layout lado a lado + fiação)

Junta tudo: bloco de setor com barra empilhada, painel de motivo + clientes lado a lado, tabela de motoristas full width. Remove os params de URL `expandir` e `motorista`.

**Files:**
- Modify: `src/app/(app)/devolucoes/page.tsx` (reescrita da árvore de render; mantém o fetch e os KPIs)

**Interfaces:**
- Consumes: `PainelClientes` (Task 4), `TabelaMotoristas` (Task 5), `PanelHeader` (Task 3), `IconeEtiqueta` (Task 3), tudo já criado.
- Produces: nada para outras tasks (é a folha).

- [ ] **Step 1: Reescrever `page.tsx`**

Substituir todo o conteúdo de `src/app/(app)/devolucoes/page.tsx` por:

```tsx
import Link from "next/link";
import { getDevolucoesMesAtual, listarMotivosDoMes } from "@/data/devolucoes";
import { getResumoFaturamentoMesAtual } from "@/data/faturamento";
import { taxaDevolucao, taxaDevolucaoNotas } from "@/domain/faturamento";
import { formatBRL, formatPercent } from "@/domain/format";
import { primeiroDiaDoMes, formatMesAno } from "@/domain/periodo";
import type { SetorDevolucao, DevolucaoPorMotivo } from "@/domain/devolucoes";
import { PageHeader, Card, StatCard, PanelHeader } from "@/components/ui";
import PainelClientes from "./painel-clientes";
import TabelaMotoristas from "./tabela-motoristas";
import { IconeEtiqueta } from "./icons";

const SETORES: SetorDevolucao[] = ["Logística", "Comercial", "Faturamento", "Não classificado"];

const inputCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

// Cor da barra/etiqueta por setor responsável.
const CORES: Record<SetorDevolucao, { barra: string; pill: string }> = {
  "Logística": { barra: "bg-[#1b2168]", pill: "bg-[#eef0fb] text-[#1b2168]" },
  "Comercial": { barra: "bg-amber-400", pill: "bg-amber-50 text-amber-700" },
  "Faturamento": { barra: "bg-rose-400", pill: "bg-rose-50 text-rose-700" },
  "Não classificado": { barra: "bg-slate-300", pill: "bg-slate-100 text-slate-500" },
};

function LinhaMotivo({ m, max }: { m: DevolucaoPorMotivo; max: number }) {
  const pct = Math.max(2, Math.round((m.valor / max) * 100));
  const cor = CORES[m.setor];
  return (
    <div className="px-5 py-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-[#141a4d]" title={m.motivo}>{m.motivo}</span>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${cor.pill}`}>{m.setor}</span>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-[#141a4d]">{formatBRL(m.valor)}</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${cor.barra}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="w-16 shrink-0 text-right text-xs text-slate-400">{m.notas} notas</span>
      </div>
    </div>
  );
}

export default async function DevolucoesPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string; setor?: string }>;
}) {
  const sp = await searchParams;
  const motivo = sp.motivo || undefined;
  const setor = sp.setor || undefined;
  const temFiltro = Boolean(motivo || setor);

  const [r, fat, motivosDisponiveis] = await Promise.all([
    getDevolucoesMesAtual(motivo, setor),
    getResumoFaturamentoMesAtual(),
    listarMotivosDoMes(),
  ]);
  const mes = formatMesAno(primeiroDiaDoMes());

  if (!r) {
    return (
      <div>
        <PageHeader title="Devoluções" subtitle={`${mes} · Winthor`} />
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Devoluções indisponíveis — sem conexão com o Winthor (o banco só responde de dentro
            da rede da empresa).
          </p>
        </Card>
      </div>
    );
  }

  // Monta URL preservando o filtro vigente; `over` sobrescreve/limpa chaves.
  const url = (over: Record<string, string | undefined>) => {
    const atual: Record<string, string | undefined> = { motivo, setor, ...over };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(atual)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/devolucoes?${qs}` : "/devolucoes";
  };

  const maxMotivo = Math.max(1, ...r.porMotivo.map((m) => m.valor));
  const totalSetor = Math.max(1, r.porSetor.reduce((t, s) => t + s.valor, 0));

  return (
    <div>
      <PageHeader title="Devoluções" subtitle={`${mes} · filiais 1 e 11`} />

      {/* Números OFICIAIS do mês = rotina 111. NÃO reagem ao filtro (âncora). */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Valor devolução" value={formatBRL(r.total)} hint="= soma por setor · ~igual ao 111" accent="red" />
        <StatCard
          label="Devolução avulsa"
          value={fat ? formatBRL(fat.valorDevolucaoAvulsa) : "—"}
          hint={fat ? `${fat.devolvidasAvulsas} NFs · sem venda de origem` : "—"}
          accent="navy"
        />
        <StatCard
          label="Taxa de devolução (valor)"
          value={fat ? formatPercent(taxaDevolucao(fat)) : "—"}
          hint="R$ devolvido / venda faturada"
          accent="gold"
        />
        <StatCard
          label="Taxa de devolução (notas)"
          value={fat ? formatPercent(taxaDevolucaoNotas(fat)) : "—"}
          hint={fat ? `${fat.devolvidas} de ${fat.emitidas} NFs emitidas` : "—"}
          accent="gold"
        />
      </div>

      <div className="mt-8 mb-4 flex items-baseline gap-3">
        <h2 className="font-[family-name:var(--font-sora)] text-lg font-extrabold tracking-tight text-[#141a4d]">
          Análise · de onde vêm
        </h2>
        {temFiltro && (
          <Link href="/devolucoes" className="text-xs font-medium text-amber-600 hover:text-amber-700">limpar filtros</Link>
        )}
      </div>

      {/* Filtro: motivo/setor vão no SQL e estreitam as três seções. */}
      <Card className="mb-4 p-3">
        <form method="get" className="flex flex-wrap gap-2">
          <select name="motivo" defaultValue={motivo ?? ""} className={`${inputCls} min-w-[12rem] flex-1`}>
            <option value="">Todos os motivos</option>
            {motivosDisponiveis.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <select name="setor" defaultValue={setor ?? ""} className={inputCls}>
            <option value="">Todos os setores</option>
            {SETORES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
            Filtrar
          </button>
        </form>
      </Card>

      {/* Responsabilidade por setor: barra empilhada + cards clicáveis (filtram). */}
      <Card className="mb-6 p-5">
        <h3 className="mb-3 text-sm font-semibold text-[#141a4d]">Responsabilidade por setor (no período)</h3>
        <div className="mb-4 flex h-3 overflow-hidden rounded-full">
          {r.porSetor.map((s) => (
            <div
              key={s.setor}
              className={CORES[s.setor].barra}
              style={{ width: `${(s.valor / totalSetor) * 100}%` }}
              title={`${s.setor}: ${((s.valor / totalSetor) * 100).toFixed(1)}%`}
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {r.porSetor.map((s) => {
            const pct = (s.valor / totalSetor) * 100;
            const ativo = setor === s.setor;
            return (
              <Link
                key={s.setor}
                href={url({ setor: ativo ? undefined : s.setor })}
                className={`rounded-lg border p-3 transition hover:shadow-sm ${ativo ? "border-amber-400 ring-1 ring-amber-300" : "border-slate-200"}`}
              >
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${CORES[s.setor].pill}`}>
                  {s.setor}
                </span>
                <div className="mt-2 flex items-baseline gap-1.5">
                  <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold leading-none tabular-nums text-[#141a4d]">
                    {pct.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">do valor</span>
                </div>
                <div className="mt-0.5 text-xs text-slate-500">{s.notas} notas · {formatBRL(s.valor)}</div>
              </Link>
            );
          })}
        </div>
      </Card>

      {/* Motivo + Clientes lado a lado no desktop. */}
      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <PanelHeader
            icon={<IconeEtiqueta />}
            tone="gold"
            title="Por motivo"
            context={`${r.porMotivo.length} motivos · por valor`}
          />
          <div className="max-h-[28rem] divide-y divide-slate-100 overflow-y-auto">
            {r.porMotivo.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-slate-400">Sem devoluções no período.</p>
            ) : (
              r.porMotivo.map((m) => <LinhaMotivo key={`${m.motivo}-${m.setor}`} m={m} max={maxMotivo} />)
            )}
          </div>
        </Card>

        <PainelClientes clientes={r.topClientes} />
      </div>

      <div className="mt-6">
        <TabelaMotoristas motoristas={r.porMotorista} />
      </div>

      <p className="mt-4 text-xs text-slate-400">
        Os indicadores no topo são sempre o total do mês (não reagem ao filtro). Motivo e setor
        estreitam as três seções abaixo; a busca dentro de cada painel filtra só aquele painel.
        Valor líquido da devolução (rotina 111), pela data da devolução.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Checar tipos e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros. (Se o lint reclamar de import não usado — ex.: `SectionTitle`, `piorMotorista`, `taxaDevolucao` que saíram da página — remover o import correspondente; a versão acima já não os importa.)

- [ ] **Step 3: Rodar toda a suíte de testes**

Run: `npm test`
Expected: PASS (incluindo `devolucoes-ui.test.ts` e `devolucoes.test.ts` existentes).

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/devolucoes/page.tsx
git commit -m "feat: layout vivo de Devoluções — setor empilhado, motivo/clientes lado a lado, motorista interativo"
```

---

### Task 7: Verificação no browser

Confirma o visual e a interação de ponta a ponta. Sem conexão Winthor, os dados podem vir vazios (`r` = null → card de indisponível); nesse caso, verificar ao menos que a página compila e renderiza sem erro no console.

**Files:** nenhum (verificação).

- [ ] **Step 1: Subir o dev server**

Usar o preview do harness (`preview_start` com `name` do `.claude/launch.json`, ou criar um config `next dev` na porta 3000). Navegar até `/devolucoes`.

- [ ] **Step 2: Checar o console e a rede**

Ler `read_console_messages` (só erros) e `preview_logs`. Expected: sem erros de render/hidratação.

- [ ] **Step 3: Verificar a interação (se houver dados)**

- Digitar no campo de busca de clientes → a lista filtra sem recarregar a página.
- Digitar no campo de busca de motoristas → filtra; a URL não muda.
- Clicar nos cabeçalhos Entregas/Devolvidas/Taxa/Valor → reordena, o chevron dourado indica a coluna ativa.
- Clicar num card de setor → filtra (a URL ganha `?setor=…`), o card fica com anel dourado; clicar de novo remove.
- Conferir responsivo (`resize_window` mobile): motivo/clientes empilham, buscas descem para baixo do título do painel.
- Screenshot para o Pedro.

- [ ] **Step 4: Marcar a memória como validada**

Se tudo ok, nenhum commit adicional (verificação é read-only). Relatar o resultado ao Pedro com o screenshot.

---

## Self-Review

**Spec coverage:**
- Teto 10→50 → Task 1. ✓
- Padrão de painel (chip + rolável + sticky) → Task 3 (`PanelHeader`) + usado em Tasks 4/5/6. ✓
- Bloco setor (barra empilhada + cards % clicáveis) → Task 6. ✓
- Por motivo (barras existentes + painel rolável, sem "ver todos") → Task 6. ✓
- Clientes (busca instantânea, ranking, barra inline) → Task 4. ✓
- Motorista (busca instantânea, colunas ordenáveis, semáforo, pior motorista) → Task 5. ✓
- Layout lado a lado (`xl:grid-cols-2`) → Task 6. ✓
- Remover params `expandir` e `motorista` da URL → Task 6 (novo tipo de `searchParams`, `url()` só com motivo/setor). ✓
- Identidade navy/dourado/Sora, sem lucide, foco dourado → Global Constraints + código de cada task. ✓
- KPIs âncora inalterados → Task 6 (copiados verbatim). ✓

**Placeholder scan:** nenhum TBD/TODO; todo passo de código traz o código completo. ✓

**Type consistency:** `filtrarPorBusca`, `ordenarMotoristas`, `corTaxa`, `ColunaMotorista`, `Direcao` definidos na Task 2 e consumidos com a mesma assinatura nas Tasks 4/5. `PanelHeader`/ícones definidos na Task 3, consumidos nas Tasks 4/5/6. `DevolucaoPorCliente`/`DevolucaoPorMotorista` batem com `src/domain/devolucoes.ts`. ✓

# Mapa de calor de devolução por cidade (PE) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma seção em `/devolucoes` com um mapa de calor (choropleth SVG) dos municípios de Pernambuco, colorido pela taxa de devolução (R$ devolvido ÷ R$ faturado) de cada cidade, destacando a de maior índice.

**Architecture:** Quatro unidades independentes: (1) domínio puro `devolucoes-mapa.ts` com taxa/piso/pior-cidade/cor, testado; (2) asset estático `pe-municipios.json` com paths SVG pré-projetados, gerado por script único; (3) query Oracle `getDevolucaoPorCidade` reconstruindo faturado e devolvido por cidade; (4) seção server + client component SVG na página de devoluções. O domínio e a geometria são verificáveis localmente sem Oracle; a query é validada on-site como as demais.

**Tech Stack:** Next.js (App Router, server components), TypeScript, Vitest, Tailwind, SVG inline (sem lib de gráfico), Oracle (`queryWinthor`).

## Global Constraints

- **Sem dependência nova em runtime** — mapa é SVG inline na mão, geometria é JSON estático. Nenhum Leaflet/D3/topojson em produção. (Regra do projeto: ver `AGENTS.md`.)
- **Escala de cor âmbar → vermelho; verde JAMAIS** — verde é reservado a receita (regra de identidade visual). Cidade sem volume/sem dado = cinza neutro.
- **Fórmula da taxa idêntica ao dashboard:** `taxa = devolvido / faturado`, `0` se `faturado <= 0`.
- **Escopo:** apenas UF = 'PE', filiais 1 e 11 (via `filialIn`).
- **Tipos moram no domínio;** a camada de dados importa de `@/domain/*` (convenção do projeto).
- **Testes:** Vitest. Rodar com `npx vitest run <arquivo>`. Estilo `import { describe, it, expect } from "vitest"`.
- **Devolução:** valor líquido (rotina 111), pela CTE `edf` já existente em `src/data/devolucoes.ts` (`NUMTRANSVENDA > 0`).
- **Commits frequentes**, um por task. Rodapé do commit:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## Arquivos

- Create: `src/domain/devolucoes-mapa.ts` — tipos + taxa/piso/pior-cidade/cor (puro).
- Create: `src/domain/devolucoes-mapa.test.ts` — testes do domínio.
- Create: `scripts/gen-geo-pe.mjs` — gerador único do asset de geometria (não roda em runtime).
- Create: `src/data/geo/pe-municipios.json` — `[{ ibge, nome, d }]` projetado (saída do script).
- Create: `src/data/geo/pe-municipios.test.ts` — sanidade do asset.
- Modify: `src/data/devolucoes.ts` — adicionar `getDevolucaoPorCidade`.
- Create: `src/app/(app)/devolucoes/mapa-devolucoes.tsx` — client component (SVG + tooltip + ranking).
- Modify: `src/app/(app)/devolucoes/page.tsx` — buscar dados, juntar com geometria, renderizar a seção.

---

## Task 1: Domínio — `devolucoes-mapa.ts`

**Files:**
- Create: `src/domain/devolucoes-mapa.ts`
- Test: `src/domain/devolucoes-mapa.test.ts`

**Interfaces:**
- Consumes: nada (unidade base, pura).
- Produces:
  - `interface LinhaCidadeDevolucao { ibge: string; cidade: string; faturado: number; devolvido: number; notasDevolvidas: number }`
  - `interface CidadeDevolucao extends LinhaCidadeDevolucao { taxa: number; relevante: boolean }`
  - `const MIN_FATURADO_CIDADE = 5000`
  - `const COR_NEUTRA = "#e2e8f0"`
  - `function comTaxa(linhas: LinhaCidadeDevolucao[], minFaturado?: number): CidadeDevolucao[]`
  - `function piorCidade(cidades: CidadeDevolucao[]): CidadeDevolucao | null`
  - `function corDaTaxa(taxa: number, relevante: boolean, tetoRelevante: number): string`

- [ ] **Step 1: Escrever os testes que falham**

Create `src/domain/devolucoes-mapa.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  comTaxa,
  piorCidade,
  corDaTaxa,
  COR_NEUTRA,
  MIN_FATURADO_CIDADE,
} from "./devolucoes-mapa";
import type { LinhaCidadeDevolucao, CidadeDevolucao } from "./devolucoes-mapa";

const linha = (over: Partial<LinhaCidadeDevolucao>): LinhaCidadeDevolucao => ({
  ibge: "2611606",
  cidade: "Recife",
  faturado: 10000,
  devolvido: 500,
  notasDevolvidas: 3,
  ...over,
});

const cidade = (over: Partial<CidadeDevolucao>): CidadeDevolucao => ({
  ...linha({}),
  taxa: 0.05,
  relevante: true,
  ...over,
});

describe("comTaxa", () => {
  it("calcula taxa = devolvido / faturado", () => {
    const [c] = comTaxa([linha({ faturado: 10000, devolvido: 500 })]);
    expect(c.taxa).toBeCloseTo(0.05, 6);
  });

  it("taxa 0 quando faturado <= 0 (e marca como não relevante)", () => {
    const [c] = comTaxa([linha({ faturado: 0, devolvido: 500 })]);
    expect(c.taxa).toBe(0);
    expect(c.relevante).toBe(false);
  });

  it("marca relevante quando faturado >= o piso", () => {
    const r = comTaxa(
      [
        linha({ ibge: "A", faturado: MIN_FATURADO_CIDADE, devolvido: 100 }),
        linha({ ibge: "B", faturado: MIN_FATURADO_CIDADE - 1, devolvido: 100 }),
      ],
      MIN_FATURADO_CIDADE,
    );
    expect(r.find((c) => c.ibge === "A")!.relevante).toBe(true);
    expect(r.find((c) => c.ibge === "B")!.relevante).toBe(false);
  });
});

describe("piorCidade", () => {
  it("retorna a maior taxa entre as relevantes", () => {
    const r = piorCidade([
      cidade({ ibge: "A", taxa: 0.05, relevante: true }),
      cidade({ ibge: "B", taxa: 0.20, relevante: true }),
      cidade({ ibge: "C", taxa: 0.90, relevante: false }), // ignorada (não relevante)
    ]);
    expect(r?.ibge).toBe("B");
  });

  it("retorna null quando nenhuma é relevante", () => {
    const r = piorCidade([cidade({ taxa: 0.9, relevante: false })]);
    expect(r).toBeNull();
  });
});

describe("corDaTaxa", () => {
  it("não relevante → cor neutra", () => {
    expect(corDaTaxa(0.5, false, 0.1)).toBe(COR_NEUTRA);
  });

  it("teto 0 → cor neutra (evita divisão por zero)", () => {
    expect(corDaTaxa(0.05, true, 0)).toBe(COR_NEUTRA);
  });

  it("pior cidade (taxa == teto) recebe o tom mais intenso", () => {
    expect(corDaTaxa(0.1, true, 0.1)).toBe("#dc2626");
  });

  it("taxa maior (relevante) nunca clareia em relação a uma menor", () => {
    const menor = corDaTaxa(0.02, true, 0.1);
    const maior = corDaTaxa(0.08, true, 0.1);
    expect(menor).not.toBe(COR_NEUTRA);
    expect(maior).not.toBe(COR_NEUTRA);
    expect(menor).not.toBe(maior);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `npx vitest run src/domain/devolucoes-mapa.test.ts`
Expected: FAIL — "Failed to resolve import ./devolucoes-mapa" (arquivo ainda não existe).

- [ ] **Step 3: Implementar o domínio**

Create `src/domain/devolucoes-mapa.ts`:

```ts
/**
 * Devolução por cidade (PE) — quebra da taxa de devolução do dashboard
 * (`taxa = devolvido / faturado`, ver [[devolucao-regra]]) por município, para o
 * mapa de calor. Puro e testável sem Oracle. Os tipos vivem aqui; a camada de
 * dados (`src/data/devolucoes.ts`) os importa.
 */
export interface LinhaCidadeDevolucao {
  ibge: string; // código IBGE (7 dígitos) — chave de junção com a geometria
  cidade: string;
  faturado: number; // R$ faturado atribuído à cidade no período
  devolvido: number; // R$ devolvido (líquido, rotina 111)
  notasDevolvidas: number;
}

export interface CidadeDevolucao extends LinhaCidadeDevolucao {
  taxa: number; // devolvido / faturado (0..1); 0 se faturado <= 0
  relevante: boolean; // faturado >= minFaturado — abaixo disso, 1 venda vira 100%
}

/** Piso de faturamento para uma cidade colorir o mapa (senão a escala é sequestrada). */
export const MIN_FATURADO_CIDADE = 5000;

/** Cinza para cidade sem volume relevante ou sem dado. slate-200. */
export const COR_NEUTRA = "#e2e8f0";

// Rampa âmbar → vermelho (amber-200 … red-600). Verde jamais (regra de identidade).
const RAMPA = [
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#fb923c",
  "#f97316",
  "#ea580c",
  "#dc2626",
];

/** Enriquece cada linha com taxa e o flag de volume relevante. */
export function comTaxa(
  linhas: LinhaCidadeDevolucao[],
  minFaturado: number = MIN_FATURADO_CIDADE,
): CidadeDevolucao[] {
  return linhas.map((l) => ({
    ...l,
    taxa: l.faturado > 0 ? l.devolvido / l.faturado : 0,
    relevante: l.faturado >= minFaturado,
  }));
}

/**
 * Cidade com a maior taxa ENTRE as de volume relevante — a resposta da pergunta
 * "qual cidade tem o maior índice". Em empate, mantém a primeira encontrada.
 * `null` se nenhuma atinge o piso.
 */
export function piorCidade(cidades: CidadeDevolucao[]): CidadeDevolucao | null {
  return cidades
    .filter((c) => c.relevante)
    .reduce<CidadeDevolucao | null>(
      (pior, c) => (pior === null || c.taxa > pior.taxa ? c : pior),
      null,
    );
}

/**
 * Cor do município no mapa. Não relevante (ou teto 0) → neutro. Caso contrário,
 * um passo da rampa proporcional a `taxa / tetoRelevante` (o pior vira o tom mais
 * intenso). `tetoRelevante` = maior taxa entre as cidades relevantes.
 */
export function corDaTaxa(taxa: number, relevante: boolean, tetoRelevante: number): string {
  if (!relevante || tetoRelevante <= 0) return COR_NEUTRA;
  const razao = Math.min(1, Math.max(0, taxa / tetoRelevante));
  const i = Math.min(RAMPA.length - 1, Math.floor(razao * RAMPA.length));
  return RAMPA[i];
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `npx vitest run src/domain/devolucoes-mapa.test.ts`
Expected: PASS (todos os `describe`/`it` verdes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/devolucoes-mapa.ts src/domain/devolucoes-mapa.test.ts
git commit -m "feat(devolucoes): domínio do mapa de calor por cidade (taxa/piso/pior/cor)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Geometria — script gerador + `pe-municipios.json`

**Files:**
- Create: `scripts/gen-geo-pe.mjs`
- Create: `src/data/geo/pe-municipios.json` (saída do script)
- Test: `src/data/geo/pe-municipios.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `pe-municipios.json` = `Array<{ ibge: string; nome: string; d: string }>` (ibge = 7 dígitos; `d` = path SVG num viewBox `0 0 1000 H`).

- [ ] **Step 1: Escrever o script gerador**

Create `scripts/gen-geo-pe.mjs`. Busca a malha de municípios de PE (código IBGE do estado = 26) na API do IBGE, projeta lon/lat para um viewBox de largura 1000 (equirretangular com correção de longitude pela latitude média) e grava o JSON. Roda uma vez, offline em produção.

```js
// Gera src/data/geo/pe-municipios.json a partir da malha de municípios do IBGE.
// Uso: node scripts/gen-geo-pe.mjs
// Requer acesso à internet (API do IBGE) — roda só uma vez, não em runtime.
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const URL =
  "https://servicodados.ibge.gov.br/api/v3/malhas/estados/26/municipios" +
  "?formato=application/vnd.geo+json&intraregiao=municipio&qualidade=intermediaria";
const OUT = "src/data/geo/pe-municipios.json";
const W = 1000; // largura do viewBox

const rings = (geom) =>
  geom.type === "Polygon"
    ? [geom.coordinates]
    : geom.type === "MultiPolygon"
      ? geom.coordinates
      : [];

function bbox(features) {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const f of features)
    for (const poly of rings(f.geometry))
      for (const ring of poly)
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
  return { minLon, maxLon, minLat, maxLat };
}

function makeProjector({ minLon, maxLon, minLat, maxLat }) {
  const midLat = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const kx = Math.cos(midLat); // corrige a "largura" de 1 grau de longitude
  const spanX = (maxLon - minLon) * kx;
  const scale = W / spanX;
  const H = (maxLat - minLat) * scale;
  const project = (lon, lat) => [
    (lon - minLon) * kx * scale,
    (maxLat - lat) * scale, // y invertido (SVG cresce p/ baixo)
  ];
  return { project, H };
}

function pathOf(geometry, project) {
  const parts = [];
  for (const poly of rings(geometry))
    for (const ring of poly) {
      const pts = ring.map(([lon, lat]) => {
        const [x, y] = project(lon, lat);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      if (pts.length) parts.push("M" + pts.join("L") + "Z");
    }
  return parts.join("");
}

const res = await fetch(URL);
if (!res.ok) throw new Error(`IBGE respondeu ${res.status}`);
const geo = await res.json();
const features = geo.features;

const box = bbox(features);
const { project, H } = makeProjector(box);

const out = features
  .map((f) => ({
    // Na malha do IBGE o código do município fica em properties.codarea.
    ibge: String(f.properties.codarea ?? f.properties.CD_MUN ?? f.id),
    nome: String(f.properties.nome ?? f.properties.NM_MUN ?? ""),
    d: pathOf(f.geometry, project),
  }))
  .filter((m) => m.ibge && m.d)
  .sort((a, b) => a.ibge.localeCompare(b.ibge));

mkdirSync(dirname(OUT), { recursive: true });
// viewBox como primeira linha de metadado não cabe num array; guardamos a altura
// junto de cada consumidor via o maior y. Aqui só gravamos os municípios.
writeFileSync(OUT, JSON.stringify(out));
console.log(`OK: ${out.length} municípios · viewBox 0 0 ${W} ${Math.ceil(H)} → ${OUT}`);
```

- [ ] **Step 2: Rodar o script e gerar o JSON**

Run: `node scripts/gen-geo-pe.mjs`
Expected: imprime `OK: 185 municípios · viewBox 0 0 1000 <H> → src/data/geo/pe-municipios.json` (PE tem 184 municípios + o distrito estadual de Fernando de Noronha; ~185 features). **Anote o valor de `<H>`** impresso — ele é a altura do viewBox usada na Task 4 (`0 0 1000 <H>`).

Se estiver offline e a API do IBGE não responder: baixe manualmente o GeoJSON da malha de PE (mesma URL) para um arquivo local e ajuste o `fetch` para `readFileSync`. O formato do GeoJSON é o mesmo.

- [ ] **Step 3: Escrever o teste de sanidade do asset**

Create `src/data/geo/pe-municipios.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import municipios from "./pe-municipios.json";

describe("pe-municipios.json", () => {
  it("cobre os municípios de PE (>= 184)", () => {
    expect(municipios.length).toBeGreaterThanOrEqual(184);
  });

  it("todo município tem IBGE de 7 dígitos e um path não vazio", () => {
    for (const m of municipios) {
      expect(m.ibge).toMatch(/^\d{7}$/);
      expect(m.d.length).toBeGreaterThan(0);
      expect(m.d.startsWith("M")).toBe(true);
    }
  });

  it("inclui Recife (2611606)", () => {
    expect(municipios.some((m) => m.ibge === "2611606")).toBe(true);
  });

  it("não tem IBGE duplicado", () => {
    const set = new Set(municipios.map((m) => m.ibge));
    expect(set.size).toBe(municipios.length);
  });
});
```

Se o `tsconfig` reclamar de import de JSON, confirme que `resolveJsonModule` está ligado (o Next liga por padrão); nenhuma mudança deve ser necessária.

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run src/data/geo/pe-municipios.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-geo-pe.mjs src/data/geo/pe-municipios.json src/data/geo/pe-municipios.test.ts
git commit -m "feat(devolucoes): geometria SVG dos municípios de PE (asset + gerador)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Dados — `getDevolucaoPorCidade` no Winthor

**Files:**
- Modify: `src/data/devolucoes.ts`

**Interfaces:**
- Consumes: `LinhaCidadeDevolucao` de `@/domain/devolucoes-mapa`; `queryWinthor`, `filialIn`, e as constantes/CTE (`faixa`, `ED_CTE`/`ctes`) já no arquivo.
- Produces: `getDevolucaoPorCidade(ini: string, fim: string): Promise<LinhaCidadeDevolucao[]>` (cacheada).

> **Nota de teste:** as queries Oracle deste arquivo não têm teste unitário no projeto (dependem da rede da empresa). Esta task segue a mesma prática: a validação é manual, on-site, contra a rotina 111 / dashboard. O plano entrega o SQL completo e o mapeamento; a verificação automatizada fica no domínio (Task 1) e na geometria (Task 2).

- [ ] **Step 1: Importar o tipo do domínio**

Modify `src/data/devolucoes.ts` — adicionar ao bloco de import de tipos do domínio (junto de `ResumoDevolucoes`, etc.):

```ts
import type { LinhaCidadeDevolucao } from "@/domain/devolucoes-mapa";
```

- [ ] **Step 2: Adicionar a query e a função (fim do arquivo)**

Append em `src/data/devolucoes.ts`:

```ts
// --- Devolução por cidade (PE) ------------------------------------------------
// Faturado e devolvido atribuídos à CIDADE DO CLIENTE DA VENDA. O faturado usa os
// mesmos filtros da query de motorista (condvenda de bonificação/brinde fora); o
// devolvido reusa a CTE `edf` (líquido, rotina 111, NUMTRANSVENDA > 0), ligado à
// venda de origem. FULL OUTER JOIN por cidade: pode haver faturamento sem
// devolução (e, raro, o inverso). Só UF = 'PE'.
//
// ⚠️ Nomes de coluna de cidade/IBGE/UF a confirmar na rede da empresa. Hipótese:
//    PCCLIENT.CODCIDADE → PCCIDADE (CODCIDADE, CIDADE, CODIBGE, ESTADO).
const sqlCidade = () => `
WITH ${ctes({})},
fat AS (
  SELECT ci.CODIBGE, MAX(ci.CIDADE) CIDADE, SUM(nf.VLTOTAL) FATURADO
  FROM PCNFSAID nf
  JOIN PCCLIENT cli ON cli.CODCLI = nf.CODCLI
  JOIN PCCIDADE ci ON ci.CODCIDADE = cli.CODCIDADE
  WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")}
    AND NVL(nf.CONDVENDA, 0) NOT IN (4,8,10,13,20,98,99)
    AND nf.DTCANCEL IS NULL
    AND ci.ESTADO = 'PE'
  GROUP BY ci.CODIBGE
),
dev AS (
  SELECT ci.CODIBGE,
         SUM(edf.VL) DEVOLVIDO,
         COUNT(DISTINCT edf.NUMTRANSENT) NOTAS
  FROM edf
  JOIN PCNFSAID s ON s.NUMTRANSVENDA = edf.NUMTRANSVENDA
  JOIN PCCLIENT cli ON cli.CODCLI = s.CODCLI
  JOIN PCCIDADE ci ON ci.CODCIDADE = cli.CODCIDADE
  WHERE edf.NUMTRANSVENDA > 0 AND ci.ESTADO = 'PE'
  GROUP BY ci.CODIBGE
)
SELECT TO_CHAR(NVL(fat.CODIBGE, dev.CODIBGE)) IBGE,
       fat.CIDADE,
       ROUND(NVL(fat.FATURADO, 0), 2) FATURADO,
       ROUND(NVL(dev.DEVOLVIDO, 0), 2) DEVOLVIDO,
       NVL(dev.NOTAS, 0) NOTAS
FROM fat FULL OUTER JOIN dev ON dev.CODIBGE = fat.CODIBGE
WHERE NVL(fat.CODIBGE, dev.CODIBGE) IS NOT NULL`;

interface LinhaCidadeRaw {
  IBGE: string | null;
  CIDADE: string | null;
  FATURADO: number;
  DEVOLVIDO: number;
  NOTAS: number;
}

/**
 * Faturado e devolvido por município de PE no período [ini, fim], para o mapa de
 * calor. Sem taxa aqui — ela é derivada no domínio (`comTaxa`). Winthor
 * indisponível ⇒ `[]` (a seção do mapa mostra estado vazio).
 */
export const getDevolucaoPorCidade = cache(async (
  ini: string,
  fim: string,
): Promise<LinhaCidadeDevolucao[]> => {
  try {
    const rows = await queryWinthor<LinhaCidadeRaw>(sqlCidade(), { ini, fim });
    return rows
      .filter((r) => r.IBGE)
      .map((r) => ({
        ibge: String(r.IBGE),
        cidade: r.CIDADE ?? `Cidade ${r.IBGE}`,
        faturado: n(r.FATURADO),
        devolvido: n(r.DEVOLVIDO),
        notasDevolvidas: n(r.NOTAS),
      }));
  } catch (erro) {
    console.error("[devolucoes] mapa por cidade indisponível:", (erro as Error).message);
    return [];
  }
});
```

- [ ] **Step 3: Checar tipos e lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: sem erros (a função compila; `n`, `cache`, `queryWinthor`, `filialIn`, `faixa`, `ctes` já existem no arquivo).

> Não há teste unitário nesta task (query Oracle). A verificação de comportamento acontece na Task 4 (render local com estado vazio, sem rede) e on-site contra a rotina 111.

- [ ] **Step 4: Commit**

```bash
git add src/data/devolucoes.ts
git commit -m "feat(devolucoes): query getDevolucaoPorCidade (faturado+devolvido por município PE)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: UI — seção do mapa em `/devolucoes`

**Files:**
- Create: `src/app/(app)/devolucoes/mapa-devolucoes.tsx`
- Modify: `src/app/(app)/devolucoes/page.tsx`

**Interfaces:**
- Consumes: `getDevolucaoPorCidade` (Task 3); `comTaxa`, `piorCidade`, `corDaTaxa`, `COR_NEUTRA`, `CidadeDevolucao` (Task 1); `pe-municipios.json` (Task 2); `formatBRL`, `formatPercent` (existentes).
- Produces: componente `MapaDevolucoes` e a seção renderizada na página.

- [ ] **Step 1: Escrever o client component do mapa**

Create `src/app/(app)/devolucoes/mapa-devolucoes.tsx`. Recebe os municípios já juntados (geometria + dados) e o resumo; cuida só do hover. Use a **altura do viewBox anotada na Task 2** no lugar de `<VIEWBOX_H>`.

```tsx
"use client";

import { useState } from "react";
import { corDaTaxa, COR_NEUTRA } from "@/domain/devolucoes-mapa";
import type { CidadeDevolucao } from "@/domain/devolucoes-mapa";
import { formatBRL, formatPercent } from "@/domain/format";

export interface MunicipioMapa {
  ibge: string;
  nome: string;
  d: string; // path SVG
  dados: CidadeDevolucao | null; // devolução da cidade, se houver
}

// Altura do viewBox impressa por scripts/gen-geo-pe.mjs (Task 2). Largura fixa 1000.
const VIEWBOX = "0 0 1000 <VIEWBOX_H>";

export function MapaDevolucoes({
  municipios,
  teto,
  ranking,
}: {
  municipios: MunicipioMapa[];
  teto: number; // maior taxa entre as relevantes (escala do choropleth)
  ranking: CidadeDevolucao[]; // relevantes, já ordenadas desc por taxa
}) {
  const [hover, setHover] = useState<MunicipioMapa | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const ativo = hover?.dados ?? ranking.find((c) => c.ibge === selecionado) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="relative">
        <svg viewBox={VIEWBOX} className="h-auto w-full" role="img" aria-label="Mapa de devolução por cidade de Pernambuco">
          {municipios.map((m) => {
            const d = m.dados;
            const fill = d ? corDaTaxa(d.taxa, d.relevante, teto) : COR_NEUTRA;
            const destaque = selecionado === m.ibge || hover?.ibge === m.ibge;
            return (
              <path
                key={m.ibge}
                d={m.d}
                fill={fill}
                stroke={destaque ? "#141a4d" : "#ffffff"}
                strokeWidth={destaque ? 1.6 : 0.4}
                onMouseEnter={() => setHover(m)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setSelecionado((s) => (s === m.ibge ? null : m.ibge))}
                className="cursor-pointer transition-[stroke-width]"
              />
            );
          })}
        </svg>

        {ativo && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs shadow-md ring-1 ring-slate-200">
            <div className="font-semibold text-[#141a4d]">{ativo.cidade}</div>
            <div className="tabular-nums text-slate-600">
              Taxa {formatPercent(ativo.taxa)} · devolvido {formatBRL(ativo.devolvido)}
            </div>
            <div className="tabular-nums text-slate-400">faturado {formatBRL(ativo.faturado)}</div>
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
          <span>menor</span>
          <div className="h-2 flex-1 rounded-full bg-gradient-to-r from-[#fde68a] to-[#dc2626]" />
          <span>maior</span>
          <span className="ml-2 inline-flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: COR_NEUTRA }} />
            volume baixo / sem dado
          </span>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-[#141a4d]">Maiores índices</h3>
        {ranking.length === 0 ? (
          <p className="text-sm text-slate-400">Sem cidades com volume relevante no período.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {ranking.slice(0, 12).map((c) => {
              const on = selecionado === c.ibge;
              return (
                <li key={c.ibge}>
                  <button
                    onClick={() => setSelecionado((s) => (s === c.ibge ? null : c.ibge))}
                    className={`flex w-full items-baseline justify-between gap-3 px-1 py-2 text-left transition ${on ? "bg-amber-50" : "hover:bg-slate-50"}`}
                  >
                    <span className="truncate text-sm text-[#141a4d]" title={c.cidade}>{c.cidade}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-rose-600">{formatPercent(c.taxa)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Ligar a seção na página**

Modify `src/app/(app)/devolucoes/page.tsx`.

Imports (junto dos existentes):

```tsx
import municipiosGeo from "@/data/geo/pe-municipios.json";
import { getDevolucoes, listarMotivosDoMes, getDevolucaoPorCidade } from "@/data/devolucoes";
import { comTaxa, piorCidade } from "@/domain/devolucoes-mapa";
import { MapaDevolucoes, type MunicipioMapa } from "./mapa-devolucoes";
```

(Substitua a linha de import de `@/data/devolucoes` existente pela versão acima que inclui `getDevolucaoPorCidade`.)

Adicionar `getDevolucaoPorCidade` ao `Promise.all` (o array vira 4 itens):

```tsx
  const [r, fat, motivosDisponiveis, cidadesRaw] = await Promise.all([
    getDevolucoes(inicio, fim, motivo, setor),
    getResumoFaturamentoDashboard(mesSel),
    listarMotivosDoMes(inicio, fim),
    getDevolucaoPorCidade(inicio, fim),
  ]);
```

Derivar o mapa logo após `mesLabel` (antes do `if (!r)`):

```tsx
  const cidades = comTaxa(cidadesRaw);
  const porIbge = new Map(cidades.map((c) => [c.ibge, c]));
  const municipiosMapa: MunicipioMapa[] = municipiosGeo.map((g) => ({
    ibge: g.ibge,
    nome: g.nome,
    d: g.d,
    dados: porIbge.get(g.ibge) ?? null,
  }));
  const pior = piorCidade(cidades);
  const tetoTaxa = pior?.taxa ?? 0;
  const ranking = cidades
    .filter((c) => c.relevante)
    .sort((a, b) => b.taxa - a.taxa);
```

Renderizar a seção logo antes do bloco `{/* Motivo + Clientes lado a lado */}`:

```tsx
      <Card className="mb-6 p-5">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h3 className="text-sm font-semibold text-[#141a4d]">Mapa de devolução por cidade · Pernambuco</h3>
          {pior && (
            <span className="text-xs text-slate-500">
              Maior índice: <strong className="text-rose-600">{pior.cidade}</strong> · {formatPercent(pior.taxa)}
            </span>
          )}
        </div>
        {cidades.length === 0 ? (
          <p className="text-sm text-slate-400">
            Mapa indisponível para {formatMesAno(mesSel)} — sem dado de cidade (Winthor fora da rede
            ou mês sem movimento).
          </p>
        ) : (
          <MapaDevolucoes municipios={municipiosMapa} teto={tetoTaxa} ranking={ranking} />
        )}
      </Card>
```

- [ ] **Step 3: Checar tipos, lint e testes**

Run: `npx tsc --noEmit && npm run lint && npx vitest run`
Expected: sem erros; todos os testes (domínio + geometria) passam.

- [ ] **Step 4: Verificação visual local (sem Oracle)**

Localmente o Winthor não responde, então `getDevolucaoPorCidade → []` e a seção mostra o estado vazio — MAS a geometria é estática, então dá pra provar que o SVG desenha trocando temporariamente o estado vazio por um render de teste. Verificação:

1. `preview_start` com `{name: "dev"}` (ou o nome em `.claude/launch.json`; criar se não existir, apontando `npm run dev` na porta do projeto).
2. Navegar para `/devolucoes`.
3. Confirmar via `read_page`/`screenshot`: a seção "Mapa de devolução por cidade · Pernambuco" aparece; o estado vazio é exibido (esperado sem rede). Para provar o desenho do SVG, opcionalmente injete via `javascript_tool` um render com dados fake ou verifique num ambiente com Oracle.
4. `read_console_messages` — sem erros de runtime/hidratação.

A prova de cor/ranking com dados reais é feita on-site (rede da empresa), junto da validação da Task 3 contra a rotina 111.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/devolucoes/mapa-devolucoes.tsx" "src/app/(app)/devolucoes/page.tsx"
git commit -m "feat(devolucoes): seção do mapa de calor de devolução por cidade em /devolucoes

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Self-Review (feita pelo autor do plano)

**Cobertura do spec:**
- Métrica taxa = devolvido/faturado → Task 1 (`comTaxa`) ✓
- Chave = cidade do cliente da venda; UF=PE → Task 3 (SQL) ✓
- Piso de volume → Task 1 (`MIN_FATURADO_CIDADE`, `relevante`) ✓
- Pior cidade (headline) → Task 1 (`piorCidade`) + Task 4 (headline) ✓
- Escala âmbar→vermelho, cinza p/ neutro → Task 1 (`corDaTaxa`, `RAMPA`, `COR_NEUTRA`) ✓
- Geometria SVG estática 184+ municípios → Task 2 ✓
- Seção em /devolucoes com mês do MesNav → Task 4 (Promise.all no mesmo fluxo) ✓
- Hover + ranking + legenda → Task 4 ✓
- Cidade sem match de geometria aparece no ranking → Task 4 (`ranking` vem de `cidades`, independente da geometria) ✓
- Estados de erro (Oracle []) → Task 3 (`[]`) + Task 4 (estado vazio) ✓

**Placeholders:** os únicos marcadores intencionais são `<H>`/`<VIEWBOX_H>` (altura do viewBox), que a Task 2 Step 2 manda anotar da saída do script e a Task 4 Step 1 manda substituir — não são TODOs de código. ⚠️ dos nomes de coluna do Winthor é verificação on-site declarada, não placeholder de implementação.

**Consistência de tipos:** `LinhaCidadeDevolucao`/`CidadeDevolucao` definidos na Task 1, importados nas Tasks 3 e 4 com a mesma forma. `MunicipioMapa` definido na Task 4 e usado consistentemente. `getDevolucaoPorCidade(ini, fim): Promise<LinhaCidadeDevolucao[]>` bate entre Task 3 e Task 4. `corDaTaxa(taxa, relevante, teto)` idêntico em Task 1 e Task 4.

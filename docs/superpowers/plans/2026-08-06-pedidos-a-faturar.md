# Pedidos a Faturar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portar o Monitor Winthor para dentro do dashboard como o relatório "Pedidos a Faturar": lista pedidos liberados/montados sem faturamento, cruza com calendário de rotas e classifica prioridade de faturamento.

**Architecture:** Camadas puras de domínio (`src/domain/pedidos-a-faturar/`) com toda a regra de negócio testável e sem I/O; camada de dados (`src/data/`) para Oracle (`queryWinthor`) e Supabase (`createClient`); página server-rendered com Suspense (`src/app/(app)/pedidos-a-faturar/`). O calendário de rotas vive numa tabela Supabase, editável sem redeploy. A regra de "atrasado" fica isolada em `classificar.ts` (será redefinida depois).

**Tech Stack:** Next.js 16.2.10 (App Router, React Server Components), TypeScript, Supabase (Postgres + RLS), Oracle via `oracledb` (`queryWinthor`), Vitest, Tailwind v4.

## Global Constraints

- **Next.js 16.2.10 tem breaking changes vs. o conhecido.** Antes de escrever qualquer código de Next (páginas, Suspense, params), ler o guia relevante em `node_modules/next/dist/docs/` (regra do AGENTS.md).
- **Identidade visual:** verde é SÓ para receita. Prioridade/status usam vermelho (crítica), âmbar (alta/atenção) e navy (neutro) — NUNCA verde para status/categoria.
- **Supabase é plano Free** — nada de features Pro.
- **RLS:** toda tabela nova segue o padrão existente — `enable row level security` + policy de `select to authenticated using (true)`; `update/delete` só `public.is_admin()`.
- **Migrations:** import em massa roda no SQL Editor do Supabase (autocommit, sem `begin/commit`). Próximo número livre: `0018`.
- **Oracle:** SQL sem `;` final; usar binds; `queryWinthor<T>(sql, binds)` já existe em `src/lib/oracle/client.ts`.
- **Testes:** co-locados como `*.test.ts`; rodar com `npx vitest run <arquivo>`.
- **Commits frequentes** ao fim de cada task.

---

### Task 1: Tipos do domínio + lookup do calendário

**Files:**
- Create: `src/domain/pedidos-a-faturar/tipos.ts`
- Create: `src/domain/pedidos-a-faturar/calendario.ts`
- Test: `src/domain/pedidos-a-faturar/calendario.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - Tipos: `Prioridade`, `SituacaoRota`, `DiaSemana`, `PedidoPendente`, `Rota`, `PedidoClassificado`, `Resumo`, `RankingRca`, `RankingCidade`, `CidadeSemCalendario`, `Relatorio`, `IndiceCalendario`.
  - `normalizarCidade(texto: string): string`
  - `criarIndiceCalendario(rotas: Rota[]): IndiceCalendario` — `IndiceCalendario.buscar(cidade: string | null): Rota | null`

- [ ] **Step 1: Criar `tipos.ts` com todos os tipos do domínio**

```ts
// src/domain/pedidos-a-faturar/tipos.ts
export type Prioridade = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA" | "AJUSTAR_CALENDARIO";

export type SituacaoRota =
  | "ATRASADO_PARA_FATURAMENTO"
  | "SAIDA_HOJE"
  | "AGUARDANDO_DIA_DE_FATURAMENTO"
  | "SEM_CALENDARIO_USANDO_72H";

export type DiaSemana =
  | "SEGUNDA" | "TERCA" | "QUARTA" | "QUINTA" | "SEXTA" | "SABADO" | "DOMINGO";

/** Pedido cru vindo do Winthor (já mapeado do Oracle). `dataLiberacao` é YYYY-MM-DD. */
export interface PedidoPendente {
  numeroPedido: number;
  codigoCliente: number;
  nomeCliente: string;
  cidadeCliente: string | null;
  bairroCliente: string | null;
  ufCliente: string | null;
  codigoRca: number;
  nomeRca: string;
  codigoSupervisor: number | null;
  nomeSupervisor: string | null;
  dataPedido: string;      // YYYY-MM-DD
  dataLiberacao: string;   // YYYY-MM-DD (data de referência p/ prazo)
  statusWinthor: string;
  valorPedido: number;
  pesoPedido: number;
  horasParado: number;
  codigoEmitente: number | null;
  nomeEmitente: string | null;
  reentrega: boolean;
}

/** Uma linha do calendário de rotas (tabela Supabase). */
export interface Rota {
  cidade: string;
  uf: string | null;
  regiaoOperacional: string | null;
  rota: string | null;
  grupoRota: string | null;
  diaSaidaRota: string[];
  diaLimitePedido: string | null;
  janelaEntrega: string[];
  aliases: string[];
  observacao: string | null;
}

export interface PedidoClassificado extends PedidoPendente {
  rota: string | null;
  grupoRota: string | null;
  regiaoOperacional: string | null;
  diaSaidaRota: string[] | null;
  diaLimitePedido: string | null;
  janelaEntrega: string[] | null;
  dataPrevistaFaturamento: string | null; // YYYY-MM-DD
  situacaoRota: SituacaoRota;
  observacaoRota: string | null;
  prioridade: Prioridade;
  motivoPrioridade: string;
}

export interface Resumo {
  total: number;
  criticos: number;
  alta: number;
  media: number;
  baixa: number;
  ajustarCalendario: number;
  valorTotal: number;
}

export interface RankingRca {
  codigoRca: number;
  nomeRca: string;
  totalPedidos: number;
  criticos: number;
  alta: number;
  valorTotal: number;
}

export interface RankingCidade {
  cidade: string;
  rota: string | null;
  totalPedidos: number;
  criticos: number;
  alta: number;
  valorTotal: number;
}

export interface CidadeSemCalendario {
  cidade: string;
  uf: string | null;
  totalPedidos: number;
  valorTotal: number;
  maxHorasParado: number;
  exemplosNumped: number[];
}

export interface Relatorio {
  resumo: Resumo;
  pedidos: PedidoClassificado[];
  rankingRca: RankingRca[];
  rankingCidade: RankingCidade[];
  diagnostico: CidadeSemCalendario[];
}

export interface IndiceCalendario {
  buscar(cidade: string | null): Rota | null;
}
```

- [ ] **Step 2: Escrever o teste que falha (`calendario.test.ts`)**

```ts
// src/domain/pedidos-a-faturar/calendario.test.ts
import { describe, expect, it } from "vitest";
import { normalizarCidade, criarIndiceCalendario } from "./calendario";
import type { Rota } from "./tipos";

const rota = (over: Partial<Rota>): Rota => ({
  cidade: "OROBO", uf: "PE", regiaoOperacional: "MATA", rota: "SEG-01",
  grupoRota: null, diaSaidaRota: ["SEGUNDA"], diaLimitePedido: "SEXTA",
  janelaEntrega: [], aliases: [], observacao: null, ...over,
});

describe("normalizarCidade", () => {
  it("remove acento, sobe caixa e colapsa espaços", () => {
    expect(normalizarCidade("  São   Bento do Una ")).toBe("SAO BENTO DO UNA");
  });
});

describe("criarIndiceCalendario", () => {
  it("acha por nome exato normalizado", () => {
    const idx = criarIndiceCalendario([rota({ cidade: "Orobó" })]);
    expect(idx.buscar("OROBO")?.rota).toBe("SEG-01");
  });

  it("acha por alias", () => {
    const idx = criarIndiceCalendario([
      rota({ cidade: "SAO BENTO DO UNA", aliases: ["SAO BENTO DO UMA"] }),
    ]);
    expect(idx.buscar("Sao Bento do Uma")?.cidade).toBe("SAO BENTO DO UNA");
  });

  it("retorna null p/ cidade ausente ou vazia", () => {
    const idx = criarIndiceCalendario([rota({})]);
    expect(idx.buscar("CIDADE INEXISTENTE")).toBeNull();
    expect(idx.buscar(null)).toBeNull();
    expect(idx.buscar("   ")).toBeNull();
  });
});
```

- [ ] **Step 3: Rodar o teste e ver falhar**

Run: `npx vitest run src/domain/pedidos-a-faturar/calendario.test.ts`
Expected: FAIL — `calendario.ts` não existe / exports indefinidos.

- [ ] **Step 4: Implementar `calendario.ts`**

```ts
// src/domain/pedidos-a-faturar/calendario.ts
import type { IndiceCalendario, Rota } from "./tipos";

/** Tira acento, sobe caixa e colapsa espaços — espelha _normalizar do Python. */
export function normalizarCidade(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove marcas de acento (combining diacriticals)
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** Monta um índice O(1) por nome normalizado (cidade + aliases). */
export function criarIndiceCalendario(rotas: Rota[]): IndiceCalendario {
  const mapa = new Map<string, Rota>();
  for (const r of rotas) {
    mapa.set(normalizarCidade(r.cidade), r);
    for (const alias of r.aliases) {
      const chave = normalizarCidade(alias);
      if (!mapa.has(chave)) mapa.set(chave, r);
    }
  }
  return {
    buscar(cidade: string | null): Rota | null {
      if (!cidade || !cidade.trim()) return null;
      return mapa.get(normalizarCidade(cidade)) ?? null;
    },
  };
}
```

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npx vitest run src/domain/pedidos-a-faturar/calendario.test.ts`
Expected: PASS (4 testes).

- [ ] **Step 6: Commit**

```bash
git add src/domain/pedidos-a-faturar/tipos.ts src/domain/pedidos-a-faturar/calendario.ts src/domain/pedidos-a-faturar/calendario.test.ts
git commit -m "feat(pedidos-a-faturar): tipos do domínio e lookup do calendário de rotas"
```

---

### Task 2: Classificação de prioridade

**Files:**
- Create: `src/domain/pedidos-a-faturar/classificar.ts`
- Test: `src/domain/pedidos-a-faturar/classificar.test.ts`

**Interfaces:**
- Consumes: `PedidoPendente`, `Rota`, `PedidoClassificado` de `./tipos`.
- Produces:
  - `proximoDiaSemanaFuturo(referencia: Date, dia: DiaSemana): Date`
  - `classificarPedido(pedido: PedidoPendente, rota: Rota | null, hoje: Date): PedidoClassificado`

- [ ] **Step 1: Escrever o teste que falha (`classificar.test.ts`)**

```ts
// src/domain/pedidos-a-faturar/classificar.test.ts
import { describe, expect, it } from "vitest";
import { classificarPedido, proximoDiaSemanaFuturo } from "./classificar";
import type { PedidoPendente, Rota } from "./tipos";

const HOJE = new Date(2026, 7, 6); // quinta 06/08/2026 (mês 7 = agosto)

const pedido = (over: Partial<PedidoPendente>): PedidoPendente => ({
  numeroPedido: 1, codigoCliente: 10, nomeCliente: "CLI", cidadeCliente: "OROBO",
  bairroCliente: null, ufCliente: "PE", codigoRca: 5, nomeRca: "RCA",
  codigoSupervisor: null, nomeSupervisor: null, dataPedido: "2026-08-01",
  dataLiberacao: "2026-08-01", statusWinthor: "L", valorPedido: 100, pesoPedido: 0,
  horasParado: 10, codigoEmitente: null, nomeEmitente: null, reentrega: false, ...over,
});

const rota = (over: Partial<Rota>): Rota => ({
  cidade: "OROBO", uf: "PE", regiaoOperacional: "MATA", rota: "SEG-01",
  grupoRota: null, diaSaidaRota: ["SEGUNDA"], diaLimitePedido: "SEXTA",
  janelaEntrega: [], aliases: [], observacao: null, ...over,
});

describe("proximoDiaSemanaFuturo", () => {
  it("libera na própria segunda → aponta pra segunda seguinte (fix delta-0)", () => {
    const seg = new Date(2026, 7, 3); // segunda 03/08
    expect(proximoDiaSemanaFuturo(seg, "SEGUNDA")).toEqual(new Date(2026, 7, 10));
  });
  it("da quinta pra segunda seguinte", () => {
    const qui = new Date(2026, 7, 6);
    expect(proximoDiaSemanaFuturo(qui, "SEGUNDA")).toEqual(new Date(2026, 7, 10));
  });
});

describe("classificarPedido — sem calendário", () => {
  it("<72h → BAIXA", () => {
    const r = classificarPedido(pedido({ cidadeCliente: "XPTO", horasParado: 10 }), null, HOJE);
    expect(r.prioridade).toBe("BAIXA");
    expect(r.situacaoRota).toBe("SEM_CALENDARIO_USANDO_72H");
  });
  it(">=72h → AJUSTAR_CALENDARIO", () => {
    const r = classificarPedido(pedido({ cidadeCliente: "XPTO", horasParado: 80 }), null, HOJE);
    expect(r.prioridade).toBe("AJUSTAR_CALENDARIO");
  });
});

describe("classificarPedido — METROPOLITANA (por horas)", () => {
  const met = rota({ regiaoOperacional: "METROPOLITANA", rota: "MET", diaSaidaRota: [] });
  it("<48h → BAIXA", () => {
    expect(classificarPedido(pedido({ horasParado: 40 }), met, HOJE).prioridade).toBe("BAIXA");
  });
  it("48-72h → ALTA / SAIDA_HOJE", () => {
    const r = classificarPedido(pedido({ horasParado: 50 }), met, HOJE);
    expect(r.prioridade).toBe("ALTA");
    expect(r.situacaoRota).toBe("SAIDA_HOJE");
  });
  it(">=72h → CRITICA / ATRASADO", () => {
    const r = classificarPedido(pedido({ horasParado: 100 }), met, HOJE);
    expect(r.prioridade).toBe("CRITICA");
    expect(r.situacaoRota).toBe("ATRASADO_PARA_FATURAMENTO");
  });
});

describe("classificarPedido — rota semanal", () => {
  it("data prevista já passou → CRITICA", () => {
    // libera seg 03/08 → prevista seg 10/08; se hoje fosse 11/08 estaria atrasado
    const r = classificarPedido(
      pedido({ dataLiberacao: "2026-08-03" }), rota({}), new Date(2026, 7, 11));
    expect(r.prioridade).toBe("CRITICA");
    expect(r.dataPrevistaFaturamento).toBe("2026-08-10");
  });
  it("saída hoje → ALTA", () => {
    const r = classificarPedido(
      pedido({ dataLiberacao: "2026-08-03" }), rota({}), new Date(2026, 7, 10));
    expect(r.prioridade).toBe("ALTA");
  });
  it("saída amanhã → MEDIA", () => {
    const r = classificarPedido(
      pedido({ dataLiberacao: "2026-08-03" }), rota({}), new Date(2026, 7, 9));
    expect(r.prioridade).toBe("MEDIA");
  });
  it("saída no futuro → BAIXA", () => {
    const r = classificarPedido(
      pedido({ dataLiberacao: "2026-08-03" }), rota({}), new Date(2026, 7, 5));
    expect(r.prioridade).toBe("BAIXA");
  });
  it("dia de saída não reconhecido → AJUSTAR_CALENDARIO", () => {
    const r = classificarPedido(pedido({}), rota({ diaSaidaRota: ["FERIADO"] }), HOJE);
    expect(r.prioridade).toBe("AJUSTAR_CALENDARIO");
  });
});

describe("classificarPedido — FORA_PE / ESPECIAL", () => {
  it(">=72h → AJUSTAR_CALENDARIO", () => {
    const r = classificarPedido(
      pedido({ horasParado: 90 }), rota({ regiaoOperacional: "FORA_PE" }), HOJE);
    expect(r.prioridade).toBe("AJUSTAR_CALENDARIO");
  });
  it("<72h → BAIXA", () => {
    const r = classificarPedido(
      pedido({ horasParado: 10 }), rota({ regiaoOperacional: "ESPECIAL" }), HOJE);
    expect(r.prioridade).toBe("BAIXA");
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/domain/pedidos-a-faturar/classificar.test.ts`
Expected: FAIL — `classificar.ts` não existe.

- [ ] **Step 3: Implementar `classificar.ts`**

```ts
// src/domain/pedidos-a-faturar/classificar.ts
import type { DiaSemana, PedidoClassificado, PedidoPendente, Rota } from "./tipos";

// SEGUNDA=0 ... DOMINGO=6 (convenção do Python .weekday()).
const DIAS: Record<string, number> = {
  SEGUNDA: 0, TERCA: 1, QUARTA: 2, QUINTA: 3, SEXTA: 4, SABADO: 5, DOMINGO: 6,
};

/** weekday() estilo Python: segunda=0 ... domingo=6 (JS getDay: domingo=0). */
function weekdayPy(d: Date): number {
  return (d.getDay() + 6) % 7;
}

function addDias(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  r.setDate(r.getDate() + n);
  return r;
}

function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function ddmmaaaa(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** Data (meia-noite local) a partir de "YYYY-MM-DD". */
function dataDeISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Próxima ocorrência de `dia` estritamente após `referencia` (delta 0 → +7). */
export function proximoDiaSemanaFuturo(referencia: Date, dia: DiaSemana): Date {
  const alvo = DIAS[dia];
  let delta = (alvo - weekdayPy(referencia) + 7) % 7;
  if (delta === 0) delta = 7;
  return addDias(referencia, delta);
}

function dataPrevistaSemanal(dataLiberacao: Date, diasSaida: string[]): Date | null {
  const candidatos = diasSaida
    .filter((d): d is DiaSemana => d in DIAS)
    .map((d) => proximoDiaSemanaFuturo(dataLiberacao, d).getTime());
  return candidatos.length ? new Date(Math.min(...candidatos)) : null;
}

function camposRota(rota: Rota, dataPrevista: Date | null) {
  return {
    rota: rota.rota,
    grupoRota: rota.grupoRota,
    regiaoOperacional: rota.regiaoOperacional,
    diaSaidaRota: rota.diaSaidaRota.length ? rota.diaSaidaRota : null,
    diaLimitePedido: rota.diaLimitePedido,
    janelaEntrega: rota.janelaEntrega.length ? rota.janelaEntrega : null,
    dataPrevistaFaturamento: dataPrevista ? isoDate(dataPrevista) : null,
    observacaoRota: rota.observacao,
  };
}

export function classificarPedido(
  pedido: PedidoPendente,
  rota: Rota | null,
  hoje: Date,
): PedidoClassificado {
  const base = { ...pedido };
  const h = pedido.horasParado;

  // 1. Sem calendário
  if (rota === null) {
    const critico = h >= 72;
    return {
      ...base,
      rota: null, grupoRota: null, regiaoOperacional: null, diaSaidaRota: null,
      diaLimitePedido: null, janelaEntrega: null, dataPrevistaFaturamento: null,
      situacaoRota: "SEM_CALENDARIO_USANDO_72H",
      observacaoRota: "Cidade não encontrada no calendário de rotas.",
      prioridade: critico ? "AJUSTAR_CALENDARIO" : "BAIXA",
      motivoPrioridade: critico
        ? `Cidade '${pedido.cidadeCliente}' fora do calendário e ${h.toFixed(0)}h parado (acima de 72h).`
        : `Cidade '${pedido.cidadeCliente}' fora do calendário, dentro das 72h (${h.toFixed(0)}h).`,
    };
  }

  const regiao = (rota.regiaoOperacional ?? "").toUpperCase();
  const liberacao = dataDeISO(pedido.dataLiberacao);

  // 2. METROPOLITANA — por horas
  if (regiao === "METROPOLITANA") {
    const prevista = addDias(liberacao, 3);
    const campos = camposRota(rota, prevista);
    if (h >= 72) {
      return { ...base, ...campos, situacaoRota: "ATRASADO_PARA_FATURAMENTO",
        prioridade: "CRITICA", motivoPrioridade: `Metropolitana: ${h.toFixed(0)}h parado — acima de 72h.` };
    }
    if (h >= 48) {
      return { ...base, ...campos, situacaoRota: "SAIDA_HOJE",
        prioridade: "ALTA", motivoPrioridade: `Metropolitana: ${h.toFixed(0)}h parado — entre 48h e 72h, faturar hoje.` };
    }
    return { ...base, ...campos, situacaoRota: "AGUARDANDO_DIA_DE_FATURAMENTO",
      prioridade: "BAIXA", motivoPrioridade: `Metropolitana: ${h.toFixed(0)}h parado — dentro das 48h.` };
  }

  // 3. FORA_PE / ESPECIAL — tolerância 72h, sem rota operacional
  if (regiao === "FORA_PE" || regiao === "ESPECIAL") {
    const campos = camposRota(rota, null);
    const critico = h >= 72;
    return { ...base, ...campos, situacaoRota: "SEM_CALENDARIO_USANDO_72H",
      prioridade: critico ? "AJUSTAR_CALENDARIO" : "BAIXA",
      motivoPrioridade: `${regiao}: ${h.toFixed(0)}h parado — ${critico ? "acima de 72h" : "dentro de 72h"}, sem rota operacional padrão.` };
  }

  // 4. Rota semanal (inclui SERTAO e demais regiões)
  const prevista = dataPrevistaSemanal(liberacao, rota.diaSaidaRota);
  const campos = camposRota(rota, prevista);
  if (prevista === null) {
    return { ...base, ...campos, situacaoRota: "SEM_CALENDARIO_USANDO_72H",
      prioridade: "AJUSTAR_CALENDARIO",
      motivoPrioridade: "Dias de saída configurados na rota não foram reconhecidos." };
  }
  const hojeMid = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const amanha = addDias(hojeMid, 1);
  const fmt = ddmmaaaa(prevista);
  if (prevista.getTime() < hojeMid.getTime()) {
    return { ...base, ...campos, situacaoRota: "ATRASADO_PARA_FATURAMENTO",
      prioridade: "CRITICA", motivoPrioridade: `Data prevista (${fmt}) já passou. Pedido atrasado — rota ${rota.rota}.` };
  }
  if (prevista.getTime() === hojeMid.getTime()) {
    return { ...base, ...campos, situacaoRota: "SAIDA_HOJE",
      prioridade: "ALTA", motivoPrioridade: `Rota ${rota.rota} tem saída hoje (${fmt}). Faturar com urgência.` };
  }
  if (prevista.getTime() === amanha.getTime()) {
    return { ...base, ...campos, situacaoRota: "AGUARDANDO_DIA_DE_FATURAMENTO",
      prioridade: "MEDIA", motivoPrioridade: `Rota ${rota.rota} sai amanhã (${fmt}). Faturar hoje.` };
  }
  return { ...base, ...campos, situacaoRota: "AGUARDANDO_DIA_DE_FATURAMENTO",
    prioridade: "BAIXA", motivoPrioridade: `Rota ${rota.rota} sai em ${fmt}. Dentro do prazo.` };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/domain/pedidos-a-faturar/classificar.test.ts`
Expected: PASS (todos os describes).

- [ ] **Step 5: Commit**

```bash
git add src/domain/pedidos-a-faturar/classificar.ts src/domain/pedidos-a-faturar/classificar.test.ts
git commit -m "feat(pedidos-a-faturar): classificação de prioridade por rota (porte fiel do monitor-winthor)"
```

---

### Task 3: Montagem do relatório (agregação, ordenação, rankings, diagnóstico)

**Files:**
- Create: `src/domain/pedidos-a-faturar/montar-relatorio.ts`
- Test: `src/domain/pedidos-a-faturar/montar-relatorio.test.ts`

**Interfaces:**
- Consumes: `PedidoPendente`, `IndiceCalendario`, `Relatorio` de `./tipos`; `classificarPedido` de `./classificar`.
- Produces: `montarRelatorio(pedidos: PedidoPendente[], indice: IndiceCalendario, hoje: Date): Relatorio`

- [ ] **Step 1: Escrever o teste que falha (`montar-relatorio.test.ts`)**

```ts
// src/domain/pedidos-a-faturar/montar-relatorio.test.ts
import { describe, expect, it } from "vitest";
import { montarRelatorio } from "./montar-relatorio";
import { criarIndiceCalendario } from "./calendario";
import type { PedidoPendente, Rota } from "./tipos";

const HOJE = new Date(2026, 7, 6);

const pedido = (over: Partial<PedidoPendente>): PedidoPendente => ({
  numeroPedido: 1, codigoCliente: 10, nomeCliente: "CLI", cidadeCliente: "OROBO",
  bairroCliente: null, ufCliente: "PE", codigoRca: 5, nomeRca: "RCA A",
  codigoSupervisor: null, nomeSupervisor: null, dataPedido: "2026-08-01",
  dataLiberacao: "2026-08-01", statusWinthor: "L", valorPedido: 100, pesoPedido: 0,
  horasParado: 200, codigoEmitente: null, nomeEmitente: null, reentrega: false, ...over,
});

const met: Rota = {
  cidade: "RECIFE", uf: "PE", regiaoOperacional: "METROPOLITANA", rota: "MET",
  grupoRota: null, diaSaidaRota: [], diaLimitePedido: null, janelaEntrega: [],
  aliases: [], observacao: null,
};

describe("montarRelatorio", () => {
  const idx = criarIndiceCalendario([met]);

  it("conta o resumo e soma o valor total", () => {
    const rel = montarRelatorio(
      [pedido({ numeroPedido: 1, cidadeCliente: "RECIFE", horasParado: 100, valorPedido: 100 }),
       pedido({ numeroPedido: 2, cidadeCliente: "RECIFE", horasParado: 40, valorPedido: 50 })],
      idx, HOJE);
    expect(rel.resumo.total).toBe(2);
    expect(rel.resumo.criticos).toBe(1);
    expect(rel.resumo.baixa).toBe(1);
    expect(rel.resumo.valorTotal).toBe(150);
  });

  it("ordena críticos antes de baixa", () => {
    const rel = montarRelatorio(
      [pedido({ numeroPedido: 1, cidadeCliente: "RECIFE", horasParado: 40 }),   // BAIXA
       pedido({ numeroPedido: 2, cidadeCliente: "RECIFE", horasParado: 100 })], // CRITICA
      idx, HOJE);
    expect(rel.pedidos[0].numeroPedido).toBe(2);
  });

  it("agrupa ranking por RCA ordenado por críticos", () => {
    const rel = montarRelatorio(
      [pedido({ numeroPedido: 1, codigoRca: 5, nomeRca: "A", cidadeCliente: "RECIFE", horasParado: 100 }),
       pedido({ numeroPedido: 2, codigoRca: 9, nomeRca: "B", cidadeCliente: "RECIFE", horasParado: 40 })],
      idx, HOJE);
    expect(rel.rankingRca[0].codigoRca).toBe(5);
    expect(rel.rankingRca[0].criticos).toBe(1);
  });

  it("diagnóstico agrupa cidades fora do calendário", () => {
    const rel = montarRelatorio(
      [pedido({ numeroPedido: 7, cidadeCliente: "CIDADE X", horasParado: 90, valorPedido: 30 }),
       pedido({ numeroPedido: 8, cidadeCliente: "CIDADE X", horasParado: 50, valorPedido: 20 })],
      idx, HOJE);
    expect(rel.diagnostico).toHaveLength(1);
    expect(rel.diagnostico[0].cidade).toBe("CIDADE X");
    expect(rel.diagnostico[0].totalPedidos).toBe(2);
    expect(rel.diagnostico[0].valorTotal).toBe(50);
    expect(rel.diagnostico[0].maxHorasParado).toBe(90);
    expect(rel.diagnostico[0].exemplosNumped).toEqual([7, 8]);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/domain/pedidos-a-faturar/montar-relatorio.test.ts`
Expected: FAIL — `montar-relatorio.ts` não existe.

- [ ] **Step 3: Implementar `montar-relatorio.ts`**

```ts
// src/domain/pedidos-a-faturar/montar-relatorio.ts
import { classificarPedido } from "./classificar";
import type {
  CidadeSemCalendario, IndiceCalendario, PedidoClassificado, PedidoPendente,
  Prioridade, RankingCidade, RankingRca, Relatorio,
} from "./tipos";

const ORDEM: Record<Prioridade, number> = {
  CRITICA: 0, AJUSTAR_CALENDARIO: 1, ALTA: 2, MEDIA: 3, BAIXA: 4,
};

export function montarRelatorio(
  pedidos: PedidoPendente[],
  indice: IndiceCalendario,
  hoje: Date,
): Relatorio {
  const classificados: PedidoClassificado[] = pedidos.map((p) =>
    classificarPedido(p, indice.buscar(p.cidadeCliente), hoje),
  );

  classificados.sort((a, b) => {
    const po = ORDEM[a.prioridade] - ORDEM[b.prioridade];
    if (po !== 0) return po;
    const da = a.dataPrevistaFaturamento ?? "9999-12-31";
    const db = b.dataPrevistaFaturamento ?? "9999-12-31";
    if (da !== db) return da < db ? -1 : 1;
    return b.horasParado - a.horasParado;
  });

  const resumo = {
    total: classificados.length,
    criticos: classificados.filter((p) => p.prioridade === "CRITICA").length,
    alta: classificados.filter((p) => p.prioridade === "ALTA").length,
    media: classificados.filter((p) => p.prioridade === "MEDIA").length,
    baixa: classificados.filter((p) => p.prioridade === "BAIXA").length,
    ajustarCalendario: classificados.filter((p) => p.prioridade === "AJUSTAR_CALENDARIO").length,
    valorTotal: classificados.reduce((s, p) => s + p.valorPedido, 0),
  };

  const rcaAcc = new Map<number, RankingRca>();
  for (const p of classificados) {
    const r = rcaAcc.get(p.codigoRca) ?? {
      codigoRca: p.codigoRca, nomeRca: p.nomeRca,
      totalPedidos: 0, criticos: 0, alta: 0, valorTotal: 0,
    };
    r.totalPedidos += 1;
    r.valorTotal += p.valorPedido;
    if (p.prioridade === "CRITICA") r.criticos += 1;
    if (p.prioridade === "ALTA") r.alta += 1;
    rcaAcc.set(p.codigoRca, r);
  }
  const rankingRca = [...rcaAcc.values()].sort(
    (a, b) => b.criticos - a.criticos || b.alta - a.alta || b.totalPedidos - a.totalPedidos,
  );

  const cidadeAcc = new Map<string, RankingCidade>();
  for (const p of classificados) {
    const chave = p.cidadeCliente ?? "SEM CIDADE";
    const c = cidadeAcc.get(chave) ?? {
      cidade: chave, rota: p.rota, totalPedidos: 0, criticos: 0, alta: 0, valorTotal: 0,
    };
    c.totalPedidos += 1;
    c.valorTotal += p.valorPedido;
    if (p.prioridade === "CRITICA") c.criticos += 1;
    if (p.prioridade === "ALTA") c.alta += 1;
    cidadeAcc.set(chave, c);
  }
  const rankingCidade = [...cidadeAcc.values()].sort(
    (a, b) => b.criticos - a.criticos || b.alta - a.alta || b.totalPedidos - a.totalPedidos,
  );

  // Diagnóstico: cidades dos pedidos que NÃO existem no calendário.
  const diagAcc = new Map<string, CidadeSemCalendario>();
  for (const p of classificados) {
    if (indice.buscar(p.cidadeCliente) !== null) continue;
    const chave = p.cidadeCliente ?? "SEM CIDADE";
    const d = diagAcc.get(chave) ?? {
      cidade: chave, uf: p.ufCliente, totalPedidos: 0, valorTotal: 0,
      maxHorasParado: 0, exemplosNumped: [],
    };
    d.totalPedidos += 1;
    d.valorTotal += p.valorPedido;
    d.maxHorasParado = Math.max(d.maxHorasParado, p.horasParado);
    if (d.exemplosNumped.length < 5) d.exemplosNumped.push(p.numeroPedido);
    diagAcc.set(chave, d);
  }
  const diagnostico = [...diagAcc.values()].sort((a, b) => b.totalPedidos - a.totalPedidos);

  return { resumo, pedidos: classificados, rankingRca, rankingCidade, diagnostico };
}
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/domain/pedidos-a-faturar/montar-relatorio.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/pedidos-a-faturar/montar-relatorio.ts src/domain/pedidos-a-faturar/montar-relatorio.test.ts
git commit -m "feat(pedidos-a-faturar): montagem do relatório (resumo, rankings, diagnóstico)"
```

---

### Task 4: Migration e seed da tabela `calendario_rotas`

**Files:**
- Create: `supabase/migrations/0018_calendario_rotas.sql`
- Create: `scripts/seed-calendario-rotas.mjs`

**Interfaces:**
- Consumes: `calendario_rotas.json` do projeto de origem.
- Produces: tabela `public.calendario_rotas` no Supabase, populada.

**Nota:** aplicar migration/seed roda no **SQL Editor do Supabase** (não há CLI de banco neste ambiente). A verificação é manual: contar as linhas após o import.

- [ ] **Step 1: Criar a migration**

```sql
-- supabase/migrations/0018_calendario_rotas.sql
-- Calendário de rotas por cidade (porte do monitor-winthor/calendario_rotas.json).
-- Alimenta a classificação de prioridade do relatório "Pedidos a Faturar".
-- Editável sem redeploy: um UPDATE aqui muda a classificação na hora.
create table if not exists public.calendario_rotas (
  id                 bigint generated always as identity primary key,
  cidade             text not null,
  uf                 text,
  regiao_operacional text,   -- METROPOLITANA | AGRESTE | MATA | LITORAL | SERTAO | FORA_PE | ESPECIAL
  rota               text,
  grupo_rota         text,
  dia_saida_rota     text[] not null default '{}',
  dia_limite_pedido  text,
  janela_entrega     text[] not null default '{}',
  aliases            text[] not null default '{}',
  observacao         text,
  updated_at         timestamptz not null default now()
);

create index if not exists idx_calendario_rotas_cidade
  on public.calendario_rotas (cidade);

alter table public.calendario_rotas enable row level security;

create policy "read calendario_rotas" on public.calendario_rotas
  for select to authenticated using (true);

create policy "write calendario_rotas insert" on public.calendario_rotas
  for insert to authenticated with check (public.is_admin());
create policy "write calendario_rotas update" on public.calendario_rotas
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "write calendario_rotas delete" on public.calendario_rotas
  for delete to authenticated using (public.is_admin());
```

- [ ] **Step 2: Criar o gerador de seed**

```js
// scripts/seed-calendario-rotas.mjs
// Lê o calendario_rotas.json do monitor-winthor e imprime os INSERTs para
// colar no SQL Editor do Supabase (import em massa, autocommit).
// Uso: node scripts/seed-calendario-rotas.mjs > /tmp/seed-calendario.sql
import { readFileSync } from "node:fs";

const ORIGEM =
  process.env.CALENDARIO_JSON ??
  "/Users/pedromarinho/Desktop/Projetos DIA/monitor-winthor/app/config/calendario_rotas.json";

const linhas = JSON.parse(readFileSync(ORIGEM, "utf8"));

const q = (v) => (v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) =>
  !a || a.length === 0 ? "'{}'" : `ARRAY[${a.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",")}]::text[]`;

console.log(
  "insert into public.calendario_rotas " +
    "(cidade, uf, regiao_operacional, rota, grupo_rota, dia_saida_rota, dia_limite_pedido, janela_entrega, aliases, observacao) values",
);
const values = linhas.map(
  (r) =>
    `(${q(r.cidade)}, ${q(r.uf)}, ${q(r.regiao_operacional)}, ${q(r.rota)}, ${q(r.grupo_rota)}, ` +
    `${arr(r.dia_saida_rota)}, ${q(r.dia_limite_pedido)}, ${arr(r.janela_entrega)}, ${arr(r.aliases)}, ${q(r.observacao)})`,
);
console.log(values.join(",\n") + ";");
```

- [ ] **Step 3: Gerar o SQL de seed e conferir a contagem**

Run: `node scripts/seed-calendario-rotas.mjs > /tmp/seed-calendario.sql && grep -c "^(" /tmp/seed-calendario.sql`
Expected: `173` (uma linha de valores por cidade).

- [ ] **Step 4: Commit** (aplicação no Supabase é manual, fora do git)

```bash
git add supabase/migrations/0018_calendario_rotas.sql scripts/seed-calendario-rotas.mjs
git commit -m "feat(pedidos-a-faturar): tabela calendario_rotas + gerador de seed"
```

> **Ação manual (fora do plano automatizado):** rodar a migration `0018` e colar o
> conteúdo de `/tmp/seed-calendario.sql` no SQL Editor do Supabase. Conferir com
> `select count(*) from calendario_rotas;` → deve dar 173.

---

### Task 5: Camada de dados do calendário (Supabase)

**Files:**
- Create: `src/data/calendario-rotas.ts`
- Test: `src/data/calendario-rotas.test.ts`

**Interfaces:**
- Consumes: `Rota` de `@/domain/pedidos-a-faturar/tipos`; `createClient` de `@/lib/supabase/server`.
- Produces:
  - `mapRowToRota(row): Rota` (puro, testável)
  - `getRotas(): Promise<Rota[]>`

- [ ] **Step 1: Escrever o teste que falha (mapper puro)**

```ts
// src/data/calendario-rotas.test.ts
import { describe, expect, it } from "vitest";
import { mapRowToRota } from "./calendario-rotas";

describe("mapRowToRota", () => {
  it("mapea colunas snake_case → camelCase e arrays", () => {
    const r = mapRowToRota({
      cidade: "OROBO", uf: "PE", regiao_operacional: "MATA", rota: "SEG-01",
      grupo_rota: null, dia_saida_rota: ["SEGUNDA"], dia_limite_pedido: "SEXTA",
      janela_entrega: [], aliases: ["OROBÓ"], observacao: null,
    });
    expect(r.cidade).toBe("OROBO");
    expect(r.regiaoOperacional).toBe("MATA");
    expect(r.diaSaidaRota).toEqual(["SEGUNDA"]);
    expect(r.aliases).toEqual(["OROBÓ"]);
  });

  it("normaliza nulos de array para []", () => {
    const r = mapRowToRota({ cidade: "X", dia_saida_rota: null, janela_entrega: null, aliases: null });
    expect(r.diaSaidaRota).toEqual([]);
    expect(r.janelaEntrega).toEqual([]);
    expect(r.aliases).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/data/calendario-rotas.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `calendario-rotas.ts`**

```ts
// src/data/calendario-rotas.ts
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Rota } from "@/domain/pedidos-a-faturar/tipos";

const COLUNAS =
  "cidade, uf, regiao_operacional, rota, grupo_rota, dia_saida_rota, dia_limite_pedido, janela_entrega, aliases, observacao";

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

export function mapRowToRota(row: Record<string, unknown>): Rota {
  return {
    cidade: String(row.cidade),
    uf: (row.uf as string) ?? null,
    regiaoOperacional: (row.regiao_operacional as string) ?? null,
    rota: (row.rota as string) ?? null,
    grupoRota: (row.grupo_rota as string) ?? null,
    diaSaidaRota: arr(row.dia_saida_rota),
    diaLimitePedido: (row.dia_limite_pedido as string) ?? null,
    janelaEntrega: arr(row.janela_entrega),
    aliases: arr(row.aliases),
    observacao: (row.observacao as string) ?? null,
  };
}

/** Lê o calendário inteiro (tabela pequena). Memoizado por request. */
export const getRotas = cache(async (): Promise<Rota[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendario_rotas").select(COLUNAS);
  if (error) {
    console.error("[calendario-rotas] Supabase indisponível:", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRowToRota(r as Record<string, unknown>));
});
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/data/calendario-rotas.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/calendario-rotas.ts src/data/calendario-rotas.test.ts
git commit -m "feat(pedidos-a-faturar): leitura do calendário de rotas do Supabase"
```

---

### Task 6: Camada de dados dos pedidos (Oracle/Winthor)

**Files:**
- Create: `src/data/pedidos-a-faturar.ts`
- Test: `src/data/pedidos-a-faturar.test.ts`

**Interfaces:**
- Consumes: `PedidoPendente` de `@/domain/pedidos-a-faturar/tipos`; `queryWinthor` de `@/lib/oracle/client`.
- Produces:
  - `mapRowToPedido(row): PedidoPendente` (puro, testável)
  - `getPedidosPendentes(): Promise<PedidoPendente[] | null>` (`null` = Winthor indisponível)

- [ ] **Step 1: Escrever o teste que falha (mapper puro)**

```ts
// src/data/pedidos-a-faturar.test.ts
import { describe, expect, it } from "vitest";
import { mapRowToPedido } from "./pedidos-a-faturar";

describe("mapRowToPedido", () => {
  it("mapeia colunas, converte reentrega 'S'→true e datas p/ YYYY-MM-DD", () => {
    const p = mapRowToPedido({
      NUMERO_PEDIDO: 123, CODIGO_CLIENTE: 10, NOME_CLIENTE: "CLI",
      CIDADE_CLIENTE: "OROBO", BAIRRO_CLIENTE: "CENTRO", UF_CLIENTE: "PE",
      CODIGO_RCA: 5, NOME_RCA: "RCA", CODIGO_SUPERVISOR: 2, NOME_SUPERVISOR: "SUP",
      DATA_PEDIDO: new Date(2026, 7, 1, 9, 0), DATA_LIBERACAO: new Date(2026, 7, 1, 15, 30),
      STATUS_WINTHOR: "L", VALOR_PEDIDO: 100.5, PESO_PEDIDO: 12, HORAS_PARADO: 73.2,
      CODIGO_EMITENTE: 644, NOME_EMITENTE: "EMI", REENTREGA: "S",
    });
    expect(p.numeroPedido).toBe(123);
    expect(p.reentrega).toBe(true);
    expect(p.dataLiberacao).toBe("2026-08-01");
    expect(p.valorPedido).toBe(100.5);
    expect(p.horasParado).toBe(73.2);
  });

  it("reentrega 'N' → false e nulos preservados", () => {
    const p = mapRowToPedido({
      NUMERO_PEDIDO: 1, CODIGO_CLIENTE: 1, NOME_CLIENTE: "C", CIDADE_CLIENTE: null,
      BAIRRO_CLIENTE: null, UF_CLIENTE: null, CODIGO_RCA: 1, NOME_RCA: "R",
      CODIGO_SUPERVISOR: null, NOME_SUPERVISOR: null, DATA_PEDIDO: new Date(2026, 0, 1),
      DATA_LIBERACAO: new Date(2026, 0, 1), STATUS_WINTHOR: "M", VALOR_PEDIDO: 0,
      PESO_PEDIDO: 0, HORAS_PARADO: 0, CODIGO_EMITENTE: null, NOME_EMITENTE: null, REENTREGA: "N",
    });
    expect(p.reentrega).toBe(false);
    expect(p.cidadeCliente).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar o teste e ver falhar**

Run: `npx vitest run src/data/pedidos-a-faturar.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implementar `pedidos-a-faturar.ts`**

```ts
// src/data/pedidos-a-faturar.ts
import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import type { PedidoPendente } from "@/domain/pedidos-a-faturar/tipos";

// Pedidos liberados (L) e montados (M) sem faturamento, últimos 30 dias.
// Sem ';' final (exigência do queryWinthor). Binds: status_liberado, status_montado.
const SQL = `
SELECT
    ped.NUMPED               AS numero_pedido,
    ped.CODCLI               AS codigo_cliente,
    cli.CLIENTE              AS nome_cliente,
    cli.MUNICENT             AS cidade_cliente,
    cli.BAIRROENT            AS bairro_cliente,
    cli.ESTENT               AS uf_cliente,
    ped.CODUSUR              AS codigo_rca,
    rca.NOME                 AS nome_rca,
    rca.CODSUPERVISOR        AS codigo_supervisor,
    s.NOME                   AS nome_supervisor,
    ped.DATA                 AS data_pedido,
    NVL(ped.DTLIBERA, ped.DATA) AS data_liberacao,
    ped.POSICAO              AS status_winthor,
    NVL(ped.VLATEND, 0)      AS valor_pedido,
    NVL(ped.TOTPESO, 0)      AS peso_pedido,
    ROUND((SYSDATE - NVL(ped.DTLIBERA, ped.DATA)) * 24, 1) AS horas_parado,
    ped.CODEMITENTE          AS codigo_emitente,
    emp.NOME                 AS nome_emitente,
    CASE WHEN ped.CODEMITENTE IN (644, 629, 521, 1015) THEN 'S' ELSE 'N' END AS reentrega
FROM PCPEDC ped
LEFT JOIN PCCLIENT cli ON cli.CODCLI = ped.CODCLI
LEFT JOIN PCUSUARI rca ON rca.CODUSUR = ped.CODUSUR
LEFT JOIN PCSUPERV s   ON s.CODSUPERVISOR = rca.CODSUPERVISOR
LEFT JOIN PCEMPR  emp  ON emp.MATRICULA   = ped.CODEMITENTE
WHERE ped.POSICAO IN (:status_liberado, :status_montado)
  AND ped.CODUSUR != 4
  AND NVL(ped.DTLIBERA, ped.DATA) >= SYSDATE - 30
  AND NOT EXISTS (SELECT 1 FROM PCNFSAID fat WHERE fat.NUMPED = ped.NUMPED)
ORDER BY NVL(ped.DTLIBERA, ped.DATA) ASC`;

const num = (v: unknown): number => Number(v) || 0;
const str = (v: unknown): string | null => (v == null ? null : String(v));

function toISODate(v: unknown): string {
  const d = v instanceof Date ? v : new Date(String(v));
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function mapRowToPedido(row: Record<string, unknown>): PedidoPendente {
  return {
    numeroPedido: num(row.NUMERO_PEDIDO),
    codigoCliente: num(row.CODIGO_CLIENTE),
    nomeCliente: String(row.NOME_CLIENTE ?? ""),
    cidadeCliente: str(row.CIDADE_CLIENTE),
    bairroCliente: str(row.BAIRRO_CLIENTE),
    ufCliente: str(row.UF_CLIENTE),
    codigoRca: num(row.CODIGO_RCA),
    nomeRca: String(row.NOME_RCA ?? ""),
    codigoSupervisor: row.CODIGO_SUPERVISOR == null ? null : num(row.CODIGO_SUPERVISOR),
    nomeSupervisor: str(row.NOME_SUPERVISOR),
    dataPedido: toISODate(row.DATA_PEDIDO),
    dataLiberacao: toISODate(row.DATA_LIBERACAO),
    statusWinthor: String(row.STATUS_WINTHOR ?? ""),
    valorPedido: num(row.VALOR_PEDIDO),
    pesoPedido: num(row.PESO_PEDIDO),
    horasParado: num(row.HORAS_PARADO),
    codigoEmitente: row.CODIGO_EMITENTE == null ? null : num(row.CODIGO_EMITENTE),
    nomeEmitente: str(row.NOME_EMITENTE),
    reentrega: row.REENTREGA === "S",
  };
}

/** Pedidos parados ao vivo. `null` = Winthor indisponível. */
export const getPedidosPendentes = cache(async (): Promise<PedidoPendente[] | null> => {
  try {
    const rows = await queryWinthor<Record<string, unknown>>(SQL, {
      status_liberado: "L",
      status_montado: "M",
    });
    return rows.map(mapRowToPedido);
  } catch (erro) {
    console.error("[pedidos-a-faturar] Winthor indisponível:", (erro as Error).message);
    return null;
  }
});
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npx vitest run src/data/pedidos-a-faturar.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/pedidos-a-faturar.ts src/data/pedidos-a-faturar.test.ts
git commit -m "feat(pedidos-a-faturar): query Oracle dos pedidos liberados/montados sem faturamento"
```

---

### Task 7: Página e view do relatório

**Files:**
- Create: `src/app/(app)/pedidos-a-faturar/page.tsx`
- Create: `src/app/(app)/pedidos-a-faturar/pedidos-a-faturar-view.tsx`

**Interfaces:**
- Consumes: `getPedidosPendentes` de `@/data/pedidos-a-faturar`; `getRotas` de `@/data/calendario-rotas`; `criarIndiceCalendario` de `@/domain/pedidos-a-faturar/calendario`; `montarRelatorio` de `@/domain/pedidos-a-faturar/montar-relatorio`; `Card`, `StatCard`, `SectionTitle`, `Pill`, `PageHeader` de `@/components/ui`; `formatBRL` de `@/domain/format`.
- Produces: rota `/pedidos-a-faturar`.

**Antes de codar:** ler `node_modules/next/dist/docs/` sobre Server Components + Suspense (Next 16 tem breaking changes).

- [ ] **Step 1: Criar a view (apresentação pura)**

```tsx
// src/app/(app)/pedidos-a-faturar/pedidos-a-faturar-view.tsx
import { Card, StatCard, SectionTitle, Pill } from "@/components/ui";
import { formatBRL } from "@/domain/format";
import type { Prioridade, Relatorio } from "@/domain/pedidos-a-faturar/tipos";

const TOM: Record<Prioridade, "red" | "gold" | "navy" | "slate"> = {
  CRITICA: "red",
  AJUSTAR_CALENDARIO: "gold",
  ALTA: "gold",
  MEDIA: "navy",
  BAIXA: "slate",
};

const ROTULO: Record<Prioridade, string> = {
  CRITICA: "Crítica",
  AJUSTAR_CALENDARIO: "Ajustar calendário",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

export function PedidosAFaturarView({ rel }: { rel: Relatorio }) {
  const { resumo, pedidos, rankingRca, rankingCidade, diagnostico } = rel;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Total parados" value={`${resumo.total}`} accent="navy" />
        <StatCard label="Críticos" value={`${resumo.criticos}`} accent="red" />
        <StatCard label="Alta" value={`${resumo.alta}`} accent="gold" />
        <StatCard label="Média" value={`${resumo.media}`} accent="navy" />
        <StatCard label="Baixa" value={`${resumo.baixa}`} accent="navy" />
        <StatCard label="Valor parado" value={formatBRL(resumo.valorTotal)} accent="navy" />
      </div>

      <Card className="p-6">
        <SectionTitle>Pedidos a faturar</SectionTitle>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Prioridade</th>
                <th className="py-2 pr-3">Pedido</th>
                <th className="py-2 pr-3">Cliente</th>
                <th className="py-2 pr-3">Cidade / Rota</th>
                <th className="py-2 pr-3">RCA</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3 text-right">Horas</th>
                <th className="py-2 pr-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map((p) => (
                <tr key={p.numeroPedido} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3"><Pill tone={TOM[p.prioridade]}>{ROTULO[p.prioridade]}</Pill></td>
                  <td className="py-2 pr-3 tabular-nums">
                    {p.numeroPedido}{p.reentrega && <span className="ml-1 text-xs text-amber-600">↩</span>}
                  </td>
                  <td className="py-2 pr-3">{p.nomeCliente}</td>
                  <td className="py-2 pr-3">{p.cidadeCliente ?? "—"}{p.rota ? ` · ${p.rota}` : ""}</td>
                  <td className="py-2 pr-3">{p.nomeRca}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(p.valorPedido)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{p.horasParado.toFixed(0)}h</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{p.motivoPrioridade}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>Ranking por RCA</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">RCA</th>
                <th className="py-2 pr-3 text-right">Pedidos</th>
                <th className="py-2 pr-3 text-right">Críticos</th>
                <th className="py-2 pr-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rankingRca.map((r) => (
                <tr key={r.codigoRca} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{r.nomeRca}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.totalPedidos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.criticos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(r.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card className="p-6">
          <SectionTitle>Ranking por cidade</SectionTitle>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Cidade</th>
                <th className="py-2 pr-3 text-right">Pedidos</th>
                <th className="py-2 pr-3 text-right">Críticos</th>
                <th className="py-2 pr-3 text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {rankingCidade.map((c) => (
                <tr key={c.cidade} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{c.cidade}{c.rota ? ` · ${c.rota}` : ""}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.totalPedidos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.criticos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(c.valorTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      {diagnostico.length > 0 && (
        <Card className="p-6">
          <SectionTitle>Cidades sem calendário</SectionTitle>
          <p className="mb-3 text-sm text-slate-500">
            Cidades presentes nos pedidos mas ausentes do calendário de rotas — cadastrar para melhorar a classificação.
          </p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="py-2 pr-3">Cidade (UF)</th>
                <th className="py-2 pr-3 text-right">Pedidos</th>
                <th className="py-2 pr-3 text-right">Valor</th>
                <th className="py-2 pr-3 text-right">Máx. horas</th>
                <th className="py-2 pr-3">Exemplos</th>
              </tr>
            </thead>
            <tbody>
              {diagnostico.map((d) => (
                <tr key={d.cidade} className="border-b border-slate-100">
                  <td className="py-2 pr-3">{d.cidade}{d.uf ? ` (${d.uf})` : ""}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{d.totalPedidos}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatBRL(d.valorTotal)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{d.maxHorasParado.toFixed(0)}h</td>
                  <td className="py-2 pr-3 text-xs text-slate-500">{d.exemplosNumped.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Criar a página (server component + Suspense)**

> Confirmar a assinatura de página do Next 16 em `node_modules/next/dist/docs/` antes de escrever. O padrão abaixo espelha as páginas já existentes do projeto (ver `src/app/(app)/tendencias/page.tsx`).

```tsx
// src/app/(app)/pedidos-a-faturar/page.tsx
import { Suspense } from "react";
import { PageHeader, Card } from "@/components/ui";
import { getPedidosPendentes } from "@/data/pedidos-a-faturar";
import { getRotas } from "@/data/calendario-rotas";
import { criarIndiceCalendario } from "@/domain/pedidos-a-faturar/calendario";
import { montarRelatorio } from "@/domain/pedidos-a-faturar/montar-relatorio";
import { PedidosAFaturarView } from "./pedidos-a-faturar-view";

export const dynamic = "force-dynamic"; // relatório ao vivo, nunca cacheado

async function Conteudo() {
  const [pedidos, rotas] = await Promise.all([getPedidosPendentes(), getRotas()]);

  if (pedidos === null) {
    return (
      <Card className="p-6">
        <p className="text-sm text-slate-500">
          Pedidos a Faturar indisponível — sem conexão com o Winthor. O banco só responde de
          dentro da rede da empresa.
        </p>
      </Card>
    );
  }

  const indice = criarIndiceCalendario(rotas);
  const rel = montarRelatorio(pedidos, indice, new Date());
  return <PedidosAFaturarView rel={rel} />;
}

function Skeleton() {
  return <div className="h-96 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />;
}

export default function PedidosAFaturarPage() {
  return (
    <div>
      <PageHeader title="Pedidos a Faturar" />
      <Suspense fallback={<Skeleton />}>
        <Conteudo />
      </Suspense>
    </div>
  );
}
```

- [ ] **Step 3: Verificar tipos e build**

Run: `npx tsc --noEmit`
Expected: sem erros. (Ajustar props de `PageHeader`/`StatCard`/`Pill` se a assinatura real divergir — conferir em `src/components/ui.tsx`.)

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/pedidos-a-faturar/page.tsx" "src/app/(app)/pedidos-a-faturar/pedidos-a-faturar-view.tsx"
git commit -m "feat(pedidos-a-faturar): página do relatório (resumo, tabela, rankings, diagnóstico)"
```

---

### Task 8: Item de menu na navegação

**Files:**
- Modify: `src/app/(app)/sidebar-nav.tsx` (array `items`)

**Interfaces:**
- Consumes: nada novo.
- Produces: link "Pedidos a Faturar" → `/pedidos-a-faturar` na sidebar e no topo.

- [ ] **Step 1: Adicionar o item ao array `items`**

Inserir logo após o item de `Devoluções` (antes de `Tendências`), em `src/app/(app)/sidebar-nav.tsx`:

```tsx
  {
    href: "/pedidos-a-faturar",
    label: "Pedidos a Faturar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
        <path d="M14 4v5h5" />
        <path d="M8 13h6M8 16h4" />
      </svg>
    ),
  },
```

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Verificação visual no preview**

Subir o dev server (preview_start com o nome do dev server do projeto), abrir `/pedidos-a-faturar`, conferir: item no menu ativo, cards de resumo, tabela e (se houver) diagnóstico. Checar console/network por erros. Tirar screenshot.
> Só funciona com dados reais **dentro da rede da empresa** (Oracle). Fora dela, esperado o card "Winthor indisponível".

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/sidebar-nav.tsx"
git commit -m "feat(pedidos-a-faturar): item Pedidos a Faturar no menu"
```

---

## Rodada final (após todas as tasks)

- [ ] Rodar a suíte inteira: `npx vitest run` → tudo verde.
- [ ] `npx tsc --noEmit` → sem erros.
- [ ] `npx eslint` → sem erros.
- [ ] **Ação manual no Supabase:** aplicar migration `0018` + seed (173 cidades).
- [ ] Validar dentro da rede da empresa: abrir `/pedidos-a-faturar` e conferir alguns pedidos contra o Winthor.
- [ ] Push e deploy (git pull + build + start no servidor).

## Notas de validação herdadas da origem (revisar com dados reais)

- `PCNFSAID.NUMPED` é vínculo suficiente de faturamento?
- `MUNICENT` (cidade do Winthor) vs. nomes do calendário — o diagnóstico expõe divergências.
- A regra de prioridade é a **atual**; será redefinida depois (isolada em `classificar.ts`).

# Filtro por período — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Toda tela que hoje filtra por mês passa a aceitar também um período livre (`?de=&ate=`) escolhido por atalho ou calendário, com comparação vs período anterior e vs ano passado.

**Architecture:** O período vira um valor de domínio (`Periodo {de, ate}`) em `src/domain/periodo.ts`, com toda a aritmética (atalhos, anterior, ano passado, deslocar, rótulo, eixo) testada ali. Cada página lê o período com `lerPeriodo(searchParams, piso)`; `?mes=` continua valendo e vira um período de mês inteiro. Leitores de dados que já trabalham com `ini/fim` recebem o período direto; os que trabalham "por mês" (custos, foto do efetivo) somam os meses que o período toca.

**Tech Stack:** Next 16.2 (App Router, `searchParams: Promise<…>`), React server components, Vitest, Oracle via `queryWinthor`, Supabase.

**Spec:** `docs/superpowers/specs/2026-11-06-filtro-periodo-design.md`

## Global Constraints

- URL: `?de=AAAA-MM-DD&ate=AAAA-MM-DD`; `?mes=AAAA-MM` continua; `de/ate` vence `mes`; nada → mês atual.
- Período que é um mês inteiro é **serializado como `?mes=`** (mês atual = URL limpa) — links antigos e o ◀/▶ seguem iguais.
- `ate` preso a hoje; `de > ate` → invertido; data inválida → mês atual.
- Piso: telas só-Supabase (Receitas, Custos, Faltas, Tendências de efetivo/custos) = `INICIO_HISTORICO` (2026-07-01). Telas Winthor/Harpia/mistas = `PISO_WINTHOR` (constante nova, levantada no Oracle na Task 1).
- Indicador Supabase em período sem histórico → "sem dado" (null), nunca 0.
- Comparação sem base → `Variacao` com `c=null` ("—"), nunca "−100%".
- Cortes: sem comparação vs ano passado.
- Taxas recalculadas de numerador/denominador do período, nunca média de médias.
- Gráficos: período ≤ 62 dias → eixo diário; maior → mensal.
- Verde só para receita; navy + âmbar; nada de texto explicativo na tela do BI (vai em `title`/hover).
- Painel TV fica fora.
- Cache: só BIs e só Oracle; chave `de|ate`; TTL 5 min se o período inclui hoje, 60 min se fechado.
- Sem dependência nova de calendário (componente próprio).

## Review Focus

1. Período de um mês inteiro tem que produzir **exatamente** os números de `?mes=` — Task 1 testa `lerPeriodo({mes})` ≡ `periodoDoMes`; cada tela usa o mesmo leitor.
2. Período corrente (inclui hoje) comparado com o trecho equivalente — `periodoAnterior`/`periodoAnoPassado` truncam; testes na Task 1.
3. Virada de ano / bissexto (Q1 → Q4 do ano anterior; 29/02 → 28/02) — testes na Task 1.
4. Período abaixo do piso Supabase em tela mista: cards Supabase "sem dado" — `mesesComHistorico` na Task 1 + uso na Task 3.
5. Navegar entre telas mantém o período — `comPeriodo` testado na Task 2.

---

### Task 1: Domínio `Periodo`

**Files:**
- Modify: `src/domain/periodo.ts`
- Test: `src/domain/periodo.test.ts`

**Interfaces — Produces:**
```ts
export interface Periodo { de: string; ate: string }            // ISO, inclusivo
export type TipoPeriodo = "mes" | "trimestre" | "ano" | "livre";
export const PISO_WINTHOR: string;                              // levantado no Oracle
export function periodoDoMes(mesISO: string): Periodo;
export function tipoPeriodo(p: Periodo): TipoPeriodo;
export function mesDoPeriodo(p: Periodo): string | null;        // "yyyy-mm-01" se mês inteiro
export function lerPeriodo(sp: { mes?: string; de?: string; ate?: string }, opts?: { piso?: string; hoje?: Date }): Periodo;
export function paramsDoPeriodo(p: Periodo, hoje?: Date): Record<string, string>; // {} | {mes} | {de, ate}
export function diasNoPeriodo(p: Periodo): number;
export function mesesDoPeriodo(p: Periodo): string[];           // "yyyy-mm-01" tocados
export function eixoDoPeriodo(p: Periodo): "dia" | "mes";       // ≤62 dias = dia
export function periodoAnterior(p: Periodo, hoje?: Date): Periodo;
export function periodoAnoPassado(p: Periodo, hoje?: Date): Periodo;
export function deslocarPeriodo(p: Periodo, dir: -1 | 1): Periodo;
export function rotuloPeriodo(p: Periodo): string;              // "Novembro/2026" | "3º tri/2026" | "2026" | "01/08 – 15/09/2026"
export function rotuloCurto(p: Periodo): string;                // p/ "vs …"
export function incluiHoje(p: Periodo, hoje?: Date): boolean;
export function atalhosPeriodo(hoje?: Date): { chave: string; rotulo: string; periodo: Periodo }[];
export function mesesComHistorico(p: Periodo): boolean;         // p.ate >= INICIO_HISTORICO
```

- [ ] **Step 1:** Levantar `PISO_WINTHOR`: `npm run oracle -- "SELECT MIN(DTSAIDA) FROM PCNFSAID WHERE CODFILIAL IN ('1','11') AND DTSAIDA >= DATE '2020-01-01'"` e o mínimo de `HARPIAW2` usado pela separação; escolher o 1º dia do mês do maior dos mínimos confiáveis.
- [ ] **Step 2: Testes** (`describe("Periodo")`):
  - `lerPeriodo({mes:"2026-09"})` → `{de:"2026-09-01", ate:"2026-09-30"}`; `lerPeriodo({})` em 06/11/2026 → nov/2026 inteiro (mesmo critério de hoje — ate = fim do mês).
  - `lerPeriodo({de:"2026-09-30", ate:"2026-07-01"})` → invertido; `ate` futuro → hoje; `de` < piso → piso; `de:"lixo"` → mês atual.
  - `tipoPeriodo`: jul–set → "trimestre"; 2025 inteiro → "ano"; 01/08–15/09 → "livre".
  - `periodoAnterior`: Q3/2026 → Q2/2026; Q1/2026 → Q4/2025; 2025 → 2024; mês set → ago; livre 01/08–15/09 (46 dias) → 16/06–31/07.
  - Truncamento: Q4/2026 com hoje 06/11/2026 (37 dias decorridos) → anterior 01/07–06/08; ano passado 01/10/2025–06/11/2025.
  - `periodoAnoPassado({de:"2024-02-29",ate:"2024-02-29"})` → `2023-02-28`.
  - `deslocarPeriodo(Q3, 1)` → Q4; livre de 46 dias desloca 46.
  - `paramsDoPeriodo`: mês atual → `{}`; set/2026 → `{mes:"2026-09"}`; Q3 → `{de, ate}`.
  - `eixoDoPeriodo`: 62 dias → "dia", 63 → "mes".
  - `atalhosPeriodo(06/11/2026)` contém exatamente: Este mês, Mês passado, Este trimestre, Trimestre passado, Este ano, Ano passado, Últimos 12 meses (12m = 01/12/2025–06/11/2026).
- [ ] **Step 3:** `npx vitest run src/domain/periodo.test.ts` → FAIL.
- [ ] **Step 4:** Implementar. Regra de truncamento: se `incluiHoje(p)`, o comparado tem o mesmo nº de dias decorridos (`diasNoPeriodo({de:p.de, ate:hoje})`) a partir do seu `de`, sem passar do seu fim. Mês inteiro corrente **não** trunca (regressão zero com as telas de mês, que comparam o mês cheio).
- [ ] **Step 5:** Testes PASS; commit `Período: domínio (atalhos, anterior, ano passado, rótulos)`.

### Task 2: Seletor e navegação

**Files:**
- Create: `src/components/seletor-periodo.tsx` (client)
- Create: `src/components/seletor-periodo-calendario.tsx` (client, grade do mês)
- Create: `src/lib/url-periodo.ts` + `src/lib/url-periodo.test.ts`
- Modify: `src/components/mes-nav.tsx` (vira `PeriodoNav`, mantém export `MesNav` como wrapper)
- Modify: `src/app/(app)/sidebar-nav.tsx`, `src/app/(app)/mobile-nav.tsx` (preservar período)

**Interfaces — Produces:**
```ts
// url-periodo.ts
export function comPeriodo(href: string, sp: URLSearchParams | Record<string,string|undefined>): string; // preserva mes/de/ate p/ telas COM_PERIODO
export const COM_PERIODO: Set<string>; // "/", "/custos", "/receitas", "/devolucoes", "/cortes", "/faltas", "/fechamento", "/tendencias"
// componente
export function PeriodoNav(props: { periodo: Periodo; hrefFor: (params: Record<string,string>) => string; piso?: string }): JSX.Element;
```
- `PeriodoNav`: ◀ rótulo ▶ (◀/▶ = `deslocarPeriodo`; desabilita abaixo do piso / acima de hoje) + botão calendário que abre popover com atalhos + calendário de dois cliques; mobile = folha inferior. `hrefFor` recebe `paramsDoPeriodo(...)` mesclado pela tela.
- [ ] Testes `comPeriodo`: `/custos` + `{de,ate}` preserva ambos; `/setores` ignora; `/` + `{mes}` preserva mes.
- [ ] Implementar, `npm run lint`, commit.

### Task 3: Dashboard

**Files:** `src/app/(app)/page.tsx`, `faturamento-cards.tsx`, `frota-cards.tsx`, `src/data/faturamento-mensal.ts`, `src/data/receitas.ts`, `src/data/custos-mensais.ts`

**Interfaces — Produces:** `getResumoFaturamentoPeriodo(p: Periodo)` (mês inteiro → `getResumoFaturamentoDashboard`, senão `getResumoFaturamento(de, ate)`); `receitaTotalDoPeriodo(p)`; `custosDoPeriodo(p) → {fixos, variaveis} | null` (soma `serieCustosMensais` nos meses tocados).
- Cards: faturamento, custo bruto/líquido, faltas = do período; chips vs anterior e vs ano passado.
- Comparativos por setor/composição: soma dos meses tocados; "sem dado" quando mês sem foto.
- [ ] Verificar em `?mes=2026-10` que os números são idênticos ao `main`; Q3 = soma de jul+ago+set.

### Task 4: Devoluções, Cortes (+export), Fechamento
- Trocar `inicioFimDoMes(mes)` por `lerPeriodo`; `MesNav` → `PeriodoNav`; `getResumoFaturamentoDashboard(mes)` → `getResumoFaturamentoPeriodo(p)`.
- Cortes: anterior = `periodoAnterior`; sem ano passado; histórico por mês continua mensal.
- Fechamento: `?ini/fim` aceito como alias de `de/ate`; usa `PeriodoNav`.

### Task 5: Receitas (+export), Custos, Faltas
- Receitas: `listarReceitasDoPeriodo(p, filtros)`, diversas e diários por intervalo; gráfico diário/mensal por `eixoDoPeriodo`. Formulário de lançamento continua no mês (período ≠ mês → usa o mês de `ate`).
- Custos: lista os lançamentos dos meses tocados, agrupados por mês; "Abrir mês"/lançar só quando é um mês.
- Faltas: `faltasNoPeriodo(de, ate)`.

### Task 6: Tendências
- Período define a janela da série (`mesesDoPeriodo`); default = últimos 12 meses (comportamento atual).

### Task 7: BIs dos setores
- `setores/[id]/page.tsx`: `lerPeriodo` com `PISO_WINTHOR`; `hrefMes` → `PeriodoNav`.
- Loaders (`carregarBISeparacao`, `carregarBIAbastecimento`, `carregarBIMotoristas`, `ConteudoBIRecebimento`) recebem `Periodo`; leitores Harpia (`lerSeparacaoHarpia`, `lerIndividuaisHarpia`, `lerAbastecimentoHarpia`, `lerViagensMes`) recebem `{ini, fim}` do período; `fracaoDoMes` → fração do período decorrida; evolução mês a mês vai até o mês de `ate`.
- Chave/TTL de cache: `lembrar(\`x:${de}|${ate}\`, ttlDoPeriodo(p), …)`; `ttlDoPeriodo` em `cache-memoria.ts` (teste: inclui hoje → 5 min, fechado → 60 min).
- Um BI por commit: Separação, Abastecimento, Motoristas, Recebimento.

### Task 8: Verificação final
- `npm run lint && npm test && npx tsc --noEmit`.
- Rodar o app, abrir cada tela em `?mes=2026-10` e em Q3/2026; conferir faturamento Q3 contra a 111 (`getResumoFaturamento('2026-07-01','2026-09-30')`).

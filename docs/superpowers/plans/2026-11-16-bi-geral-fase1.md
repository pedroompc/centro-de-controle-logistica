# BI Geral — Fase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um BI só (`/bi`) com aba Geral (números da casa + resumo de cada setor, comparação opcional) e abas com o BI completo de Separação, Recebimento, Abastecimento e Motoristas.

**Architecture:** As abas de setor reusam os componentes e loaders que já existem em `setores/[id]` (mesmo código → mesmo número). O `BIShell` ganha slots opcionais (barra de abas e comparação). A aba Geral calcula os resumos com funções puras novas em `src/domain/bi-geral.ts`, alimentadas pelos mesmos loaders, um `Suspense` por bloco.

**Tech Stack:** Next.js (versão do projeto — ler `node_modules/next/dist/docs/` antes de mexer em rota/searchParams), React server components, Tailwind, vitest, Oracle (Winthor/Harpia) + Supabase.

**Spec:** `docs/superpowers/specs/2026-11-16-bi-geral-design.md`

## Global Constraints

- Indicadores da aba Geral (exatos): Geral = efetivo · faturamento líquido · custo logístico · custo ÷ faturamento; Separação = pedidos separados · peso separado · custo por caixa; Recebimento = peso descarregado · carros descarregados · receita de descarrego; Abastecimento = movimentações · reabastecimentos · rupturas; Motoristas = entregas · peso entregue · clientes atendidos · devolução · km por entrega.
- Nenhuma conta paralela: todo número sai do loader/função de domínio que o BI do setor já usa.
- Comparação `?cmp=` (`ant` | `ano` | `de_ate`), desligada por padrão; nesta fase só a aba Geral mostra variação.
- Sem base de comparação ou sem dado → texto "sem histórico" / "—", nunca 0.
- Verde só para receita; variação usa as cores que `ComparaPeriodos`/`compararPct` já usam. Sem textos explicativos na tela (hover/`title` se preciso).
- Cache só Oracle (o `lembrar` dos loaders); nunca cachear Supabase/RLS.
- Visões admin-only seguem admin-only. Rupturas: mostrar na aba Geral (pedido do Pedro); continua oculta (`OCULTAS`) dentro do BI do Abastecimento.
- BIs em `/setores/[id]?aba=bi` continuam funcionando idênticos.
- Commits na `main` (destino confirmado pelo Pedro); push só no fim, após verificação no navegador.

## Review Focus

1. Período anterior ao piso de um setor (ex.: Recebimento antes de jul/2026, Harpia antes de out/2025) → bloco/aba mostra "sem dado no período", os outros seguem normais.
2. Oracle/Harpia fora do ar → só o bloco afetado mostra "indisponível"; aba Geral não quebra inteira.
3. `cmp=ano` com custo (Supabase só desde jul/2026) → custo e custo÷fat. mostram "sem histórico", volumes Oracle mostram variação.
4. Período livre (`de`/`ate` cruzando meses) → números iguais aos da aba do setor no mesmo período.
5. Usuário não-admin → abas abrem sem as visões admin e sem erro.

---

### Task 1: Indicadores de Separação e Motoristas em módulo comum

Hoje `indicadores()` mora dentro de `bi-separacao.tsx` e `bi-motoristas.tsx` (componentes client) — o servidor não pode chamá-las. Mover sem mudar comportamento.

**Files:**
- Create: `src/app/(app)/setores/[id]/separacao-indicadores.ts` (sem `"use client"`)
- Create: `src/app/(app)/setores/[id]/motoristas-indicadores.ts`
- Modify: `src/app/(app)/setores/[id]/bi-separacao.tsx:49-` (remove `indicadores`, importa)
- Modify: `src/app/(app)/setores/[id]/bi-motoristas.tsx` (idem; `indicadores` + `anteriorDe` se usado só ali)

**Interfaces:**
- Produces: `indicadoresSeparacao(d: DadosBISeparacao, dia: string | null)` (mesmo retorno da `indicadores` atual: `{ tot, custo, unit, ... }`); `indicadoresMotoristas(d: DadosBIMotoristas, dia: string | null)` (mesmo retorno: `{ vs, tot, h, fracaoCusto, ... }`).

- [ ] **Step 1:** Mover as funções (e helpers privados que só elas usam) para os módulos novos, renomeando; nos `.tsx`, importar e trocar as chamadas.
- [ ] **Step 2:** `npx tsc --noEmit -p . && npx eslint "src/app/(app)/setores/[id]" && npm test` → sem erro.
- [ ] **Step 3:** Commit `BI: indicadores de Separação e Motoristas em módulo comum (sem mudança de tela)`.

### Task 2: Resumos da aba Geral (domínio puro)

**Files:**
- Create: `src/domain/bi-geral.ts`
- Test: `src/domain/bi-geral.test.ts`

**Interfaces:**
- Consumes: Task 1; `resumir` (`@/domain/bi-recebimento`), `resumoVolume`/`premiacaoA424` (os mesmos que `bi-abastecimento/principal.tsx` usa), `resumoDevolucao`, `mapaKmDia`, `resumoKm`, `compararPct`.
- Produces:
  ```ts
  export interface IndicadorGeral { chave: string; rotulo: string; valor: number | null; formato: "int" | "kg" | "brl" | "pct" | "brlPorCx" | "km"; maiorEhBom: boolean }
  export interface ResumoSetorGeral { setor: "separacao" | "recebimento" | "abastecimento" | "motoristas"; indicadores: IndicadorGeral[]; erro: string | null }
  export function resumoSeparacao(d: DadosBISeparacao): ResumoSetorGeral          // pedidos, kg, custoPorCaixa
  export function resumoRecebimento(d: DadosBI): ResumoSetorGeral                  // pesoKg, carros, receita (ref ?? serie[mes]; com fatos usa resumir(fatos))
  export function resumoAbastecimento(d: DadosBIAbastecimento): ResumoSetorGeral   // prem.total, resumo.abastecimentos, rupturas.length
  export function resumoMotoristas(d: DadosBIMotoristas, clientesAtendidos: number | null): ResumoSetorGeral // entregas, kg, clientes, taxa devolução, kmPorEntrega
  export function variacao(atual: IndicadorGeral, base: IndicadorGeral | undefined): Comparacao | null // null quando base ausente/null
  ```
  Ordem e `chave` dos indicadores = ordem da Global Constraints. `erro` preenchido quando o loader devolveu `{ erro }` (Harpia/Winthor) — aí `valor: null` nos indicadores daquela fonte.

- [ ] **Step 1: Testes que falham** — fixtures mínimas (objetos com só os campos lidos, `as unknown as Tipo`):
  - `resumoSeparacao`: 2 linhas de produção somando `pedidos: 30, kg: 1200, caixas: 400`, `ref.custo: 4000`, `fracaoMes: 1` → valores `[30, 1200, 10]`.
  - `resumoSeparacao` com `producao: { erro: "ORA-1" }` → `erro: "ORA-1"`, todos `valor: null`.
  - `resumoAbastecimento` com `harpia: { erro: "x" }` → `erro: "x"`, valores null; com dados e `rupturas` de 3 itens → rupturas = 3.
  - `resumoMotoristas`: viagens `entregas 5+7, kg 100+50`, devolução `expedidas 20, devolvidas 1`, `hodometro: null` → `[12, 150, clientes, 0.05, null]`.
  - `variacao`: atual 110 vs base 100 (`maiorEhBom`) → `compararPct(110, 100, true)`; base `valor: null` → `null`.
- [ ] **Step 2:** `npx vitest run src/domain/bi-geral.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar repetindo exatamente as contas das telas: Separação = `indicadoresSeparacao(d, null)` (`tot.pedidos`, `tot.kg`, `unit.porCaixa`); Abastecimento = as linhas 29-33 de `bi-abastecimento/principal.tsx`; Motoristas = `indicadoresMotoristas(d, null)` + `resumoDevolucao(d.devolucao)` + `resumoKm(vs, mapaKmDia(d.hodometro), null).kmPorEntrega`; Recebimento = a mesma escolha `usar ? sel : r` de `bi-recebimento/menu.tsx` sem filtro.
- [ ] **Step 4:** Teste → PASS; `npm test` inteiro verde.
- [ ] **Step 5:** Commit `BI Geral: resumos dos setores (domínio)`.

### Task 3: Números da casa (efetivo, faturamento, custo logístico)

**Files:**
- Create: `src/data/resumo-casa.ts`
- Modify: `src/app/(app)/page.tsx:99-147` (Início passa a usar a mesma função para `custoTotalMes`)

**Interfaces:**
- Produces:
  ```ts
  export interface ResumoCasa { efetivo: number | null; faturamentoLiquido: number | null; clientesAtendidos: number | null; custoLogistico: number | null; custoSobreFat: number | null }
  export async function carregarResumoCasa(periodo: Periodo): Promise<ResumoCasa>
  ```
  - custo = exatamente a regra do Início (`!temHistoricoSupabase → null`; mês único → `totalDoMes(lancamentos, folha dos ativos)`; período → `custoBrutoDoPeriodo`). Extrair essa parte do `page.tsx` para cá e fazer o Início chamar.
  - faturamento/clientes = `getResumoFaturamentoPeriodo(de, ate)` → `vendaLiquida`, `atendimentos` (falha → null).
  - efetivo = ativos hoje para o mês corrente; mês fechado = `ativos` da foto do mês (`serieEfetivoSetorMensal` + `totaisEfetivoPorMes`), sem foto → null.
  - `custoSobreFat` = `percentualCustoLogistico(custo, venda)` (o mesmo do card do Início).
- [ ] **Step 1:** Extrair e implementar; Início usa `carregarResumoCasa` para o custo total.
- [ ] **Step 2:** `npx tsc --noEmit -p . && npm test` → verde.
- [ ] **Step 3:** No navegador (`npm run dev`), Início do mês atual e de outubro: "Custo total" igual ao de antes da mudança (anotar os valores antes de começar a task).
- [ ] **Step 4:** Commit `Início/BI Geral: custo logístico do período numa função só`.

### Task 4: Conteúdos dos BIs compartilhados + slots no BIShell

**Files:**
- Create: `src/app/(app)/setores/[id]/conteudos-bi.tsx` (os quatro `Conteudo*` de `page.tsx:310-339`)
- Modify: `src/app/(app)/setores/[id]/page.tsx` (importa de lá)
- Modify: `src/app/(app)/setores/[id]/bi-shell.tsx` (props opcionais)
- Modify: `bi-separacao.tsx`, `bi-abastecimento/principal.tsx`, `bi-motoristas.tsx`, `bi-aba.tsx` (repassam as props ao `BIShell`)

**Interfaces:**
- Produces:
  ```ts
  // BIShell e os quatro BIs: novas props opcionais
  abas?: ReactNode      // barra de abas, renderizada logo abaixo do título, acima do `menu`
  topoDireita?: ReactNode // ex.: seletor de comparação, antes dos botões Tela cheia/Sair
  // conteudos-bi.tsx
  export async function ConteudoBISeparacao(p: { setor: Setor; funcionarios: Funcionario[]; periodo: Periodo; hrefMes: HrefMes; hrefSair: string; abas?: ReactNode }): Promise<JSX.Element>
  // idem ConteudoBIAbastecimento, ConteudoBIMotoristas; ConteudoBIRecebimento(p: { periodo; hrefMes; hrefSair; abas? })
  ```
- [ ] **Step 1:** Mover, parametrizar `hrefSair` (setores passa `/setores/${id}`), adicionar as props.
- [ ] **Step 2:** `npx tsc --noEmit -p . && npx eslint "src/app/(app)/setores" && npm test` → verde.
- [ ] **Step 3:** Navegador: os quatro BIs em `/setores/[id]?aba=bi` idênticos (sem abas, Sair volta ao setor).
- [ ] **Step 4:** Commit `BIs de setor: conteúdo compartilhado e slots de abas no BIShell`.

### Task 5: Rota `/bi` com abas de setor

**Files:**
- Create: `src/app/(app)/bi/page.tsx`
- Create: `src/app/(app)/bi/abas-bi.tsx` (barra de abas, estilo escuro do BIShell)
- Create: `src/domain/bi-geral-rotas.ts` + `src/domain/bi-geral-rotas.test.ts`
- Modify: `src/app/(app)/sidebar-nav.tsx` (item "BI Geral", `href: "/bi"`, logo após Início)

**Interfaces:**
- Produces:
  ```ts
  export const ABAS_BI = ["geral", "separacao", "recebimento", "abastecimento", "motoristas"] as const
  export type AbaBI = (typeof ABAS_BI)[number]
  export function lerAba(v: string | undefined): AbaBI                 // inválido/ausente → "geral"
  export function pisoDaAba(a: AbaBI): string                          // recebimento → INICIO_HISTORICO; geral → INICIO_HISTORICO; demais → PISO_HARPIA
  export function hrefBI(aba: AbaBI, q: Record<string, string>): string // "/bi?aba=…&…"; aba geral sem `aba=`; preserva mes/de/ate/cmp passados em q
  ```
- [ ] **Step 1: Testes** — `lerAba("xyz") === "geral"`; `lerAba("motoristas") === "motoristas"`; `hrefBI("separacao", { mes: "2026-10-01", cmp: "ano" })` contém `aba=separacao`, `mes=2026-10-01`, `cmp=ano`; `hrefBI("geral", {})` === `"/bi"`.
- [ ] **Step 2:** Rodar → FAIL; implementar; rodar → PASS.
- [ ] **Step 3:** `page.tsx`: lê `aba`, período com `lerPeriodo(sp, { piso: pisoDaAba(aba) })`, `cmp` com `lerComparacao`; monta `hrefMes` igual a `setores/[id]/page.tsx:120-135` mas com `hrefBI`; acha cada setor via `listarSetores()` + `ehSetorSeparacao/…`; abas de setor renderizam o `Conteudo*` da Task 4 com `hrefSair="/"` e `abas={<AbasBI ativa período cmp/>}` dentro de `Suspense key={aba|de|ate} fallback={<EsqueletoBI/>}`. Setor não cadastrado → aba mostra "setor não cadastrado". Trocar de aba preserva `mes/de/ate/cmp`.
- [ ] **Step 4:** Navegador: `/bi?aba=separacao` (e as outras três) mostra o BI completo com a barra de abas; ‹ › e o seletor mudam o período mantendo a aba; trocar de aba mantém o período.
- [ ] **Step 5:** Commit `BI Geral: rota /bi com as abas dos setores`.

### Task 6: Aba Geral

**Files:**
- Create: `src/app/(app)/bi/geral.tsx` (server: blocos com `Suspense` próprio)
- Create: `src/app/(app)/bi/quadro-geral.tsx` (card de bloco, visual do `Quadro` do BIShell; o bloco de setor é um `Link` para a aba)

**Interfaces:**
- Consumes: Tasks 2, 3, 5 (`carregarResumoCasa`, `resumo*`, `variacao`, `hrefBI`, `SeletorComparacao`).
- Produces: `export async function AbaGeral(p: { periodo: Periodo; cmp: PeriodoComparado | null; setores: Setor[]; funcionarios: Funcionario[] }): Promise<JSX.Element>`
- [ ] **Step 1:** Bloco Geral (4 números de `ResumoCasa`) + 4 blocos de setor; cada bloco carrega o período e, se `cmp`, o período de comparação em paralelo; mostra `variacao` por indicador (`ComparaPeriodos` com referência `vs ${rotuloCurto(cmp.periodo)}`), "sem histórico" quando `variacao` é null com `cmp` ligado.
- [ ] **Step 2:** `SeletorComparacao` no `topoDireita` do BIShell da aba Geral (piso = `pisoDaAba("geral")`).
- [ ] **Step 3:** `npx tsc --noEmit -p . && npx eslint src && npm test` → verde.
- [ ] **Step 4:** Navegador, conferir contra as abas de setor e o Início no mesmo período: cada número da Geral igual ao da tela de origem (mês atual e outubro/2026). Testar os 5 itens da Review Focus (período antes do piso, `cmp=ano`, período livre, não-admin; para Oracle fora, simular com `DB_HOST` inválido no dev).
- [ ] **Step 5:** Layout em 1366×768, 1920×1080 e 390px (celular): sem rolagem lateral, abas quebram/rolam.
- [ ] **Step 6:** Commit `BI Geral: aba Geral com os números da casa e de cada setor` e `git push origin main`.

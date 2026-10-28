# Plataforma fluida e viva — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fazer a plataforma responder na hora do clique, abrir os BIs rápido e ganhar movimento discreto ("viva"), sem mudar nenhum número.

**Architecture:** Pool de conexões no único ponto que fala com o Oracle (`queryWinthor`); cache em memória do processo (TTL) só nas leituras chamadas pelos BIs dos setores; retorno visual imediato via barra de navegação global + `loading.tsx` + `<Suspense>` com `key` nas abas/meses do BI; movimento em CSS puro + dois componentes client pequenos (`NumeroAnimado`, `ValorVivo`).

**Tech Stack:** Next.js 16.2 (App Router, sem `cacheComponents`), React 19, Tailwind 4, `oracledb` 7 (thin), Vitest + jsdom.

**Spec:** `docs/superpowers/specs/2026-10-27-plataforma-fluida-e-viva-design.md`

## Global Constraints

- Navy + âmbar; **verde só para receita**. Brilho/pulso/barra de progresso usam âmbar (`amber-500` / `#f59e0b`).
- BI com tela limpa: nenhum texto explicativo novo na tela.
- **Nenhum número muda**: só como/quando aparece. `npm test` e `npm run lint` passam ao fim de cada task.
- Sem nova dependência (nada de lib de animação/gráfico/cache).
- Movimento < 1 s e uma vez só; nada em loop exceto o ponto "AO VIVO" do Painel TV e o brilho do esqueleto.
- `prefers-reduced-motion: reduce` → tudo estático (número final direto, sem cascata, sem pulso).
- Dashboard (`/`) e Painel TV: **sem cache** — sempre ao vivo. Dashboard **não** ganha refresh automático; só selo "atualizado às HH:MM".
- Cache dos BIs: **5 min** para o mês corrente, **60 min** para mês fechado. Nada dependente de usuário (`isAdmin`, cookies) dentro da função cacheada.
- Next 16 difere do que você conhece: ler `node_modules/next/dist/docs/` antes de usar `loading`, `Suspense`, `useLinkStatus`.
- Commits direto na `main` (confirmado pelo Pedro). Push só no fim, quando ele pedir.

## Review Focus

1. **Pool morto (NJS-521 / rede caiu):** a próxima consulta deve recriar o pool e funcionar, não ficar falhando para sempre → teste em Task 1.
2. **Erro do Oracle não pode ficar no cache:** uma falha num BI não pode "grudar" por 5 min → teste em Task 2.
3. **Duas abas abrindo o mesmo BI ao mesmo tempo:** devem disparar uma consulta só, não duas → teste em Task 2.
4. **Clique com Ctrl/Cmd, botão do meio, `target=_blank`, link externo, `#âncora` ou para a mesma URL:** a barra de progresso não pode começar (ficaria presa) → teste em Task 4.
5. **Valores com R$, %, "t", negativo e sem número ("—"):** a contagem animada deve terminar exatamente no texto original, e texto sem número aparece direto → teste em Task 6.

---

### Task 1: Pool de conexões Oracle

**Files:**
- Modify: `src/lib/oracle/client.ts`
- Test: `src/lib/oracle/client.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `queryWinthor<T>(sql, binds?)` com a **mesma assinatura** de hoje (nenhum chamador muda).

- [ ] **Step 1: Escrever os testes falhando** (`vi.mock("oracledb")` com `createPool` devolvendo um pool falso cujo `getConnection()` devolve `{ execute, close }`)
  - `reaproveita o pool entre consultas`: duas chamadas a `queryWinthor` → `createPool` chamado 1 vez, `getConnection` 2 vezes, `close` 2 vezes.
  - `devolve result.rows ou []`: `execute` → `{ rows: undefined }` ⇒ `[]`.
  - `recria o pool quando ele morre`: 1ª `getConnection` rejeita com `Error("NJS-521")` ⇒ `queryWinthor` rejeita; a chamada seguinte chama `createPool` de novo e resolve.
  - `fecha a conexão mesmo se execute falhar`: `execute` rejeita ⇒ `close` chamado.
- [ ] **Step 2:** `npx vitest run src/lib/oracle/client.test.ts` → FAIL.
- [ ] **Step 3: Implementar** em `client.ts`: pool guardado em `globalThis.__poolWinthor` (sobrevive ao HMR), criado sob demanda com as mesmas credenciais `DB_*`, `poolMin: 2`, `poolMax: 10`, `poolIncrement: 1`, `queueTimeout: 60000`. Guardar a **promise** de criação (duas consultas simultâneas não criam dois pools). Em erro de `getConnection`, `pool.close(0)` (ignorando erro) e zera a referência; relança o erro. `connection.close()` devolve ao pool. Atualizar o comentário do topo (não é mais "abre e fecha").
- [ ] **Step 4:** teste do Step 2 → PASS; `npm test` → PASS.
- [ ] **Step 5: Medir** com `npm run dev` e abrir o BI da Separação duas vezes: anotar no commit o tempo antes/depois (aba Network, documento).
- [ ] **Step 6: Commit** `Oracle: pool de conexões reaproveitadas no queryWinthor`.

### Task 2: Cache em memória com TTL

**Files:**
- Create: `src/lib/cache-memoria.ts`
- Test: `src/lib/cache-memoria.test.ts`

**Interfaces:**
- Produces:
  - `lembrar<T>(chave: string, ttlMs: number, f: () => Promise<T>): Promise<T>`
  - `ttlDoMes(mes: string, agora?: Date): number` — `5 * 60_000` se `mes >= primeiroDiaDoMes(agora)`, senão `60 * 60_000`.
  - `limparCache(): void` (para testes).

- [ ] **Step 1: Testes falhando** (`vi.useFakeTimers()`):
  - `devolve o valor guardado dentro do TTL`: 2 chamadas com mesma chave em t=0 e t=4min59s ⇒ `f` chamada 1×.
  - `busca de novo depois do TTL`: t=5min01s ⇒ `f` chamada 2×.
  - `não guarda erro`: `f` rejeita na 1ª, resolve na 2ª ⇒ 1ª rejeita, 2ª resolve.
  - `junta chamadas simultâneas`: duas chamadas antes da promise resolver ⇒ `f` 1×, ambas recebem o mesmo valor.
  - `ttlDoMes`: com `agora = new Date(2026, 9, 28)`: `"2026-10-01"` ⇒ `300000`; `"2026-09-01"` ⇒ `3600000`.
- [ ] **Step 2:** `npx vitest run src/lib/cache-memoria.test.ts` → FAIL.
- [ ] **Step 3: Implementar** com um `Map` em `globalThis.__cacheMemoria` guardando `{ expira, promessa }`; em rejeição, remove a entrada. `ttlDoMes` usa `primeiroDiaDoMes` de `@/domain/periodo`.
- [ ] **Step 4:** testes → PASS.
- [ ] **Step 5: Commit** `Cache em memória com TTL para leituras pesadas`.

### Task 3: Cache nos BIs dos setores

**Files:**
- Modify: `src/app/(app)/setores/[id]/separacao-dados.ts:114-124`
- Modify: `src/app/(app)/setores/[id]/abastecimento-dados.ts:33-55`
- Modify: `src/app/(app)/setores/[id]/page.tsx` (bloco `aba === "bi"` do Recebimento e `carregarAnaliseRecebimento`)
- Modify: `src/app/(app)/setores/[id]/recebimento-dados.ts:20-23`

**Interfaces:**
- Consumes: `lembrar`, `ttlDoMes` (Task 2).

- [ ] **Step 1: Envolver na chamada (não na definição)** cada leitura Oracle/Harpia dos BIs com `lembrar("<nome-da-função>:<mes>", ttlDoMes(mes), () => ...)`:
  - Separação: `lerSeparacaoHarpia(mes)`, `lerMesesSeparacaoHarpia(INICIO_HISTORICO, mes)`, `getResumoFaturamentoDashboard(mes)`, `lerIndividuaisHarpia(mes)`, `lerProducaoIndividualMes(mesAnt)` (chave com `mesAnt`, TTL de `mesAnt`).
  - Abastecimento: `lerAbastecimentoHarpia(mes)` (dentro de `harpiaDoMes`), `getResumoFaturamentoDashboard(mes)`.
  - Recebimento (aba BI): `carregarRecebimento()` e `carregarFatosDescarrego(mes)`; em `carregarAnaliseRecebimento`: `carregarRecebimento()` (chave `carregarRecebimento:<mês atual>`, TTL 5 min).
  - **Não** envolver nas definições: `getResumoFaturamentoDashboard` e `carregarRecebimento` também alimentam Dashboard e Painel TV, que ficam ao vivo.
  - `isAdmin()` continua fora; as leituras individuais seguem só rodando quando `admin` (o dado em si não depende do usuário).
- [ ] **Step 2:** `npm test` e `npm run lint` → PASS.
- [ ] **Step 3: Verificar** em `npm run dev`: abrir BI da Separação, trocar para o mês anterior e voltar — a volta deve abrir em < 1 s. Abrir o Dashboard e confirmar no log do servidor que a consulta de faturamento roda a cada recarga.
- [ ] **Step 4: Commit** `BIs dos setores: cache de 5 min (mês corrente) e 60 min (mês fechado)`.

### Task 4: Retorno imediato ao clique

**Files:**
- Create: `src/components/barra-navegacao.tsx` (client) e `src/components/barra-navegacao.test.ts`
- Create: `src/app/(app)/loading.tsx`
- Create: `src/app/(app)/setores/[id]/loading.tsx`
- Create: `src/app/(app)/setores/[id]/esqueleto-bi.tsx`
- Modify: `src/app/(app)/layout.tsx` (montar `<BarraNavegacao />`)
- Modify: `src/app/(app)/setores/[id]/page.tsx` (Suspense com `key`)
- Modify: `src/app/globals.css` (keyframes da barra e do esqueleto)

**Interfaces:**
- Produces: `deveIniciarBarra(ev: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean }, a: { href: string; target: string; hasAttribute(n: string): boolean }, atual: string): boolean` (exportada, pura); `<BarraNavegacao />`; `<EsqueletoBI />`.

- [ ] **Step 1: Testes falhando de `deveIniciarBarra`** (`atual = "https://x/setores/1"`):
  - `true` para clique esquerdo simples em `/setores/1?aba=bi`.
  - `false` para: `metaKey`, `ctrlKey`, `shiftKey`, `button: 1`, `target: "_blank"`, atributo `download`, origem diferente (`https://google.com`), mesmo pathname+search com só `#hash`, mesma URL exata, `defaultPrevented`.
- [ ] **Step 2:** `npx vitest run src/components/barra-navegacao.test.ts` → FAIL.
- [ ] **Step 3: Implementar `BarraNavegacao`**: listener `click` em captura no `document` que acha o `<a>` mais próximo e, se `deveIniciarBarra`, liga a barra; desliga quando `usePathname()` + `useSearchParams()` mudarem e, por segurança, após 15 s. Barra fixa no topo, 3 px, âmbar, `z-50`, anima até ~80 % e completa ao terminar (mockup aprovado). Envolver em `<Suspense>` no layout (exigência do `useSearchParams`). Também dispara em `submit` de `<form>` que navega? **Não** — só links.
- [ ] **Step 4: `loading.tsx`**: `(app)/loading.tsx` genérico (cabeçalho + grade de 4 cards, mesmo padrão de `tendencias/loading.tsx`); `setores/[id]/loading.tsx` renderiza `<EsqueletoBI />` — faixa de quadros KPI + 2 blocos grandes com as mesmas alturas do BI real (`bi-shell.tsx`). Esqueleto usa a classe `.esqueleto` (gradiente que desliza, âmbar não: `slate-200`→`slate-100`).
- [ ] **Step 5: Suspense nas abas/meses** em `setores/[id]/page.tsx`: o `loading.tsx` não aparece quando só muda `?aba=`/`?mes=`. Mover cada ramo que carrega dado pesado (BI Separação, BI Abastecimento, BI/Desempenho/Projeções do Recebimento) para um componente async local e renderizá-lo em `<Suspense key={`${aba}|${mesBI}`} fallback={<EsqueletoBI />}>`. A resolução de `setor`/`funcionarios` continua no topo.
- [ ] **Step 6:** `npm test`, `npm run lint` → PASS. Em `npm run dev`: clicar em "BI" e em `‹ mês ›` mostra barra + esqueleto em < 100 ms.
- [ ] **Step 7: Commit** `Clique responde na hora: barra de navegação, esqueletos e Suspense nas abas do BI`.

### Task 5: Painel TV buscando em paralelo

**Files:**
- Modify: `src/app/(app)/painel/painel-view.tsx` (função `aquecer`, ~linhas 270-310)

- [ ] **Step 1:** Trocar a sequência de `await passo(...)` por uma lista de passos disparados juntos e aguardados com `Promise.all` (cada `passo` já captura o próprio erro e registra em `falhou`). Mantém: condição `admin`, a regra do `primeira.current` para o placar, `setFalhas` e `setRelogio` **depois** que todos terminarem.
- [ ] **Step 2:** `npm run lint` → PASS. Em `npm run dev`, abrir `/painel` e clicar em atualizar: Network mostra as server actions saindo juntas; nenhum bloco some; falha simulada (desligar rede) aparece na lista de falhas como hoje.
- [ ] **Step 3: Commit** `Painel TV: blocos buscados em paralelo`.

### Task 6: Fundação de movimento

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/components/movimento.tsx` (client) e `src/components/movimento.test.tsx`

**Interfaces:**
- Produces:
  - `interpolarTexto(texto: string, p: number): string` — pura.
  - `<NumeroAnimado texto={string} ms?={number /* 900 */} />` — conta de 0 até o número contido em `texto`, preservando prefixo/sufixo/casas decimais/separador pt-BR, ease-out cúbico, uma vez por mudança de `texto`.
  - Classes CSS: `.entrar` (fade + sobe 8 px, 450 ms, atraso `calc(var(--i, 0) * 110ms)`), `.crescer-y` / `.crescer-x` (scale de 0→1 a partir da base/esquerda, 700 ms), `.desenhar` (stroke-dashoffset → 0, 1.2 s), `.levantar` (hover: `translateY(-2px)` + sombra maior), `.esqueleto`, `.pulso-vivo`, `.brilho-ambar`.
  - Regra global: `button:not(:disabled):active, a.botao:active { transform: scale(.97) }`.
  - `@media (prefers-reduced-motion: reduce)`: todas as classes acima sem animação/transição.

- [ ] **Step 1: Testes falhando de `interpolarTexto`**:
  - `("R$ 1.234,56", 1)` ⇒ `"R$ 1.234,56"`; `("R$ 1.234,56", 0)` ⇒ `"R$ 0,00"`; `("R$ 1.234,56", 0.5)` ⇒ `"R$ 617,28"`.
  - `("312 t", 1)` ⇒ `"312 t"`; `("12,5%", 0.5)` ⇒ `"6,3%"` (mantém 1 casa).
  - `("-R$ 40,00", 1)` ⇒ `"-R$ 40,00"`; `("—", 0.3)` ⇒ `"—"`; `("1.284", 1)` ⇒ `"1.284"`.
  - `NumeroAnimado` com `matchMedia` de reduced-motion = true renderiza o texto final direto.
- [ ] **Step 2:** `npx vitest run src/components/movimento.test.tsx` → FAIL.
- [ ] **Step 3: Implementar** (`NumeroAnimado` com `requestAnimationFrame`; SSR renderiza o texto final, a animação começa no mount — sem hidratação divergente; `tabular-nums` para não pular largura).
- [ ] **Step 4:** testes → PASS; `npm run lint` → PASS.
- [ ] **Step 5: Commit** `Fundação de movimento: classes CSS e NumeroAnimado`.

### Task 7: Movimento nas telas

**Files:**
- Modify: `src/components/ui.tsx` (`StatCard`, `HeroStat`, `Card`, `BarList`, `SetorBarList`)
- Modify: `src/app/(app)/setores/[id]/bi-ui.tsx` (`Quadro`, `Mini`, `BarrasTV`, `BarraComposicao`)
- Modify: `src/app/(app)/tendencias/evolucao-chart.tsx`, `src/app/(app)/tendencias/widgets.tsx`
- Modify: `src/app/(app)/setores/[id]/bi.tsx` (gráficos SVG do BI do Recebimento)

**Interfaces:**
- Consumes: `NumeroAnimado`, classes `.entrar`, `.crescer-y`, `.crescer-x`, `.desenhar`, `.levantar` (Task 6).

- [ ] **Step 1:** Valores de `StatCard`, `HeroStat`, `Quadro`, `Mini` passam a renderizar `<NumeroAnimado texto={value} />`.
- [ ] **Step 2:** Cards (`StatCard`, `Card`, `Quadro`, `Mini`) ganham `.entrar` e `.levantar`; em grades, o índice entra como `style={{ "--i": i }}` onde o componente pai já faz `map` (não criar wrapper novo).
- [ ] **Step 3:** Barras (`BarList`, `SetorBarList`, `BarrasTV`, `BarraComposicao`) ganham `.crescer-x`/`.crescer-y` conforme a orientação; linhas SVG de `evolucao-chart.tsx`, `widgets.tsx` e `bi.tsx` ganham `.desenhar` (com `pathLength="1"` para o dasharray).
- [ ] **Step 4:** Tooltips: barras e pontos que ainda não têm `title`/tooltip passam a ter `<title>` com valor formatado (sem texto novo na tela).
- [ ] **Step 5: Verificar** em `npm run dev`: Dashboard, Tendências e os 3 BIs entram animados; trocar mês no BI reanima; "Reduzir movimento" ligado no macOS ⇒ tudo estático; largura de celular (390 px) sem scroll horizontal; `npm test` e `npm run lint` → PASS.
- [ ] **Step 6: Commit** `Movimento: números contando, cards em cascata, barras e linhas crescendo`.

### Task 8: Ao vivo no Painel TV e selo no Dashboard

**Files:**
- Modify: `src/components/movimento.tsx` (+ testes em `movimento.test.tsx`)
- Modify: `src/app/(app)/painel/painel-view.tsx`, `src/app/(app)/painel/secoes.tsx`
- Modify: `src/app/(app)/page.tsx`

**Interfaces:**
- Produces: `<ValorVivo valor={number | null} texto={string} formatarDelta={(d: number) => string} />` — mostra `texto`; quando `valor` muda entre renders (e o anterior não era `null`), aplica `.brilho-ambar` por 1,2 s e mostra o delta (`+3`, `−R$ 120,00`) ao lado por 1,8 s. Primeiro render: sem brilho.
  `<SeloVivo relogio={string} pulsando={boolean} />` — "AO VIVO · HH:MM" com `.pulso-vivo` quando `pulsando`; só "Atualizado às HH:MM" quando não.

- [ ] **Step 1: Testes falhando**: `ValorVivo` sem brilho no 1º render; após `rerender` com `valor` maior, tem a classe `brilho-ambar` e o texto `+3`; após `rerender` com o mesmo valor, sem delta; com `valor` anterior `null`, sem brilho.
- [ ] **Step 2:** `npx vitest run src/components/movimento.test.tsx` → FAIL.
- [ ] **Step 3: Implementar** e aplicar: no Painel TV, `SeloVivo pulsando` no cabeçalho (usa o `relogio` que já existe) e `ValorVivo` nos números dos cards de KPI do painel (`secoes.tsx`). No Dashboard (`page.tsx`), `SeloVivo pulsando={false}` com a hora do render no fuso `America/Recife`. Dashboard **não** ganha refresh automático.
- [ ] **Step 4:** testes → PASS; em `npm run dev`, no `/painel`, clicar em atualizar: só os números que mudaram brilham.
- [ ] **Step 5: Commit** `Painel TV ao vivo (pulso e brilho na mudança) e selo de atualização no Dashboard`.

### Task 9: Verificação final

- [ ] `npm test`, `npm run lint`, `npm run build` → PASS.
- [ ] Repetir a medição da Task 1 (BI da Separação, mesmo mês): tempo até o esqueleto e até a tela completa, 1ª abertura e reabertura. Registrar no resumo para o Pedro.
- [ ] Conferir 3 números de cada BI contra a versão anterior (mesmo mês): devem ser idênticos.
- [ ] Atualizar a memória `deploy-architecture`/criar nota sobre o cache dos BIs (TTL) para sessões futuras.

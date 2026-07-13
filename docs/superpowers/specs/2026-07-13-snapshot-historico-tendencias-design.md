# Snapshot histórico + aba Tendências — Design

**Data:** 2026-07-13
**Autor:** Pedro + Claude
**Status:** Aprovado (design) — pendente plano de implementação

## Problema

Faturamento e devolução são puxados **ao vivo do Winthor a cada acesso**. Para o mês
corrente isso faz o número flutuar durante o dia (novas devoluções entram); para meses
passados, cada carga bate no Oracle de novo e a rotina 111 pode reprecificar valores.
Não existe histórico persistido — logo, **não há como ver evolução mês a mês** nem
comparar de forma auditável.

## Objetivo

Congelar ("tirar foto") os números de fechamento de cada mês numa tabela do Supabase e
expor uma aba **Tendências** com a evolução mês a mês dos principais indicadores
logísticos. Mês fechado nunca mais muda; o gráfico lê as fotos, não o Winthor.

## Escopo (MVP)

Congelar **apenas os totais mensais derivados do Winthor** (faturamento + devolução).
Fora de escopo agora (YAGNI): custos/efetivo no snapshot, quebra por setor/motivo/rota
no histórico, ponto do mês corrente parcial no gráfico, seletor de período customizado,
botão manual de "refazer foto".

## Decisões de design (ratificadas no brainstorming)

1. **O que congelar:** só Winthor (faturamento + devolução) — os números voláteis.
2. **Gatilho:** *lazy backfill*. Ao pedir um mês **fechado** sem foto, calcula do Winthor
   uma vez, grava e devolve. Mês corrente = sempre ao vivo (nunca congela). Sem agendador.
3. **Granularidade:** só os **totais do mês** (sem quebra por setor). A devolução é tratada
   no histórico como indicador único de saúde da operação; a quebra por setor permanece na
   aba Devoluções do mês corrente (ao vivo).
4. **Onde exibir:** nova aba **Tendências** (`/tendencias`), item novo no menu.
5. **Indicadores plotados:** taxa de devolução %, venda líquida (R$), valor devolução (R$),
   NFs + peso devolvido.
6. **Congelado é congelado:** foto tirada não é recalculada (coerente com a regra de
   devolução — valor congelado, ver [[devolucao-regra]]).
7. **Gráficos:** SVG feitos à mão (mesmo estilo das barras da aba Devoluções). Zero
   dependência nova.

## Arquitetura

Três camadas, seguindo o padrão existente (`data/` puxa dados, `domain/` lógica pura,
`app/` renderiza):

### 1. Modelo de dados — `supabase/migrations/0005_faturamento_mensal.sql`

Tabela `faturamento_mensal`, uma linha por mês/filial (espelha `ResumoFaturamento`):

| coluna | tipo | nota |
|---|---|---|
| `mes` | `date` | 1º dia do mês (ex.: `2026-05-01`) |
| `filial` | `text` | default `'1'` |
| `venda_faturada` | `numeric` | |
| `venda_liquida` | `numeric` | |
| `valor_devolucao` | `numeric` | vinculada |
| `valor_devolucao_avulsa` | `numeric` | |
| `devolvidas` | `int` | NFs vinculadas |
| `devolvidas_avulsas` | `int` | |
| `peso_faturado` | `numeric` | kg |
| `peso_devolucao` | `numeric` | kg |
| `emitidas` | `int` | |
| `positivados` | `int` | |
| `criado_em` | `timestamptz` | default `now()` — quando a foto foi tirada |

- **PK:** `(mes, filial)`.
- **RLS:** `SELECT` e `INSERT` para `authenticated`; `UPDATE`/`DELETE` restritos a `admin`.
  O INSERT é liberado ao autenticado **de propósito**: o lazy backfill grava a foto no
  momento em que *qualquer* usuário (inclusive viewer) abre a aba. A foto é cache derivado
  gerado pelo sistema — não dado de usuário — e é idempotente por `(mes, filial)`, então
  liberar o INSERT é seguro e evita depender de service-role (que o projeto não tem
  configurada; hoje só existe a anon key + JWT do usuário, ver `src/lib/supabase/server.ts`).
- `taxa_devolucao` **não** é coluna — é derivada na leitura (`valor_devolucao /
  venda_faturada`), evitando dado redundante que pode divergir.

### 2. Serviço de snapshot — `src/data/faturamento-mensal.ts`

Reaproveita a query já validada de `src/data/faturamento.ts`.

- **Refactor:** extrair de `faturamento.ts` uma função `getResumoFaturamento(ini, fim,
  filial)` que aceita período arbitrário. `getResumoFaturamentoMesAtual()` passa a chamá-la
  com `(primeiroDiaDoMes(), hojeISO(), '1')`. Sem mudança de comportamento no mês corrente.
- `getFaturamentoMensal(mes: string)`:
  1. Lê a linha do Supabase (`mes`, `filial='1'`). Se existe → devolve (foto congelada).
  2. Se não existe **e o mês está fechado** (`mes` < primeiro dia do mês corrente) →
     chama `getResumoFaturamento(primeiroDia(mes), ultimoDia(mes), '1')`, faz
     `INSERT ... ON CONFLICT (mes, filial) DO NOTHING` e devolve. Se o Winthor estiver
     indisponível → devolve `null`, **não grava**.
  3. Se `mes` é o mês corrente → chama o cálculo ao vivo, **não grava**.
- `getSerieTendencias(qtdMeses = 12)`: gera a lista dos últimos `qtdMeses` meses fechados,
  chama `getFaturamentoMensal` para cada (backfill dos faltantes), devolve a série ordenada.
  Meses com Winthor offline entram como buraco (`null`), o gráfico os pula.
- O `INSERT ... ON CONFLICT DO NOTHING` por `(mes, filial)` garante idempotência e nunca
  reescreve uma foto já congelada (coerente com "congelado é congelado" e com a RLS
  insert-only do autenticado).

### 3. Domínio — `src/domain/tendencias.ts` (lógica pura, testável)

- `type PontoMensal = { mes: string; ... campos de ResumoFaturamento }`.
- `mesesFechados(hoje, qtd): string[]` — gera a lista de 1ºs-dias-de-mês (ex.: 12 meses
  anteriores ao corrente). Testável sem DB.
- `taxaDevolucaoMensal(ponto)` — reusa/alinha com `taxaDevolucao` de `domain/faturamento.ts`.
- Helpers de normalização da série para os gráficos (min/max, escala).

### 4. UI — `src/app/(app)/tendencias/page.tsx` (+ `loading.tsx`)

- Item novo no menu de navegação (onde os demais são registrados).
- 4 gráficos de linha SVG: **taxa de devolução %**, **venda líquida (R$)**, **valor
  devolução (R$)**, **NFs + peso devolvido**. Componente `<LineChart>` reutilizável em
  `src/components/` (ou no próprio arquivo se pequeno), no estilo visual das barras da aba
  Devoluções. Reusa `formatBRL` / `formatPercent`.
- Janela fixa de 12 meses (MVP).
- Estados: skeleton de loading; "sem dados / Winthor offline" quando a série vier vazia.

## Fluxo de dados

```
/tendencias (page, async)
  └─ getSerieTendencias(12)                    [data/faturamento-mensal.ts]
       ├─ mesesFechados(hoje, 12)              [domain/tendencias.ts]
       └─ para cada mês: getFaturamentoMensal(mes)
            ├─ SELECT faturamento_mensal        [Supabase] → hit? devolve
            └─ miss & mês fechado:
                 getResumoFaturamento(ini,fim)  [data/faturamento.ts → Winthor]
                 └─ UPSERT faturamento_mensal    [Supabase]
  → série → <LineChart> x4 (SVG)
```

## Tratamento de erro

- **Winthor offline num mês:** `getFaturamentoMensal` devolve `null`, não grava; a série
  mostra buraco naquele ponto. Nunca grava foto parcial/lixo.
- **Supabase indisponível:** a página cai no estado "sem dados" (como as demais telas
  fazem hoje com o Winthor).
- **Mês corrente:** nunca é gravado; se aparecer no gráfico no futuro, será marcado como
  parcial — fora de escopo do MVP (só meses fechados).

## Testes

- `domain/tendencias.test.ts` (vitest, puro): `mesesFechados` (bordas de ano, qtd),
  `taxaDevolucaoMensal`, normalização da série.
- Parte SQL/Supabase (`faturamento-mensal.ts`): validada rodando contra o banco, como foi
  feito na regra de devolução — comparar a foto gerada com o cálculo ao vivo do mesmo mês.

## Arquivos afetados

- **Novo:** `supabase/migrations/0005_faturamento_mensal.sql`
- **Novo:** `src/data/faturamento-mensal.ts`
- **Novo:** `src/domain/tendencias.ts` + `src/domain/tendencias.test.ts`
- **Novo:** `src/app/(app)/tendencias/page.tsx` + `loading.tsx`
- **Novo:** `src/components/line-chart.tsx` (ou inline)
- **Editar:** `src/data/faturamento.ts` (extrair `getResumoFaturamento(ini,fim,filial)`)
- **Editar:** navegação/menu (adicionar item "Tendências")

## Critérios de sucesso

1. Abrir `/tendencias` mostra 4 gráficos com os últimos meses fechados.
2. Primeira abertura popula o Supabase; segunda abertura lê do Supabase (sem bater no
   Winthor para meses já fotografados).
3. Um mês fotografado exibe sempre o mesmo valor (congelado), mesmo que o Winthor mude.
4. Winthor offline não quebra a tela nem grava dado inválido.

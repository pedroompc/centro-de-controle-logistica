# Snapshot de fechamento mensal (dados Supabase) — Design

**Data:** 2026-09-01
**Autor:** Pedro + Claude
**Status:** Implementado

## Problema

O dashboard (`/`) reagrega, a cada acesso, os totais do mês a partir de várias
tabelas do Supabase: `custos_mensais` (fixos + variáveis), receita de
descarregamento em **3 tabelas** (`receitas_descarregamento`,
`receitas_descarregamento_diario`, `receitas_diversas`) e `faltas`. Para **meses
antigos** isso fica lento — puxar dados antigos demora.

Diferente de `faturamento_mensal` (que congela números do **Winthor**, sistema
externo), aqui a fonte é o **próprio Supabase**. Isso muda tudo: como todo dado
entra por *server actions* nossas, sabemos exatamente quando um mês muda — não
precisamos do self-heal frágil do caso Winthor.

## Objetivo

Congelar numa tabela (`fechamento_mensal`) os totais mensais desses dados para
que abrir um mês fechado seja a leitura de **uma linha**, não a reagregação de
5 tabelas. E manter a foto **correta** mesmo com correção de mês anterior
(lançamento atrasado — a pessoa que lança demora 2 dias e o lançamento cai num
mês já fechado).

## Decisões de design

1. **O que congelar:** `custo_fixo`, `custo_variavel`, `receita_total` (soma das
   3 origens) e `faltas`. Uma linha por mês fechado.
2. **O que NÃO congelar:** `custo_efetivo` (salário do efetivo). É derivado do
   efetivo **atual** (funcionários ativos hoje), é lido ao vivo e é barato — o
   dashboard já carrega `funcionarios` para a quebra por setor. Congelá-lo criaria
   incoerência entre o total do topo (foto) e a quebra por setor (ao vivo), e
   mudaria a semântica atual ("efetivo é sempre o de agora"). Fica de fora de
   propósito.
3. **Gatilho:** *lazy backfill*. Ao abrir um mês **fechado** sem foto, recalcula
   das origens uma vez, grava e devolve. Mês corrente = sempre ao vivo, nunca grava.
4. **Correção de mês anterior → invalidação no ponto de escrita.** Toda server
   action que grava custo/receita/falta **apaga a foto do mês afetado**; o próximo
   acesso recalcula. É à prova de bala porque a invalidação está grudada na escrita
   (nada de divergência possível). Ver "Correção" abaixo.
5. **`faltas` conta por período direto:** a FK `faltas.funcionario_id` é
   `ON DELETE CASCADE`, então não há falta órfã — contar pelo intervalo de datas
   equivale a filtrar pelos funcionários (o que o dashboard fazia). Sem carregar
   `funcionarios` no cálculo da foto.

## Arquitetura

### 1. Migration — `supabase/migrations/0020_fechamento_mensal.sql`

Tabela `fechamento_mensal (mes date PK, custo_fixo, custo_variavel, receita_total,
faltas, criado_em)`. RLS: `SELECT/INSERT/UPDATE/DELETE` liberados ao
`authenticated`. Justificativa: é **cache derivado do sistema**, idempotente por
`mes` e reproduzível das origens — o backfill grava na leitura (qualquer usuário,
inclusive viewer, ao abrir um mês antigo) e a invalidação apaga na escrita. O dado
de **negócio** segue protegido: as tabelas de origem continuam admin-only e as
actions chamam `assertAdmin`.

### 2. Serviço — `src/data/fechamento-mensal.ts`

- `getFechamentoMensal(mes)` (memoizado por request):
  - mês **fechado**: lê a foto; se faltar, `computar()` uma vez e grava
    (`upsert onConflict mes`).
  - mês **corrente**: `computar()` ao vivo, **não grava**.
- `computar(mes)`: agrega das origens (`listarLancamentosDoMes`,
  `receitaTotalDoMes`, `contarFaltasDoMes`) — o caminho caro, agora só no miss.

### 3. Invalidação — `src/data/fechamento-cache.ts`

Módulo separado (sem importar o serviço nem as origens) para evitar ciclo de
imports. Expõe:
- `invalidarFechamentoDoMes(mes)` — apaga a foto; no-op se o mês for corrente/futuro.
- `invalidarFechamentoDoMesDe(data)` — idem, a partir de uma data `YYYY-MM-DD`.

Ligado em **todas** as actions de escrita:

| Módulo | Actions | Como acha o mês |
|---|---|---|
| `custos-mensais.ts` | adicionar / editar / remover / materializar | `mes` do registro; nos edit/remove, `SELECT mes` da linha |
| `receitas.ts` | criar / editar / remover | `data` do form; nos edit/remove, `SELECT data` (origem + destino) |
| `receitas-diario.ts` | criar / editar / remover | idem |
| `receitas-diversas.ts` | criar / editar / remover | idem |
| `faltas.ts` | registrar / excluir | `data` do form; no excluir, `SELECT data` |

Como só mês **fechado** tem foto, escrita no mês corrente (o caso frequente —
lançamento do dia) é no-op de invalidação; só a correção retroativa realmente
apaga uma foto.

### 4. Dashboard — `src/app/(app)/page.tsx`

Troca as leituras diretas (`listarFaltas`, `listarLancamentosDoMes`,
`receitaTotalDoMes`) por `getFechamentoMensal(mes)`. `funcionarios`/`setores`
seguem ao vivo (efetivo + quebra por setor). O total bruto continua
`efetivo + fixo + variavel` e o líquido `bruto - receita` — mesma conta de antes.

## Correção de mês anterior (o cenário do Pedro)

A menina lança um custo/descarrego/falta com **data retroativa** (2 dias depois),
caindo num mês já fechado:

1. Ela lança pela tela normal → server action grava no Supabase (como sempre).
2. A **mesma action apaga a foto** daquele mês (`invalidarFechamentoDoMesDe`).
3. No próximo acesso ao dashboard daquele mês, `getFechamentoMensal` não acha
   foto → recalcula das origens (já com a correção) → regrava.

Não precisa de botão "refazer foto", nem de admin, nem de flag — a data do
lançamento diz qual mês invalidar. Editar ou remover um lançamento antigo
funciona igual: a action busca a data da linha e invalida o mês (na edição, tanto
o mês de origem quanto o de destino, caso a data mude).

## Escopo / limitações conscientes

- **Só o dashboard `/`** adota a foto. A página `/custos` mostra a lista editável
  de lançamentos (precisa do dado ao vivo), então não usa a foto — é a tela de
  edição, não a de leitura agregada.
- **`custo_efetivo`/setores ao vivo:** um mês fechado ainda lê `funcionarios` e
  `setores` (tabelas pequenas, não são o gargalo de "dados antigos", que é o
  histórico transacional datado).
- **Alteração de salário** não refaz fotos de meses fechados (efetivo não está na
  foto). É coerente com a decisão 2: efetivo é sempre o atual.

## Critérios de sucesso

1. Abrir um mês fechado no dashboard lê 1 linha de `fechamento_mensal` (sem
   reagregar as 5 tabelas), após o primeiro acesso.
2. Lançar/editar/remover custo, descarrego ou falta com data de um mês fechado
   apaga a foto daquele mês; o acesso seguinte mostra o número corrigido.
3. Mês corrente nunca grava foto (muda ao longo do dia).
4. Números do dashboard idênticos aos de antes (efetivo + fixo + variável;
   líquido = bruto − receita; faltas do mês).

## Arquivos

- **Novo:** `supabase/migrations/0020_fechamento_mensal.sql`
- **Novo:** `src/data/fechamento-mensal.ts`
- **Novo:** `src/data/fechamento-cache.ts`
- **Editar:** `src/data/faltas.ts` (`contarFaltasDoMes` + invalidação)
- **Editar:** `src/data/custos-mensais.ts`, `receitas.ts`, `receitas-diario.ts`,
  `receitas-diversas.ts` (invalidação nas actions)
- **Editar:** `src/app/(app)/page.tsx` (usa `getFechamentoMensal`)

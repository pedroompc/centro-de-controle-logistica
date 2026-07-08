# Módulo de Custos — Design

**Data:** 2026-07-08
**Projeto:** Centro de Controle Logística
**Autor:** Pedro (Gerente de Logística) + Claude

## Contexto

Segundo módulo da plataforma (o primeiro é o **efetivo**, já concluído). Acompanha os
**custos da operação logística mês a mês**, começando em **julho/2026** para frente (sem
reconstruir o passado). Estende o mesmo app Next.js + Supabase existente.

## Objetivo

Dar ao gerente controle dos custos mensais: **custos fixos** (recorrentes), **custos
variáveis** (lançados por mês) e o **salário** (vindo automático do efetivo), com o **total
do mês** e histórico navegável entre meses.

## Stack

Mesma do efetivo: Next.js (App Router, TS) + Supabase (Postgres + Auth + RLS) + Tailwind.
Reusa o layout autenticado, os clients Supabase e os helpers de formatação existentes.

## Conceito central: fixos recorrentes com histórico preservado

- O usuário mantém uma **lista de custos fixos** (o "molde"): galpão, empilhadeira,
  paleteira, aluguel casa 1, aluguel casa 2, etc. — cada um com um valor.
- Ao **abrir um mês** pela primeira vez, o sistema **materializa** os fixos vigentes daquele
  mês como lançamentos daquele mês (copia do molde). Isso preserva o histórico: cada mês
  guarda o que valia nele.
- Editar o molde depois (novo valor, item novo, encerrar item) **vale dos próximos meses em
  diante** — meses já materializados não mudam.
- Dentro de um mês, cada lançamento (fixo ou variável) é **editável/removível**
  individualmente (para ajustes pontuais).
- **Exemplo (empilhadeira):** comprou outra empilhadeira → adiciona um item no molde de
  fixos (passa a valer nos próximos meses) e, se quiser refletir já no mês corrente,
  adiciona também um lançamento no mês atual.

## Modelo de dados

### `custos_fixos` (molde recorrente)
| campo | tipo | obs |
|---|---|---|
| id | uuid (PK) | |
| nome | text | ex: Galpão, Empilhadeira 1, Aluguel Casa 1 |
| valor | numeric(10,2) | valor mensal |
| ativo | boolean | default true; `false` = encerrado (deixa de materializar) |
| created_at | timestamptz | |

### `custos_mensais` (lançamentos realizados por mês)
| campo | tipo | obs |
|---|---|---|
| id | uuid (PK) | |
| mes | date | sempre o 1º dia do mês (ex: 2026-07-01) |
| nome | text | |
| tipo | enum `custo_tipo` | `fixo` / `variavel` |
| valor | numeric(10,2) | |
| created_at | timestamptz | |

Índice em `custos_mensais(mes)`. RLS igual ao efetivo (acesso total a `authenticated`).

### Salário (derivado, não armazenado)
`salarioEfetivo = SUM(funcionarios.custo_mensal) WHERE status = 'ativo'`. Calculado ao vivo
e somado ao total do mês. Decisão: para o mês corrente calcula na hora; snapshot de meses
passados fica **fora de escopo** por ora (o efetivo muda pouco e começamos agora).

### Total do mês (derivado)
`totalMes(M) = SUM(custos_mensais.valor WHERE mes = M) + salarioEfetivo`

## Materialização do mês (regra)

Disparada por uma ação explícita do usuário — o botão **"Abrir mês"** na tela de Custos —
e não automaticamente ao carregar a página:
- Se `M` **não tem nenhum lançamento `fixo`** ainda → materializa: para cada `custos_fixos`
  com `ativo = true`, insere um `custos_mensais(mes=M, nome, tipo='fixo', valor)`.
- Se já tem → não faz nada (idempotente; não sobrescreve ajustes do usuário).
- Variáveis nunca são materializados automaticamente — são sempre lançados à mão.

## Telas

1. **Custos** (`/custos`) — seletor de mês (◀ Julho/2026 ▶; começa no mês atual). Mostra:
   - **Total do mês** em destaque (fixos + variáveis + salário).
   - Bloco **Fixos** (lançamentos `fixo` do mês; editar valor / remover).
   - Bloco **Variáveis** (lançamentos `variavel` do mês; adicionar / editar / remover).
   - Bloco **Salário (do efetivo)** — valor calculado, somente leitura, com link pro efetivo.
2. **Custos fixos** (`/custos/fixos`) — gerenciar o molde recorrente: adicionar item,
   editar valor, encerrar (setar `ativo = false`). É aqui que entra a empilhadeira nova.
3. **Dashboard** — adicionar um card com o **custo total do mês corrente**
   (efetivo + fixos + variáveis).

Navegação: novo item **Custos** no menu do layout autenticado.

## Fora de escopo (por ora)

- Snapshot/congelamento do salário por mês (fica ao vivo).
- Módulo de rendimentos (próximo).
- Previsão/orçamento, comparativos gráficos, exportação.
- Categorias/subcategorias além de fixo/variável.
- Reconstruir meses anteriores a julho/2026.

## Nota de integração

O salário reusa o `custo_mensal` do módulo de efetivo — não recadastra. Hoje todos os ~247
funcionários estão com `custo_mensal = R$ 3.034,00` (salário mínimo 1.640 × 1,85), então o
salário do efetivo começa em ~R$ 749.398,00/mês e se ajusta sozinho conforme o efetivo muda.

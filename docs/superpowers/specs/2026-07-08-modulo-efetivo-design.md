# Módulo de Efetivo — Design

**Data:** 2026-07-08
**Projeto:** Centro de Controle Logística
**Autor:** Pedro (Gerente de Logística) + Claude

## Contexto

Plataforma web de gestão para uma distribuidora, com três grandes áreas planejadas:
**efetivo (funcionários)**, **custos** e **rendimentos**. Este documento cobre
apenas o **primeiro módulo: efetivo**, dividido por setor. Os módulos de custos e
rendimentos serão especificados separadamente no futuro (ver nota de integração ao final).

## Objetivo do módulo

Dar ao gerente controle total do efetivo: cadastrar funcionários organizados por
setor, registrar faltas, e visualizar métricas por setor (custo, headcount, faltas).

## Stack

- **Frontend:** Next.js (App Router) + React.
- **Backend / dados:** Supabase (Postgres + Auth + Row Level Security).
- **Hospedagem:** Vercel (plano gratuito). Desenvolvimento inicial roda local.

Justificativa: Supabase concentra banco e autenticação num só serviço com plano
gratuito, e o RLS será a base para as permissões por setor no futuro. Todos são
padrões de mercado e escalam para os próximos módulos.

## Acesso e permissões

- App multi-usuário com **login por e-mail/senha** (Supabase Auth).
- **Nesta fase:** todo usuário autenticado tem acesso total (sem níveis).
- Permissões granulares (ex: supervisor vê só o próprio setor, RH vê custos) ficam
  para uma fase posterior — o RLS já é escolhido pensando nisso.

## Modelo de dados

### `setores`
| campo | tipo | obs |
|---|---|---|
| id | uuid (PK) | |
| nome | text | ex: Expedição, Separação, Recebimento |
| created_at | timestamptz | |

Setores são **editáveis pela interface** (criar/editar/excluir).

### `funcionarios`
| campo | tipo | obs |
|---|---|---|
| id | uuid (PK) | |
| nome | text | |
| cargo | text | |
| setor_id | uuid (FK → setores) | |
| custo_mensal | numeric(10,2) | salário + encargos, **valor único** |
| data_admissao | date | |
| status | enum | `ativo` / `afastado` / `desligado` |
| created_at | timestamptz | |

Decisão: `custo_mensal` é **valor único** (salário + encargos já somados).
Quebrar em salário + encargos fica para depois, se necessário.

### `faltas`
| campo | tipo | obs |
|---|---|---|
| id | uuid (PK) | |
| funcionario_id | uuid (FK → funcionarios) | |
| data | date | |
| tipo | enum | `justificada` / `injustificada` / `atestado` / `folga` / `ferias` |
| observacao | text (nullable) | opcional |
| created_at | timestamptz | |

### Métricas derivadas (calculadas, não armazenadas)
- **Custo do setor** = `SUM(custo_mensal) WHERE setor_id = X AND status = 'ativo'`
- **Faltas do setor no mês** = `COUNT(faltas)` via join com funcionarios, filtrando por setor e período.
- **Headcount por status** por setor (ativo / afastado / desligado).

## Telas

1. **Login** — Supabase Auth (e-mail/senha).
2. **Dashboard** — visão geral: nº de funcionários ativos, custo total do efetivo,
   faltas no mês, e cards por setor.
3. **Setores** — lista dos setores (CRUD). Cada card: custo total, headcount por
   status, faltas no mês.
4. **Detalhe do Setor** — métricas do setor + lista de funcionários daquele setor.
5. **Funcionários** — lista geral com busca e filtro por setor e status; criar/editar.
6. **Detalhe do Funcionário** — todos os dados + histórico de faltas (adicionar/remover falta ali).

## Fora de escopo (por enquanto)

- Módulos de custos e rendimentos.
- Permissões granulares / níveis de acesso.
- Impacto de faltas no custo, metas e alertas de faltas.
- Contato do funcionário (telefone/e-mail).
- Quebra de custo em salário + encargos.

## Nota de integração futura

O `custo_mensal` dos funcionários é a fonte da despesa "salário" do futuro módulo de
custos (que terá custos fixos: galpão, empilhadeira, paleteira, aluguel de 2 casas; e
variáveis: filme stretch, salário, frete, gasolina). O módulo de custos deve **reusar**
esse dado, não recadastrá-lo.

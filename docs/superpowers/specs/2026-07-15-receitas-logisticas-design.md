# Receitas Logísticas — Design

**Data:** 2026-07-15
**Autor:** Pedro + Claude
**Status:** Aprovado

## Objetivo

Nova aba **Receitas Logísticas** para registrar valores recebidos pelos serviços de
descarregamento realizados para fornecedores, com cálculo automático da receita
(peso × preço/tonelada), indicadores, relatório exportável e integração ao resultado
logístico (custos brutos − receitas = custo líquido).

A receita **nunca** apaga, altera ou reduz os lançamentos de custo. O abatimento é
apenas **demonstrado** no resultado consolidado, com os valores antes e depois visíveis.

## Decisões (validadas com o Pedro)

1. **Preço por tonelada = global** por tipo (um preço para `batido`, outro para
   `paletizado`), valendo para todos os fornecedores.
2. **Fornecedor = lista gerenciável** (cadastro próprio + dropdown no lançamento),
   como `setores`.
3. **Resultado consolidado** aparece na **aba Custos** (bloco novo) + **Dashboard**.
4. **Período = por mês** (navegação ◀ ▶ `?mes=`), consistente com Custos/Tendências.
5. **Snapshot de preço**: cada lançamento congela `preco_por_tonelada` e `receita`;
   mudar a tabela de preços depois não altera o passado.

## Modelo de dados — `supabase/migrations/0006_receitas.sql`

```sql
create type descarregamento_tipo as enum ('batido', 'paletizado');

-- Cadastro de fornecedores (padrão de `setores`).
create table fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  ativo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Preço/tonelada GLOBAL por tipo. Exatamente 2 linhas (batido, paletizado).
create table precos_descarregamento (
  tipo descarregamento_tipo primary key,
  preco_por_tonelada numeric(14,2) not null default 0,
  atualizado_em timestamptz not null default now()
);
insert into precos_descarregamento (tipo, preco_por_tonelada)
  values ('batido', 0), ('paletizado', 0);

-- Lançamentos de receita de descarregamento.
create table receitas_descarregamento (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  fornecedor_id uuid not null references fornecedores(id),
  peso_kg numeric(14,3) not null default 0,       -- canônico em kg (toneladas = peso_kg/1000)
  tipo descarregamento_tipo not null,
  preco_por_tonelada numeric(14,2) not null,       -- SNAPSHOT do preço aplicado
  receita numeric(14,2) not null,                  -- SNAPSHOT: round(peso_kg/1000 * preco, 2)
  observacao text,
  created_at timestamptz not null default now()
);
create index receitas_desc_data_idx on receitas_descarregamento(data);
create index receitas_desc_fornecedor_idx on receitas_descarregamento(fornecedor_id);

alter table fornecedores enable row level security;
alter table precos_descarregamento enable row level security;
alter table receitas_descarregamento enable row level security;

-- RLS: leitura para logado, escrita só admin (padrão do projeto).
create policy "read fornecedores" on fornecedores for select to authenticated using (true);
create policy "write fornecedores" on fornecedores for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "read precos_descarregamento" on precos_descarregamento for select to authenticated using (true);
create policy "write precos_descarregamento" on precos_descarregamento for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "read receitas_descarregamento" on receitas_descarregamento for select to authenticated using (true);
create policy "write receitas_descarregamento" on receitas_descarregamento for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

Precisão monetária: tudo `numeric` no banco; `peso_kg` com 3 casas (gramas).

## Domínio (puro, testado) — `src/domain/receitas.ts` + `receitas-metrics.ts`

Tipos:
```ts
type DescarregamentoTipo = "batido" | "paletizado";
interface Fornecedor { id: string; nome: string; ativo: boolean; }
interface PrecoDescarregamento { tipo: DescarregamentoTipo; precoPorTonelada: number; }
interface Receita {
  id: string; data: string; fornecedorId: string; fornecedorNome: string;
  pesoKg: number; tipo: DescarregamentoTipo; precoPorTonelada: number;
  receita: number; observacao: string | null;
}
```

Funções puras (testadas com vitest):
- `toneladas(pesoKg) = pesoKg / 1000`
- `calcularReceita(pesoKg, precoPorTonelada) = round2(toneladas(pesoKg) * precoPorTonelada)`
  - Ex.: `calcularReceita(12500, 20) === 250.00`
- `arredonda2(n)` — helper de centavos.
- Agregações sobre `Receita[]`:
  - `receitaTotal`, `toneladasTotal`, `quantidade`
  - `valorMedioPorTonelada = receitaTotal / toneladasTotal` (0 se toneladas = 0)
  - `receitaPorFornecedor` → lista ordenada desc
  - `receitaPorTipo` → { batido, paletizado }
  - `comparacaoMensal(receitas)` → série por mês (padrão Tendências)
- `custoLiquido(custosBrutos, receitas) = custosBrutos - receitas`

## Camada de dados (backend centraliza o cálculo)

- `src/data/fornecedores.ts` — `listarFornecedores()`, `criarFornecedor(fd)`,
  `encerrarFornecedor(id)`. Escrita com `assertAdmin()` + `revalidatePath`.
- `src/data/precos-descarregamento.ts` — `listarPrecos()`, `editarPreco(fd)` (admin).
- `src/data/receitas.ts` — `listarReceitasDoMes(mes, filtros?)`,
  `criarReceita(fd)`, `editarReceita(fd)`, `removerReceita(id)`.
  - O **cálculo da receita é feito aqui** (usando `domain/receitas-metrics`), nunca no
    cliente. O `preco_por_tonelada` gravado vem do formulário (default = config do tipo,
    editável) e a `receita` é recalculada no servidor a partir de `peso_kg` × preço.
  - `mapReceita` em `src/data/mappers.ts`.

Mutações revalidam `/receitas`, `/custos` e `/` (o resultado consolidado depende delas).

## Telas (reutilizam `components/ui.tsx` + `format.ts`)

- **`/receitas/page.tsx`** — navegação de mês (◀ ▶ `?mes=`); filtros de **fornecedor** e
  **tipo** (via `?fornecedor=&tipo=` na URL); indicadores:
  - `HeroStat`/`StatCard`: receita total, toneladas totais, qtd descarregamentos, valor médio/ton.
  - `BarList`: receita por fornecedor; receita por tipo.
  - Comparação mensal (padrão visual de Tendências).
  - Tabela de lançamentos com **editar** (reabre o formulário pré-preenchido — são
    vários campos, então não é edição campo-a-campo na linha) e **excluir**.
  - Botão **"Lançar descarregamento"** → form (client component) com **preview ao vivo** da
    receita conforme peso/tipo/preço; grava via server action (recalcula no servidor).
  - Botão **"Exportar CSV"**.
- **`/receitas/fornecedores/page.tsx`** — cadastro de fornecedores (padrão `/custos/fixos`):
  adicionar, editar nome, encerrar (soft-delete via `ativo=false`).
- **`/receitas/precos/page.tsx`** — edita os 2 preços globais (só admin).
- **Export CSV** — route handler `src/app/(app)/receitas/export/route.ts` (GET) que recebe
  `?mes=&fornecedor=&tipo=` e devolve CSV com: data, fornecedor, peso (kg), peso (t), tipo,
  preço/ton, receita. `Content-Disposition: attachment`.
- **Nav** — nova entrada **"Receitas"** em `src/app/(app)/sidebar-nav.tsx` (ícone próprio).

## Integração — Resultado logístico

- **`/custos/page.tsx`** — novo bloco **"Resultado logístico do mês"**:
  - **Custos brutos** = salário (efetivo) + fixos + variáveis do mês.
  - **Receitas de descarregamento** = soma das receitas do mês.
  - **Custo líquido** = brutos − receitas.
  - Cores/ícones distintos: custo (navy/vermelho), receita (verde), líquido (destaque
    dourado/azul). Texto deixa explícito que a receita é **compensação demonstrada**, não
    exclusão dos custos. Mostra brutos e líquido lado a lado (antes/depois).
- **`/` (Dashboard)** — custo líquido em destaque (e receita do mês).
- A receita é somada por `data` dentro do mês; nenhum lançamento de custo é alterado.

## Permissões

- Leitura: qualquer usuário logado.
- Escrita (lançar/editar/excluir receita, preços, fornecedores): **admin** (`assertAdmin()`
  no backend + RLS `is_admin()`). UI esconde ações de escrita para viewer (padrão `isAdmin()`).

## Testes

- `src/domain/receitas-metrics.test.ts` (vitest): `calcularReceita` (inclui o exemplo
  12.500 kg → R$250,00), `toneladas`, `valorMedioPorTonelada`, agregações por fornecedor/tipo,
  `custoLiquido`, arredondamento de centavos.

## Fora de escopo (por ora)

- Filtro por intervalo de datas livre (fica por mês).
- Preço por fornecedor (fica global).
- Exportação em PDF (só CSV).
- Vínculo com fornecedores do Winthor/Oracle.

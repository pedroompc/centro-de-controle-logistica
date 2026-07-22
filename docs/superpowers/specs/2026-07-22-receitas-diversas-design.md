# Receitas Diversas (venda de reciclagem) — Design

**Data:** 2026-07-22
**Autor:** Pedro + Claude
**Status:** Aprovado

## Objetivo

Registrar receitas que **não** vêm de descarregamento. A primeira (e hoje única) é a
**venda de material de reciclagem** — o plástico que sobra dos filmes stretch usados na
paletização.

O modelo precisa aceitar tipos novos de receita no futuro **sem tabela nova e sem página
nova**: adicionar um tipo deve custar uma linha de migration, no mesmo espírito do
`pal_rem` em [`0007`](../../../supabase/migrations/0007_pal_rem_e_minimo.sql).

## Decisões (validadas com o Pedro)

1. **Tabela separada** de `receitas_descarregamento`, não uma coluna discriminadora nela.
2. **Preço varia a cada venda** — o valor unitário entra no lançamento, sem tabela de
   preços global (diferente de descarregamento).
3. **Sem cadastro de comprador.** Não interessa de quem veio, só quanto entrou.
4. **Material como texto livre.** Hoje só plástico do stretch; pode crescer sem virar
   cadastro formal.
5. **Entra no custo líquido.** Dinheiro que entra abate o custo da operação,
   independentemente da origem.
6. **Mesma página `/receitas`**, em seção própria abaixo dos descarregamentos.
7. **Export CSV único**, com as duas origens no mesmo arquivo.

## Modelo de dados — `supabase/migrations/0009_receitas_diversas.sql`

```sql
create type receita_categoria as enum ('reciclagem');

create table receitas_diversas (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  categoria receita_categoria not null,
  material text,                  -- livre: "Plástico stretch"
  quantidade numeric(14,3),       -- nullable
  unidade text not null default 'kg',
  preco_unitario numeric(14,2),   -- nullable
  valor numeric(14,2) not null,   -- SNAPSHOT: round(quantidade * preco_unitario, 2)
  observacao text,
  created_at timestamptz not null default now()
);
create index receitas_div_data_idx on receitas_diversas(data);
```

RLS no padrão do projeto: `select` para qualquer autenticado, escrita só para
`public.is_admin()`.

### Por que tabela separada

`receitas_descarregamento` tem fornecedor obrigatório, preço/tonelada vindo de tabela
global e `minimo_aplicado` de R$ 25. Reciclagem não tem nenhum dos três. Unificar deixaria
metade das colunas em `null` e colocaria o piso de R$ 25 ao alcance de uma venda de
plástico — um lançamento de R$ 8 viraria R$ 25 por acidente de modelagem.

### Por que `quantidade` e `preco_unitario` são nullable, mas `valor` não

É o que dá a extensão futura barata. `valor` é sempre a fonte da verdade:

- Receita por quantidade (reciclagem hoje): preenche os três, `valor` = snapshot do produto.
- Receita de montante fixo (hipótese futura): preenche só `valor`.

`unidade` como texto (`kg` por padrão) evita migration caso algum material passe a ser
vendido por peça ou por fardo.

## Domínio

**`src/domain/types.ts`** ganha `ReceitaCategoria` (union espelhando o enum do banco) e a
interface `ReceitaDiversa`, ao lado de `DescarregamentoTipo` e `Receita`.

**`src/domain/receitas-diversas.ts`** (espelha `descarregamento.ts`):

- `CATEGORIAS_RECEITA` — ordem canônica, hoje só `reciclagem`.
- `ROTULO_CATEGORIA: Record<ReceitaCategoria, string>` — o `Record` sobre o union faz o
  TypeScript apontar todos os pontos a atualizar quando um tipo novo entrar.

**`src/domain/receitas-metrics.ts`** ganha:

- `calcularValorDiversa(quantidade, precoUnitario)` — produto arredondado a 2 casas,
  reusando `arredonda2`. Sem piso mínimo (isso é regra de descarregamento).
- `valorTotalDiversas(ds)` — soma dos valores.

## A armadilha do valor médio por tonelada

`valorMedioPorTonelada` é `receita total ÷ toneladas`. Se o total passar a incluir venda de
plástico sem que esse cálculo seja isolado, o valor médio por tonelada de descarregamento
fica inflado por receita que não veio de tonelada nenhuma — um número silenciosamente
errado.

**Regra:** todos os indicadores de descarregamento (toneladas, médio/ton, por fornecedor,
por tipo) continuam calculados **só** sobre `receitas_descarregamento`. Apenas o
"Receita total" da página e o custo líquido somam as duas origens.

Coberto por teste: um cenário com descarregamento + reciclagem deve manter
`valorMedioPorTonelada` idêntico ao cenário só com descarregamento.

## Integração com o custo líquido

`receitaTotalDoMes` (em `src/data/receitas.ts`) passa a somar as duas tabelas. Isso propaga
sozinho para os três consumidores atuais, que já querem "receita total do mês":

- `src/app/(app)/page.tsx` — StatCard "Custo líquido do mês"
- `src/app/(app)/custos/page.tsx` — bloco de resultado
- `src/data/resultado-logistico.ts` — `resultadoLogisticoDoMes`

`serieReceitasMensais` (gráfico de evolução) também passa a somar as duas, para não
divergir do total exibido logo acima dele.

Como hoje, a receita **não** altera nenhum lançamento de custo — o abatimento é só
demonstrado.

## Camada de dados — `src/data/receitas-diversas.ts`

Segue o padrão de `src/data/receitas.ts`:

- `listarDiversasDoMes(mes)` — filtra por intervalo de datas do mês.
- `criarDiversa(input)` — calcula `valor` no servidor a partir de quantidade e preço; nunca
  confia no valor vindo do cliente.
- `removerDiversa(id)` — Server Action, com `assertAdmin()` como todas as escritas.
- `totalDiversasDoMes(mes)` — usado por `receitaTotalDoMes`.

## Tela — `/receitas`

- **Subtítulo da página** deixa de ser "Descarregamentos cobrados de fornecedores", que
  passa a estar errado.
- **Hero "Receita total"** soma as duas origens, com dois StatCards quebrando a origem
  (descarregamento / outras) — sem isso o número cresce e não se sabe por quê.
- **Seção "Outras receitas"** abaixo dos descarregamentos: formulário + lista do mês.
- **Formulário**: data, material (input com `datalist` de sugestões), quantidade em kg,
  preço por kg, observação. O valor calculado aparece em tempo real antes de salvar, como
  no form de descarregamento.
- **Lista** com exclusão gated por admin, igual ao resto do módulo.

Verde é permitido nesta seção: é receita, a única exceção da regra de identidade visual
(verde nunca para status ou categoria).

## Export CSV

`/receitas/export` passa a emitir as duas origens no mesmo arquivo, com uma coluna
`origem` (`Descarregamento` / `Reciclagem`) e as colunas específicas vazias onde não se
aplicam (fornecedor e tipo em reciclagem; material, quantidade e preço unitário em
descarregamento). Linhas ordenadas por data.

## Fora de escopo

Cadastro de compradores, tabela de preços de reciclagem, cadastro formal de materiais,
edição de lançamento (o módulo de descarregamento também só cria e remove — a simetria é
proposital).

## Testes

Em `src/domain/receitas-metrics.test.ts`:

- `calcularValorDiversa` — produto correto, arredondamento a centavos, quantidade zero.
- `valorTotalDiversas` — soma estável.
- **Regressão do médio/ton**: cenário misto não pode alterar `valorMedioPorTonelada`,
  `toneladasTotal`, `receitaPorFornecedor` nem `receitaPorTipo`.

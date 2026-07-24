# Vista simples do descarregamento — design

**Data:** 2026-07-24
**Status:** aprovado

## Problema

A tabela de descarregamentos lança por fornecedor, com peso, tipo, R$/ton e receita
linha a linha. É o nível de detalhe de quem opera. Quem só quer o resultado —
direção — precisa de outra leitura: quantos descarregos entraram no dia, quanto
pesaram e quanto de receita geraram.

Hoje não há como obter isso sem somar mentalmente as linhas do dia.

## Solução

Um seletor de vista na tabela de descarregamentos, com dois modos:

- **Detalhado** — a tabela atual, sem alteração. É o default.
- **Simples** — uma linha por dia: data, nº de descarregos, peso, receita.

## Decisões

### A receita do dia é só de descarregamento

A vista simples não soma receitas diversas (reciclagem). Os três números da linha
precisam medir a mesma coisa: contar descarregos e somar peso não faz sentido para
reciclagem, e uma receita que incluísse reciclagem numa linha cujo peso e contagem
a ignoram seria um número que não fecha com nada ao lado dele.

Outras receitas continuam na sua própria seção.

### O seletor troca apenas a tabela

Cards do topo, filtros, gráficos, seção de outras receitas e export permanecem
idênticos nos dois modos. A mudança é de granularidade de uma tabela, não um "modo
executivo" da página — esconder filtros e gráficos tiraria acesso rápido ao resto
sem ganho para quem só quer ver o total do dia.

### Estado na querystring

`?vista=simples`, como `mes`, `fornecedor` e `tipo` já fazem. Server component,
sem JavaScript no cliente. Consequências obrigatórias:

- `qs()` preserva `vista` ao navegar entre meses.
- O `<form method="get">` dos filtros carrega `vista` em campo oculto — senão
  "Filtrar" devolve o usuário ao detalhado.

Valor ausente ou desconhecido cai em detalhado: o comportamento atual é o default.

### Dias sem descarrego não viram linha

A tabela lista os dias que tiveram movimento, não o calendário do mês. Linha
zerada não informa nada e alonga a tabela em mês de operação irregular.

### Sem edição na vista simples

Não há editar/remover por dia — a linha é um agregado, não um registro. Para
alterar um lançamento, alterna para o detalhado.

## Domínio

Em `src/domain/receitas-metrics.ts`:

```ts
export interface DiaDescarregamento {
  data: string;        // ISO "yyyy-mm-dd"
  descarregos: number;
  pesoKg: number;
  receita: number;
}

export function receitaPorDia(rs: Receita[]): DiaDescarregamento[];
```

Agrupa por `data`, soma dinheiro com `arredonda2` (mesma disciplina de centavos do
resto do módulo) e ordena da data mais recente para a mais antiga, igual à tabela
detalhada e à ordenação da consulta.

Fica no domínio, e não na página, pela mesma razão de `resumoReceitas`: é a regra
que precisa de teste. A invariante que importa é a soma da coluna receita bater
exatamente com `receitaTotal(rs)` — se ela quebrar, a direção lê um total e a
operação lê outro.

### Testes

- agrupa lançamentos do mesmo dia somando contagem, peso e receita
- ordena decrescente por data
- lista vazia devolve `[]`
- a soma das receitas por dia é igual a `receitaTotal`

## Interface

Seletor segmentado (dois `<Link>`) na linha do título "Descarregamentos do mês".

Tabela simples:

| Data | Descarregos | Peso | Receita |

Peso no formato já usado na detalhada (`kg` com as toneladas ao lado), números com
`tabular-nums`, receita em verde — verde é exclusivo de receita, conforme a
identidade visual do projeto.

Rodapé com o total do mês derivado de `receitas.length`, `resumo.toneladas` e
`resumo.totalDescarregamento` — os mesmos valores dos cards do topo, de modo que os
dois fechem por construção e não por coincidência.

Filtros ativos valem nos dois modos: filtrar um fornecedor faz a vista simples
mostrar os dias daquele fornecedor, coerente com os cards.

## Fora de escopo

Cards, gráficos, outras receitas, export CSV (segue por lançamento) e permissões.

# PDVs atendidos no dashboard

## Problema

O dashboard não mostra quantos PDVs (pontos de venda) foram atendidos no mês
corrente. A rotina 111 do Winthor não expõe esse número de forma direta, e o
número que o app já calcula — `positivados` (clientes distintos) — **não** é o
que se quer: positivação deduplica o cliente no mês inteiro, enquanto "PDV
atendido" precisa contar cada dia de atendimento separadamente.

## Definição de "PDV atendido" (travada com o Pedro)

Um atendimento = **um PDV em um dia**. Formalmente, combinações distintas de
cliente + dia sobre as NFs de venda do mês.

| Cenário | Conta |
|---|---|
| Mesmo PDV, dias diferentes (hoje e amanhã) | 2 |
| Mesmo PDV, 3 notas no **mesmo** dia | 1 |
| PDVs diferentes | cada um conta |

Isto é diferente de `positivados` (clientes distintos no mês, sem quebra por
dia), que continua sendo uma métrica válida e permanece exibida.

## Métrica

```sql
COUNT(DISTINCT n.CODCLI || '|' || TO_CHAR(n.DTSAIDA, 'YYYYMMDD'))
```

- Universo: o **mesmo** das contagens atuais (`FILTRO_NF` em `PCNFSAID` — filiais
  1 e 11, `TIPOVENDA IN ('VP','VV')`, `DTCANCEL IS NULL`, período).
- "Dia" do atendimento = `DTSAIDA` (data de saída da NF), a mesma data que o
  módulo já usa como data da venda.
- Entra na subquery `h` que **já varre** a `PCNFSAID` com esse filtro — é mais um
  `COUNT` na consulta existente, sem varredura nova no Oracle.

## Mudanças

1. **`src/data/faturamento.ts`**
   - Adicionar `ATENDIMENTOS` à subquery `h` do `SQL`.
   - Adicionar `ATENDIMENTOS: number` a `LinhaResumo`.
   - Mapear `atendimentos: n(r.ATENDIMENTOS)` no retorno de `getResumoFaturamento`.
2. **`src/domain/faturamento.ts`**
   - Adicionar `atendimentos: number` à interface `ResumoFaturamento` (com
     comentário: "PDVs atendidos = clientes distintos por dia").
3. **`src/app/(app)/faturamento-cards.tsx`**
   - Novo `StatCard` "PDVs atendidos" (`value={r.atendimentos}`, acento `navy`,
     hint "clientes atendidos no mês"), ao lado de "NFs emitidas". A fileira passa
     a 5 cards (`lg:grid-cols-5`).
   - `FaturamentoSkeleton`: 4 → 5 cards, para o layout não pular.
   - `FaturamentoDetalhe`: **mantém** a linha "Clientes positivados" (agora não é
     redundante — mede coisa diferente).

## Fora de escopo (não tocar)

- Snapshot `faturamento_mensal` no Supabase e a série de tendências: o card é do
  **mês corrente**, que lê o Winthor ao vivo (`getResumoFaturamentoMesAtual`).
  Nenhuma coluna nova no banco.
- Regra do 111, congelamento de meses fechados, valores de venda/devolução.

## Erro / indisponibilidade

Sem mudança: se o Winthor estiver fora, `getResumoFaturamentoMesAtual` retorna
`null` e o bloco inteiro já cai no aviso "Faturamento indisponível". O card novo
está dentro desse mesmo caminho.

## Cor

Acento `navy`. Verde é reservado para receita — não usar aqui.

# WMS — Eficiência do galpão

**Data:** 2026-09-23
**Página:** nova `/galpao` (a criar depois da descoberta do schema)
**Status:** ⛔ bloqueado na descoberta do schema `HARPIAW` — ver
`docs/wms/descoberta-harpiaw.sql`

## Objetivo

Responder: **minha operação de armazém está ficando mais ou menos eficiente
mês a mês?** Contagens brutas (movimentos, SKUs, peso) não respondem isso sozinhas —
um mês com mais pedidos sempre terá mais movimento. Por isso cada KPI de volume
vem acompanhado de um KPI **normalizado**.

## KPIs

| # | KPI | Fórmula | Por que importa |
|---|-----|---------|-----------------|
| 1 | Movimentos verticais / mês | COUNT movimentos cujo nível origem ≠ nível destino (ou tipo = reabastecimento/armazenagem aérea) | Empilhadeira: recurso mais caro e gargalo |
| 2 | Movimentos horizontais / mês | COUNT movimentos no mesmo nível (transferência de endereço, picking no chão) | Mão de obra de chão |
| 3 | **Movimentos por tonelada expedida** | (1+2) ÷ peso expedido (t) | Se sobe, o layout/slotting está piorando |
| 4 | **Reabastecimentos por pedido** | movimentos verticais ÷ pedidos separados | Picking subdimensionado gera reabastecimento demais |
| 5 | SKUs ativos em estoque | COUNT DISTINCT produto com saldo > 0 | Base do ABC/slotting |
| 6 | SKUs sem giro (90 d) | SKUs com saldo > 0 e zero saída em 90 dias | Endereço ocupado sem retorno |
| 7 | Peso movimentado (t) | Σ quantidade × peso unitário dos movimentos | Volume físico real |
| 8 | Tempo de separação por pedido | fim − início da tarefa/onda, **mediana e P90** | Nível de serviço interno |
| 9 | **Produtividade de separação** | linhas (ou kg) separadas ÷ horas-homem | O número que diz se a equipe rende mais |

Cada KPI é exibido com o mês atual × mês anterior × média dos 3 meses fechados
anteriores (reaproveitar `variacaoPercentual` de `src/domain/tendencias.ts`).

### Por que mediana/P90 e não média no tempo de separação

Um pedido aberto às 17h e fechado às 7h do dia seguinte vale 14 h e arrasta a
média para cima sem representar trabalho real. A mediana mostra o pedido típico;
o P90 mostra a cauda (os pedidos que atrasam o carregamento). A média fica
disponível, mas não é o número principal. Durações acima de um teto
(padrão: 8 h) são descartadas como tarefa esquecida em aberto, e a quantidade
descartada é exibida para que o descarte nunca fique escondido.

## Decisões em aberto (precisam do Pedro)

1. **Definição de vertical × horizontal.** No WMS existe um campo de tipo de
   movimento (reabastecimento, armazenagem, transferência...) ou precisamos
   comparar o nível do endereço de origem com o de destino? O bloco 6 do script
   de descoberta responde isso.
2. **HARPIAW ou HARPIAW2?** Qual é o de produção? (bloco 1)
3. **Horas-homem.** O KPI 9 precisa das horas trabalhadas pela equipe de
   separação. Duas fontes possíveis: (a) o WMS registra o operador por tarefa;
   (b) o efetivo do setor Depósito já cadastrado no Supabase × dias úteis.
   (a) é mais preciso; (b) já existe.
4. **"Carga" ou "pedido"?** O tempo de separação é por pedido, por onda ou por
   carga (romaneio)? Muda o `GROUP BY`.
5. **Permissão.** O `DB_USER` do app precisa de `SELECT` nas tabelas do WMS
   (bloco 7).

## Arquitetura (mesmo padrão do resto do projeto)

- `src/domain/wms.ts` — matemática pura e testada (estatísticas de duração,
  produtividade). **Já criado**, porque não depende do schema.
- `src/data/wms.ts` — queries Oracle no `HARPIAW` via `queryWinthor`
  (a fazer depois da descoberta).
- `src/app/(app)/galpao/page.tsx` — server component com `MesNav` +
  `Promise.all`, cards de KPI e comparação mensal (a fazer).

# WMS — Eficiência do galpão

**Data:** 2026-09-23
**Página:** `/galpao`
**Status:** ✅ página `/galpao` implementada · ⚠️ premissas a validar em
`docs/wms/validacao-kpis-galpao.sql`

## Objetivo

Responder: **minha operação de armazém está ficando mais ou menos eficiente
mês a mês?** Contagens brutas (movimentos, SKUs, peso) não respondem isso sozinhas —
um mês com mais pedidos sempre terá mais movimento. Por isso cada KPI de volume
vem acompanhado de um KPI **normalizado**.

## Descoberta — rodada 1 (resultado)

- **Produção = `HARPIAW2`** (2.082 tabelas, ~41 mi linhas, estatística de 16/09).
  `HARPIAW` tem só 7 tabelas de integração (`HW_PDSAI`, `HW_NFENT`...): fora do escopo.
- Candidatas por KPI (hipóteses até ver as colunas — rodada 2 em
  `docs/wms/descoberta-harpiaw2-rodada2.sql`):
  - Movimentação: `MOVIMENT_END_502` (~224 mil) e `MIRROR_502` (~2,4 mi —
    que se revelou log de auditoria — ver rodada 2), `MOVIMENT_END_FUNC_503`.
  - Reabastecimento (vertical): `PREPARA_ABAST_809`, `PREPARA_ABAST_MERC_1361`.
  - Nível do endereço: `DEPOSIT_EMPRESA_END_179` + `GRAU_END_318` (9 graus).
  - SKU/saldo: `MERCADORIA_461`, `MERC_EMPRESA_468`, `LT_ESTOQ_MERC_447`.
  - Separação: `PLAN_SEP_MAPA_1195`/`_MERC_1196`, `PLAN_SEP_COLETOR_1275`/`_MERC_1276`.
  - Carga: `CARREG_VEIC_38`, `NUM_CARREG_1140`.
- Bloco 7 (privilégios) veio sem grants diretos, mas as tabelas aparecem em
  `ALL_TABLES` — ou seja, o acesso vem por role. Confirmar que o login usado
  foi o `DB_USER` do app.

## Descoberta — rodada 2 (resultado) e decisões

Os comentários de coluna do Harpia documentam o modelo. O que a página usa:

| KPI | Fonte | Regra |
|---|---|---|
| Vertical × horizontal | `MOVIMENT_END_502` | Nível = 5º–6º dígito do endereço (RR PP **NN** AAA). Vertical se origem OU destino > nível 01; horizontal se ambos no 01. Ruas virtuais (`PRIM_GRAU_END_611.SN_VIRTUAL_611='S'`) sem nível. Só `STATUS_502='2'` (efetivado) e tipos S/E/I/D (C = pré-contagem, qtd 0). Mês por `NVL(DT_FIN_502, DT_MOVIMENT_502)`. |
| Tipo de movimento | `TIPO_MOVIMENT_502` | S = abastecimento (pulmão→picking), E = entrada/armazenagem, I = interna, D = devolução. |
| Peso movimentado | `PESO_502` | ⚠️ unidade não confirmada (V3). |
| Cargas / peso expedido | `CARREG_VEIC_38` | Só cargas com `DT_HR_FECHAMENTO_CARGA_38`; mês por `DT_CARREG_PK_38`; peso `PESO_CARREG_38` (V4). |
| Tempo de separação | `CARREG_VEIC_38` | Início da separação → início da conferência; ciclo = → fechamento. Mediana/P90, teto 12 h. |
| Produtividade | `PLAN_SEP_COLETOR_1275/1276` | Linhas com qtd separada > 0 ÷ horas em tarefa (teto 4 h). Só coletor (V6 mede cobertura). |
| SKUs / sem saída | `MERC_EMPRESA_468` + `1196→1195→38` | Saldo > 0; sem saída = fora de qualquer carga em 90 d. Foto de hoje (sem histórico). |
| Ocupação do pulmão | `DEPOSIT_EMPRESA_END_179` | `TIPO_END_179='M'`, ocupado `STATUS_179='O'` ÷ não bloqueado. |

**`MIRROR_502` não é usada**: é log de auditoria (`TIPO_MIRROR`, `DTHR_MIRROR`) — várias
linhas por movimento; contar nela duplicaria. A própria `MOVIMENT_END_502` guarda
histórico desde pelo menos ago/2025 (amostra).

**Horas-homem**: o KPI usa tempo em tarefa do coletor, não hora paga. Cruzar com o
efetivo do Depósito (Supabase) fica para quando o turno for separado do setor (BACKLOG item 1).

**SKU mês a mês**: o WMS não guarda saldo histórico por SKU. Para comparar meses,
seria preciso gravar uma foto mensal no Supabase (mesmo padrão de `faturamento_mensal`).

## KPIs (desenho original)

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

## Decisões

1. Vertical × horizontal: pelo **nível** do endereço (origem/destino), não pelo tipo de movimento — ver rodada 2.
2. Produção = **HARPIAW2**.
3. Horas-homem: tempo em tarefa do coletor (proxy). Hora paga fica para depois.
4. Tempo de separação: **por carga** (`CARREG_VEIC_38`); por tarefa no coletor como complemento.
5. Permissão: acesso via role — confirmar com o `DB_USER` do app.

## Arquitetura

- `src/domain/wms.ts` — matemática pura e testada (estatísticas de duração, janela de meses, indicadores normalizados).
- `src/data/wms.ts` — 4 queries no `HARPIAW2` via `queryWinthor`, cada uma isolada: se uma falha, a página avisa qual.
- `src/app/(app)/galpao/page.tsx` — 6 meses fechados + mês corrente (parcial). KPIs comparam o último mês fechado com o anterior.

## Aba "Operação" (`/galpao?aba=operacao&mes=`)

Mesma base de movimentos (`CTE_MOVIMENTOS` em `src/data/wms.ts`: `MOVIMENT_END_502` efetivados).

- **Operador** = `NVL(USU_EFETIV_FK_502, USU_FK_502)`, nome em `USUARIO_754` (`DESCR_COMPLETO_754` ou login).
  Ranking por **movimentos por dia trabalhado** (dias distintos com movimento); < 3 dias vai para o fim.
  Régua = mediana da equipe. Comparação com o mesmo operador no mês anterior.
- **Hora** = hora de `DT_FIN_502` (efetivação). Movimento sem hora real (`DT_FIN_502` nulo ou 00:00:00) fica
  fora dos gráficos por hora e a quantidade aparece na tela.
- **Turnos** (BACKLOG): Manhã 07–17, Tarde 13–22, Noite 22–07. Manhã e Tarde se sobrepõem das 13h às 17h;
  pelo horário não dá para atribuir o movimento a um dos dois, então a janela é uma faixa própria.
  `mov/h` = movimentos ÷ (horas da faixa × dias), para faixas de tamanhos diferentes serem comparáveis.
- **Dia da semana × hora**: média por dia daquele dia da semana (dia ISO via `TRUNC(d) - TRUNC(d,'IW')`, sem NLS).
- ⚠️ Usuário de sistema/login compartilhado aparece como um operador — confirmar quais usuários são pessoas.

## Aba "Produtos" (`/galpao?aba=produtos&mes=`)

Mesma base (`CTE_MOVIMENTOS`, que agora também traz `QTD`, `END_O`, `END_D`). Uma linha por produto do mês:

- **Curva ABC de movimento** (não de venda): A até 80% acumulado dos movimentos, B até 95%, C o resto.
- **Quem**: pessoas distintas e quem mais movimentou (`STATS_MODE` do usuário).
- **Endereço inferido dos movimentos**: picking = destino mais frequente dos abastecimentos (S); pulmões = origens distintas.
  Troca pelo picking cadastrado (`MERC_EMPRESA_END_470`) quando V4 confirmar.
- **Paletização**: praticada = quantidade mais comum por armazenagem (E); cadastro = `PCPRODUT.LASTROPAL × ALTURAPAL` / `QTTOTPAL`.
- **Alertas**: classe A com picking acima do nível 01 · classe A sem picking · palete praticado ≠ cadastro (>10%).
- ⚠️ Premissas em `docs/wms/validacao-produtos.sql`: código WMS = CODPROD, unidade de `QTD_502`, colunas de paletização.

## Painel por turno (`/galpao`) — tela principal (2026-09-28)

Pedido do Pedro: **um painel só**, estilo BI, com a eficiência do galpão **por turno**:
movimentações verticais, horizontais e separação de carga (tempo, SKU e peso médios).
As abas anteriores (Indicadores, Operação, Gestão) saíram da navegação e ficam em
`?aba=` com um link discreto no rodapé, até decidirmos se saem de vez.

**Drill-down por clique = filtro na URL** (`?mes=&turno=&dia=&op=`). Cada clique
(linha do turno, coluna do dia, linha do operador) adiciona um filtro, e todos os blocos
recalculam. Clicar de novo ou no × do chip remove o filtro. Cada quebra ignora o próprio
filtro (a tabela de turnos continua mostrando os 4 turnos com o turno escolhido em
destaque) e respeita os demais.

| Decisão | Regra |
|---|---|
| Turno | Pela hora (mesmas faixas da aba Operação): Manhã 07–13, Manhã+Tarde 13–17, Tarde 17–22, Noite 22–07. A sobreposição fica como faixa própria até existir turno por funcionário (BACKLOG 1). |
| Noite × virada do dia | 00h–06h59 pertence à Noite do **dia anterior**. A query vai até o dia 2 do mês seguinte (exclusivo) para fechar a última Noite; o domínio descarta a madrugada do dia 1º (é do mês anterior). |
| Normalização | **Por turno** = total ÷ turnos com atividade (faixa × dia). Operador: movimentos ÷ turnos em que efetivou algo. |
| Separação por turno | Pela hora de `DT_HR_INICIO_SEPARACAO_38` (não por `DT_CARREG_PK_38`, como na aba Indicadores: os totais do mês podem diferir). Tempo = início da separação → início da conferência. **Mediana** em destaque, média e P90 ao lado, teto 12 h. |
| SKU médio | Produtos distintos por carga nos mapas de separação (`1196 → 1195.CARGA_1195`), média simples entre as cargas. |
| Peso médio | `PESO_CARREG_38` (unidade ainda não validada — V4). |
| Operador × separação | O filtro de operador **não** recorta a separação: `CARREG_VEIC_38` não registra quem separou. |
| Sem hora | Movimento sem hora de efetivação e carga sem hora de início ficam fora (não têm turno); a quantidade aparece em "Como ler". |

Arquitetura: `src/domain/wms-eficiencia.ts` (`montarPainel`, puro e testado),
`src/data/wms-eficiencia.ts` (2 queries por mês, cada uma em `tentar()`),
`src/app/(app)/galpao/painel.tsx`. O mês abre no **corrente** (acompanhamento do dia).

⚠️ Não validado no Oracle (sem acesso à rede da empresa na hora da implementação):
a subquery de SKUs por carga (`CARGA_1195 = CARREG_PK_38`, mesma junção já usada em
`SQL_ESTOQUE`) e o volume de linhas da query de movimentos por dia × hora × operador.

### Painel — visão geral e estoque (2026-09-29)

- **Sem filtro = operação inteira.** Os cards de movimentação mostram o **total do mês** em destaque;
  por dia e por turno ficam embaixo como normalização. O selo do topo diz "Operação geral".
- **Estoque (foto de agora)**, fora dos filtros e do mês — o WMS não guarda histórico de ocupação:
  - SKUs cadastrados = `COUNT(*) MERC_EMPRESA_468` da empresa; com saldo e sem saída 90 d reaproveitam `SQL_ESTOQUE`.
  - % utilizada = `STATUS_179='O'` ÷ `STATUS_179<>'B'` em `DEPOSIT_EMPRESA_END_179`, agrupado por `TIPO_END_179`.
    Estoque = todos os tipos; pulmão = `'M'` (rodada 2); **picking = `'P'` NÃO confirmado**.
    Tipos sem mapeamento aparecem numa linha à parte, para um código errado se revelar na primeira execução.
  - Acima de 90% o medidor fica vermelho com ▲ (sem posição livre para receber).

# BI Geral — Fase 2: comparação dentro das abas de setor

Continuação de `2026-11-16-bi-geral-design.md` (seção Fases, item 2). Pedido do
Pedro em 16/11/2026: "pode seguir com a fase 2".

## O que muda

Em `/bi`, nas abas Separação, Recebimento, Abastecimento e Motoristas, o mesmo
`?cmp=` da aba Geral (mês anterior, mesmo período do ano passado, livre) passa a
valer: **cada quadro do topo mostra a variação do seu número principal** contra o
período escolhido, com a mesma linha da aba Geral (seta, %, "vs Set/26";
"sem histórico" sem base; "comparação indisponível" se o banco falhou).

| BI | Quadros comparados (número principal) |
|---|---|
| Separação | Custo, Produção (endereços), Dia × Noite (kg), Qualidade (‰, diferença absoluta) |
| Motoristas | Custo, Entregas, Ocupação da frota (p.p.), KM rodado, Devolução (p.p.) |
| Abastecimento | Custo, Volume (cx), Giro (abast.), Movimentação, Rupturas |
| Recebimento | Custo, Descarrego (carros), Receita, Eficiência (R$/t) |

Quadros só de admin (Operadores, Motoristas) e de contagem de cadastro ficam sem
variação.

## Decisões (calls do Claude, Pedro pode corrigir)

- **Mesma conta:** o período de comparação passa pelo MESMO carregador do BI do
  setor, e os números saem da mesma função para os dois lados — nada de conta
  paralela. Custo: 1ª abertura fria com comparação ~2× mais lenta (carrega em
  sequência, não junto, para não derrubar o Oracle); depois cache.
- **Sem `?cmp=`** tudo fica como hoje (inclusive os "vs mês anterior" e "/dia"
  que já existem). Com `?cmp=` esses textos antigos saem — uma régua só na tela.
- `/setores/[id]?aba=bi` não muda (não recebe comparação).
- Seletor "Comparar" vai para a linha das abas, valendo em todas as abas.
- Período de comparação antes do piso do setor → "sem histórico".
- Filtro por dia (clique no calendário) esconde a variação (compara dia × período).
- Comparação individual dos operadores (admin) continua mês/período anterior.

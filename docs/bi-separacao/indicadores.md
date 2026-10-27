# BI da Separação — indicadores, fórmulas e validação

Fonte única de verdade de cada número do BI da Separação. Código:
`src/data/harpia-separacao.ts` (consultas), `src/domain/separacao.ts` (regras),
`src/domain/turnos-separacao.ts` (turnos), `src/app/(app)/setores/[id]/separacao-dados.ts`
(montagem no servidor).

**Validar um mês:** `npm run validar:separacao -- AAAA-MM`. O script
(`scripts/validar-bi-separacao.mjs`) reescreve cada consulta direto nas tabelas
brutas, sem reaproveitar o SQL do app, e imprime o valor que a tela deve mostrar,
mais as checagens de duplicidade. Em 26/10/2026, setembro e outubro bateram
100% (app × script) em todos os indicadores.

## Regras gerais

| Regra | Definição |
|---|---|
| Dia operacional | 07:00 de D → 06:59 de D+1 = dia D (`CORTE_DIA_OPERACIONAL = 7`). A noite que passa da meia-noite fica no dia em que começou. |
| Dia do mapa | Dia operacional da **1ª conferência** do mapa (`MIN(PLAN_SEP_MAPA_AVERIG_1197.DTHR_AVERIG_1197)`). De dia a conferência começa logo que a separação termina (mediana de 0,1 h); à noite as duas acontecem na mesma madrugada. Mapa ainda não conferido não entra. |
| Mês | Dias operacionais de 01 a último dia do mês. A leitura começa 7 dias antes para o `MIN` não errar com mapa de conferência longa. O script checa se existe mapa com mais de 7 dias de conferência. |
| Fuso | Datas do Oracle são horário local da operação (sem fuso gravado). |
| Filial | Harpia só tem a empresa 1 (= filial 1). A filial 11 aparece só no confronto com o Winthor. |
| Mês corrente | Custo proporcional: `fração = dia de hoje ÷ dias do mês`, a mesma regra do BI do Abastecimento (`fracaoDoMes`). Comparações com o mês anterior usam **taxa** (por dia, por linha, por hora), nunca o total do mês incompleto. |
| Dia filtrado | Clicar num dia filtra Produção, Turnos, Qualidade e o custo (custo do dia = custo do período ÷ dias com separação). A aba Operadores é sempre mensal. |
| Vazio | Indicador sem denominador mostra "—". Nunca é preenchido com zero nem com estimativa. |

## Vocabulário (não são sinônimos)

- **Endereço visitado** (na tela; no código e nesta doc continua "linha") = linha do mapa (`PLAN_SEP_MAPA_MERC_1196`), um produto a apanhar num endereço. Mapa × página × endereço (`PORTA_PALLET_1196`) é único na tabela (out/2026: 76.489 = 76.489), então cada linha é uma visita a um endereço numa página do mapa. Em mapa por cliente (tipos 3 e 4) é produto × cliente. Em mapa consolidado por carga (tipos 0 e 8) é produto × carga: apanha uma vez para a carga toda.
- **Caixa** = caixa fechada (`QTD_FATURADA_CX_1196`).
- **Unidade** = caixas × `PCPRODUT.QTUNITCX` + avulsas (`QTD_FATURADA_UN_1196`). Bate com a conferência (`QTD_AVERIG_TOTAL_UN_1197`) dentro de 0,2%.
- **Pedido** = guia do mapa (`PLAN_SEP_MAPA_GUIAS_1198.NUM_PEDCONF_FK_1198`).
- **Carga** = `PLAN_SEP_MAPA_1195.CARGA_1195` (= `NUMCAR` do Winthor). Um mapa tipo 8 pode atender várias cargas (cabeçalho repetido).
- **SKU** = produto distinto.

## Indicadores

### Produção (fonte: Harpia)

| Indicador | Fórmula | Nulos, duplicidade e cancelamento | Validação |
|---|---|---|---|
| Linhas separadas | `COUNT(*)` das linhas `MERC_1196` dos mapas do período | Toda linha liga a 1 página (checado: 0 páginas duplicadas) | "Linhas separadas" |
| Caixas / Unidades | Σ caixas; Σ (cx × un/cx + avulsas) | `NVL(…, 0)`; produto sem `QTUNITCX` conta 1 un/cx | "Caixas" / "Unidades" |
| Peso (t) | Peso do **Winthor**: Σ `PCPEDC.TOTPESO` (não cancelados, filiais 1 e 11) dos pedidos da carga do mapa (`PLAN_SEP_MAPA_1195.CARGA_1195` = `PCPEDC.NUMCAR`; carga ↔ mapa é 1 para 1 em toda a tabela, checado pelo script). Para turno/hora, o peso do mapa é repartido entre as linhas na proporção de unidades × `PCPRODUT.PESOBRUTO` (`aplicarPesoWinthor`) | Venda balcão (tipo 3) cuja carga não existe no `PCPEDC` (out/2026: 619 mapas, 91,7 t de 1.616,9 t) fica com a estimativa unidades × `PESOBRUTO` | "Peso (t)" |
| Pedidos | Σ por dia de `COUNT(DISTINCT guia)` | Checado: 0 pedidos em mapas de dias diferentes, então a soma por dia = distintos no mês | "Pedidos" |
| Clientes | Mês: `COUNT(DISTINCT CLI)` das guias. Dia: distintos no dia. "PDV-dia" = soma dos distintos de cada dia (mesma métrica do dashboard) | `CLI = 0` (consolidado) excluído | "Clientes" / "PDV-dia" |
| Carregamentos | `COUNT(DISTINCT CARGA_1195)` exceto mapa tipo 3 | Venda balcão (tipo 3) usa carga de sistema "VENDA BALCAO", não é carregamento | "Carregamentos" |
| SKUs | `COUNT(DISTINCT MERC_PF_1196)` no mês | Não existe por dia nem por turno (não é aditivo) | "SKUs" |
| Média por dia da semana | Σ do dia operacional ÷ dias com separação daquele dia da semana | Dia sem mapa não entra na média | — |
| Endereços mais / menos visitados | `PORTA_PALLET_1196` × produto no mês: `COUNT(*)` das linhas, caixas e unidades. 10 de cada ponta; empate desempata por unidades e pelo código do endereço. Endereço exibido como rua.prédio.nível.apto (2+2+2+3 dígitos, os mesmos graus de `DEPOSIT_EMPRESA_END_179`) | Mês inteiro, não segue o filtro de dia. "com 1 visita" = quantos pares endereço × produto tiveram uma visita só |
| Linhas por dia (mês a mês) | linhas do mês ÷ dias operacionais com separação | Permite comparar mês incompleto | — |

### Custo e financeiro

| Indicador | Fórmula | Observação |
|---|---|---|
| Custo do mês | Folha do setor (foto mensal do efetivo; no mês corrente, cadastro vivo) + equipamentos do cadastro de hoje | Folha = `custo_mensal` = TOTAL da planilha comparativa (salário + 85% de encargo **estimado** + benefícios cadastrados) |
| Custo do período | custo do mês × fração | Mês fechado: fração = 1 |
| Custo ÷ faturamento líquido | custo do período ÷ venda líquida (rotina 111: faturada − devoluções − devolução avulsa, por data da NF, filiais 1+11) | Mesma metodologia do BI do Abastecimento. Faturamento do mês corrente vai até hoje. Meses fechados no histórico vêm das fotos `faturamento_mensal` |
| Custo por linha / pedido / tonelada | custo do período ÷ linhas / pedidos / (kg ÷ 1000) | Custo por caixa calculado mas não exibido |
| Custo médio por pessoa | custo do mês ÷ pessoas ativas | — |

**O que NÃO está no custo** (não existe no banco): hora extra realizada, folha
real paga, temporários e terceiros, custos indiretos (galpão, energia, sem rateio
definido). Custo direto = folha + equipamentos do setor; nenhum custo
compartilhado é rateado.

### Turnos

Dois turnos de separação, **Dia** e **Noite** (decisão de 26/10/2026): a separação de dia só começa às 13h, antes disso a equipe da manhã faz abastecimento e inventário. Manhã e tarde do cadastro formam o Dia. O cadastro do RH não muda, só o BI agrupa (`turnoSepDoCadastro`).

Turno de cada linha (`atribuirTurno`):

1. Página com separador registrado **e** ligado a um funcionário (ligação manual em `harpia_usuarios` vence; senão, casamento automático pelo nome) → turno do **cadastro** do funcionário (manhã/tarde → Dia). Hora extra conta para o turno da pessoa.
2. Senão → janela de horário da config (Dia 07–20, Noite 20–07; a noite começa às 20h, definição do Pedro em 27/10/2026), usando a hora de início da página ou, sem página nomeada, a hora em que o **conferente do mapa** (quem mais bipou o mapa, `STATS_MODE(USU_AVERIG_1197)`) **começou a conferir naquele dia operacional**. Assim o conferente da tarde que segue até 21h não manda os mapas dele para a noite. O início da sessão só conta bips a partir das 12h: antes disso é o rabo da noite anterior (bips até ~07h30) ou abastecimento. Mapa conferido antes das 12h usa a própria hora. Out/2026: com essa regra, os conferentes do dia (Guilherme, Leonardo José, Lucas, Osmar, Adielson, Elvis) ficam 100% no Dia e os da noite 100% na Noite. Pela hora pura do mapa, cerca de 140 mapas desses conferentes da tarde caíam na Noite.

| Indicador | Fórmula |
|---|---|
| Pessoas / separadores / conferentes | Cadastro ativo do setor com aquele turno (cadastro de hoje, porque não há histórico por pessoa) |
| Horas disponíveis | Σ horas em separação dos separadores do turno × dias com linha do turno. Horas por pessoa pelo turno do cadastro (`HORAS_NA_SEPARACAO`): manhã 4 h (13h ao fim do turno 07h–17h), tarde 8 h, noite 10 h (20h–06h). **Estimativa**: sem ponto, falta, férias ou hora extra |
| Média por dia trabalhado (t, endereços, SKUs, pedidos, caixas) | total do turno ÷ dias operacionais em que o turno teve endereço. Não depende do nome do separador: endereço sem registro entra no turno pela regra 2 acima (hora em que o conferente do mapa começou a conferir), então a noite é medida inteira. SKUs = produtos distintos no dia × turno (`SQL_PRODUTOS_TURNO`, mesma regra de turno), média dos dias. Paletes: não exibido. O Winthor não grava (`PCPEDC.QTPALETE` vazio) e o Harpia só numera palete nos mapas tipo 8 |
| Linhas, kg, pedidos por hora | produção do turno ÷ horas disponíveis |
| Linhas por separador por dia | linhas ÷ separadores ÷ dias |
| Pedidos e clientes do turno | Rateio: pedidos do mapa × (linhas do turno no mapa ÷ linhas do mapa). A soma dos turnos fecha o total (testado: 21.278 = 21.278) |
| Custo do turno | custo da folha do período × (folha do turno ÷ folha do setor). A folha INTEIRA da manhã entra no Dia, inclusive as horas de abastecimento/inventário (rateio fica para decidir com o RH). Equipamentos não têm turno e ficam fora |
| Erros a cada 1.000 linhas | itens com erro de origem S do turno ÷ linhas do turno × 1000 |
| Perfil | kg/linha, unidades/linha e % de linhas em mapa consolidado. Diferença acima de 25% gera aviso |
| Ranking | Melhor de cada critério entre turnos com produção **e** separador. Empate = sem vencedor. Equilíbrio = menor soma das posições em linhas/hora, custo/linha e erros/1.000 (sem pesos) |
| "× demais" | valor do turno ÷ média simples dos outros turnos − 1 |

### Operadores (somente admin)

| Indicador | Fórmula |
|---|---|
| Horas ativas | União dos intervalos das páginas do separador em cada dia (páginas abertas em paralelo não somam duas vezes). Não é jornada |
| Linhas/h, kg/h | linhas ou kg ÷ horas ativas |
| Média do turno / geral | Σ linhas ÷ Σ horas de quem tem amostra (3+ dias e 10+ h) |
| × mês anterior | linhas/h do mês ÷ linhas/h do mês anterior − 1 (só com amostra nos dois) |
| Erros ‰ | itens com erro de origem S atribuídos a ele ÷ linhas dele × 1000 |
| R$/linha | custo do funcionário ligado × fração ÷ linhas registradas. Superestima quem tem linhas sem registro |
| Sinal | "evolução" ou "queda": ±10% contra o próprio mês anterior. "avaliar": abaixo de 80% da média do turno, só se o kg/linha dele não passa da média do turno em mais de 25%. Sem amostra, sem sinal |

Conferentes: por dia operacional, horas = 1ª à última bipagem (inclui
pausas), unidades/h só dos dias com 1 h ou mais.

### Qualidade (fonte: `PLAN_SEP_MAPA_MERC_ERRO_1199`)

| Indicador | Fórmula |
|---|---|
| Itens com erro do separador | Itens distintos (mapa × produto × pedido) com bloqueio de `ORIGEM_ERRO = 'S'` (comentário da coluna: S = separador, C = conferente). O SQL agrega por item **antes** de agrupar, então o item conta 1 vez mesmo com falta e sobra |
| Ocorrências | bloqueios (`COUNT(*)`). Um item pode bloquear várias vezes |
| Unidades divergentes | Σ abs(carga − bipado) |
| Falta × sobra | ocorrências com bipado < carga × bipado > carga |
| Erros do conferente / sem origem | o mesmo para `C` e para origem nula ou outra |
| A cada 1.000 linhas | itens com erro do separador ÷ linhas separadas × 1000 |
| Atribuído a separador | o item só vai para uma pessoa quando todas as linhas da chave mapa × produto × pedido estão em páginas do mesmo separador registrado |

## Mudanças em relação ao BI anterior (até 26/10/2026)

| Antes | Agora | Impacto |
|---|---|---|
| Pedidos, peso e dia pelo `PCPEDC.DTFINALSEP` no dia do calendário | Produção pelo Harpia, no dia operacional | `DTFINALSEP` é gravado no fechamento da carga (17h–06h). O sábado aparecia com cerca de 1.100 pedidos/dia; pelo dia operacional são cerca de 210. "Horário de pico" (hora do `DTFINALSEP`) saiu, porque media a integração e não a separação |
| "Linhas/SKU" = linhas de pedido do `PCPEDI` | Linha física do mapa (`MERC_1196`) | Em mapa consolidado, 1 linha atende a carga toda. Na semana testada: 7.271 × 8.019 |
| Pedidos e clientes da conferência (`AVERIG`) | Guias do mapa | 79% das linhas conferidas têm pedido `000000A` / cliente 0 (consolidado) |
| Custo por pedido e por t = custo do mês cheio ÷ produção até hoje | custo × fração do mês | No dia 26 o valor antigo saía cerca de 20% acima |
| "Erros" = todos os bloqueios | Separados por origem (S/C), itens × ocorrências | ~95% são de origem separador. A taxa usa linhas como denominador |
| Rendimento = pedidos ÷ todas as pessoas do setor ÷ dias; Capacidade = dia de pico ÷ separadores | Removidos. Entraram linhas por hora disponível por turno e por operador | O pico vinha deslocado e sugeria "sobra gente" com base só em médias. Simulação de capacidade fica para a etapa de dimensionamento |
| "Itens por conferente/dia" | Removido | Média de médias, sem uso para gestão |
| Sem turno | Aba Turnos | Novo |
| Ranking individual | Aba Operadores (só admin; os dados nem são consultados para quem não é admin) | Novo |
| Peso estimado pelo cadastro (unidades × `PESOBRUTO`) | Peso do Winthor por carga | Pedido do Pedro, 26/10/2026. Por tipo de mapa em out/2026: tipo 0 −0,02%, tipo 4 +0,8%, tipo 8 −3,8% contra a estimativa |
| Aba Auditoria (Harpia × Winthor, cobertura, regras de turno) | Removida | Pedido do Pedro, 26/10/2026. As checagens continuam no `npm run validar:separacao`; só o alerta de horário ≠ cadastro ficou, na aba Turnos |
| Palete | Não exibido | O Winthor não grava (`PCPEDC.QTPALETE` vazio) e o Harpia só numera palete nos mapas tipo 8 |

## Dados que o banco não tem (precisam ser coletados para virar métrica)

- **Separador da noite**: as páginas da madrugada não são registradas no Harpia. Sem isso, a noite é medida só como equipe.
- **Cobertura do separador de dia**: cerca de 35% das linhas no total (dia ~70%). Mapas pequenos e parte dos consolidados não têm nome.
- **Ponto / horas trabalhadas**, faltas, férias, feriados e hora extra. As horas disponíveis são estimadas.
- **Custo real** (folha paga, hora extra, temporários) e rateio de custos indiretos.
- **Tipo de erro** (produto trocado × quantidade), avaria na separação, retrabalho, devolução ligada à separação e valor do erro.
- **Metas oficiais**: não há metas cadastradas. O BI não classifica bom/ruim sem meta.
- **Histórico de turno por pessoa**: meses passados usam o turno do cadastro de hoje.
- **Regra oficial dos turnos (RH)**: os horários em `turnos-separacao.ts` são de referência.
- **Paletes separados**: sem registro completo no Winthor nem no Harpia.

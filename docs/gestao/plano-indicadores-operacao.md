# Plano de indicadores da operação — gerente logístico

**Data:** 2026-09-25 · **Fontes:** WinThor (ERP, Oracle) + Harpia WMS (schema `HARPIAW2`, mesmo Oracle)

Legenda de status: ✅ já no app · 🟢 dado confirmado, falta construir · 🟡 tabela existe, colunas a validar · 🔴 sem dado hoje

---

## 1. As quatro perguntas do gestor

| Pergunta | Indicador-chave (o número que responde) |
|---|---|
| **Quanto tempo minha operação leva?** | Lead time **pedido liberado → nota autorizada** (mediana e P90) e o tempo **de cada etapa** |
| **Onde estou falhando?** | Etapa com maior fila/tempo · erro de separação · devolução por motivo logístico · cortes |
| **Minha equipe rende?** | Produtividade por **função** (empilhadeira, separador, conferente, motorista) contra a mediana da própria função |
| **Estou ficando mais eficiente?** | Custo logístico por tonelada e por entrega · movimentos por tonelada · evolução mês a mês |

Regra: toda contagem vem acompanhada de um número **normalizado** (por tonelada, por pedido, por dia trabalhado).
Contagem sozinha sobe e desce com o volume de venda e não mede gestão.

---

## 2. Ciclo do pedido — a linha do tempo

Cada etapa só pode ser medida se o sistema **grava data E hora** do evento. Tempo entre dois eventos = etapa.

| # | Evento | Onde está gravado | Status |
|---|---|---|---|
| 1 | Pedido digitado | WinThor `PCPEDC.DATA` (+ `HORA`/`MINUTO`?) | 🟡 confirmar se tem hora |
| 2 | Pedido liberado (crédito/comercial) | WinThor `PCPEDC.DTLIBERA` | 🟡 usado no app; confirmar se tem hora |
| 3 | Carga montada | WinThor `PCPEDC.NUMCAR` → `PCCARREG.DATAMON`? | 🟡 |
| 4 | Carga entra no WMS | Harpia `CARREG_VEIC_38.DT_INTERNALIZACAO_CARGA_38` · `HARPIAW.HW_PDSAI.PC_DATA` | 🟡 |
| 5 | Início da separação | Harpia `DT_HR_INICIO_SEPARACAO_38` · `PLAN_SEP_COLETOR_1275.DT_HR_SEP_INI_1275` | 🔴 veio vazio na /galpao |
| 6 | Início da conferência | Harpia `DT_HR_INICIO_CONFERENCIA_38` | 🔴 veio vazio |
| 7 | Carga fechada no WMS | Harpia `DT_HR_FECHAMENTO_CARGA_38` | 🟢 preenchido (4.195 cargas/ago) |
| 8 | Liberada para faturar (WMS → ERP) | Harpia `DT_HR_RETORNO_ERP_38` · `PED_CARGA_LIB_FAT_ERP_1333` | 🟡 |
| 9 | Nota autorizada | WinThor `PCNFSAID.DTHORAAUTORIZACAOSEFAZ` | ✅ usado no fechamento |
| 10 | Veículo sai | WinThor `PCCARREG.DTSAIDA` · Harpia `DT_SAIDA_38` | 🟡 |
| 11 | Entrega / canhoto | WinThor `PCNFSAID.DTENTREGA`/`DTCANHOTO`? | 🟡 |

Descoberta: `docs/gestao/descoberta-ciclo-pedido.sql`.

**Indicadores do ciclo**
- Lead time liberado → nota (mediana, P90), mês a mês.
- Tempo por etapa (2→3 montagem, 3→7 armazém, 7→9 faturamento, 9→10 espera de saída).
- **% de pedidos faturados em até D+1** da liberação (nível de serviço interno).
- Fila: pedidos liberados/montados há mais de X horas — ✅ já existe em **Pedidos a faturar**.

Se as etapas 5 e 6 não tiverem hora gravada, o armazém vira **uma etapa só (3→7)**. Ainda dá para
cobrar o tempo total do galpão, mas não separar "separação lenta" de "conferência lenta".

---

## 3. Onde estou falhando — qualidade

| Indicador | Fonte | Status |
|---|---|---|
| Devolução por motivo **Logística** (valor, taxa, motivo) | WinThor `PCTABDEV` | ✅ página Devoluções |
| Devolução por motorista | WinThor `PCCARREG.CODMOTORISTA` | ✅ |
| **Erro de separação** (% linhas com erro, por separador) | Harpia `PLAN_SEP_MAPA_MERC_ERRO_1199`, `PLAN_SEP_VOL_CONFERROS_1240`, `PLAN_SEP_FRAC_CONFERROS_1241` | 🟡 |
| **Cortes** (faturado × conferido) | Harpia `PLAN_SEP_MAPA_MERC_1196` | 🟡 |
| Picking vazio (abastecimento negativo) | Harpia `HIST_ABAST_NEG_END_849` | 🟡 |
| Avarias | Harpia `DANIF_161`/`DANIF_MERC_163` | 🟡 |
| Ajustes manuais de estoque | Harpia `MODIF_MANUAL_END_490` | 🟡 |

A ligação que mais vale: **erro de separação → devolução logística**. Mostra o custo do erro, não só a contagem.

---

## 4. Desempenho dos colaboradores — por função

Comparar pessoas só dentro da mesma função. Empilhadeira e chão têm ritmos diferentes por natureza.

| Função | Métrica principal | Fonte | Status |
|---|---|---|---|
| Operador de empilhadeira | movimentos verticais por dia trabalhado | `MOVIMENT_END_502` | ✅ (falta separar por função) |
| Movimentação no chão | movimentos horizontais por dia | `MOVIMENT_END_502` | ✅ (idem) |
| Separador | linhas por hora · % de erro | `PLAN_SEP_COLETOR_1275/1276` + erros | 🟡 depende do uso de coletor |
| Conferente | volumes conferidos · divergências achadas | `PLAN_SEP_VOL_CONFERROS_1240` | 🟡 |
| Motorista | entregas/dia · taxa de devolução | WinThor | ✅ parcial |
| Todos | faltas e custo | Supabase (efetivo/faltas) | ✅ |

Pendências de cadastro (decisão do gestor): quem é de qual função; logins duplicados da mesma pessoa;
logins de setor/sistema ("EXPEDIÇÃO", "CONFERENTE") que não são uma pessoa.

---

## 5. Eficiência e custo

| Indicador | Fonte | Status |
|---|---|---|
| Custo logístico ÷ faturamento | Supabase custos + WinThor | ✅ dashboard |
| Custo por tonelada / por entrega | idem | 🟢 |
| Movimentos por tonelada | Harpia + WinThor | ✅ /galpao |
| Ocupação do pulmão | Harpia `DEPOSIT_EMPRESA_END_179` | ✅ /galpao |
| Cargas por viagem | Harpia `CARREG_VEIC_38` | ✅ /galpao |

---

## 6. Ordem de construção

1. **Ciclo do pedido** — rodar a descoberta, montar a linha do tempo com as etapas que têm hora. É a pergunta
   central ("quanto tempo demora") e hoje não existe no app.
2. **Qualidade do armazém** — erro de separação e cortes, cruzados com devolução logística.
3. **Pessoas por função** — separar o ranking por função, juntar logins duplicados, excluir logins de setor.
4. **Metas** — depois de 3 meses de série, meta = melhorar a própria mediana; nada de referência de mercado inventada.

Painel do gestor = no máximo 6 números no topo: lead time (P90), % D+1, taxa de devolução logística,
% erro de separação, custo logístico/faturamento, movimentos por tonelada. O resto é detalhe para investigar.

---

## Onde está no app

Aba **Gestão** em `/galpao?aba=gestao&mes=`. Compara o mês com o anterior e com o mesmo mês
do ano passado, lendo **só esses 3 meses**. A evolução de 13 meses carrega apenas no botão
"Carregar evolução" (`&evolucao=1`), porque meses ainda não guardados no Supabase são
calculados no WinThor um a um. O que se provar importante sobe depois para o Dashboard.

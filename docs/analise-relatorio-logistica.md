# Análise — Evolução do Relatório de Logística

> Levantamento do que já existe, do que dá para construir com segurança usando **dados reais confirmados**, e do que depende de dados ainda não mapeados. Escrito **antes de qualquer alteração**, para servir de base de decisão.
>
> **Data:** 2026-08-03 · **Escopo:** filiais 1 + 11 consolidadas (rotina 111).

---

## ⚠️ Dois limites que condicionam TODA a análise

**1. O schema real do WinThor não é verificável daqui.** O Oracle é interno (só responde dentro da rede da empresa). A única fonte confiável do que existe é **o que o projeto já consulta**. Tudo além disso está marcado como **🟡 NÃO VERIFICADO — checar na rede**, nunca como fato. Isto atende diretamente à sua regra "não suponha que um dado existe sem verificar".

**2. Mesmo o que é "construível agora" só renderiza na rede.** Como o Oracle é interno, qualquer indicador novo puxado do WinThor mostrará "indisponível" fora da rede — igual ao faturamento/devoluções hoje. Os indicadores que vêm do **Supabase** (snapshots, custos, receitas) funcionam em qualquer lugar.

**Legenda de status de dado:**
- 🟢 **CONFIRMADO** — o projeto já lê essa tabela/coluna; construível com segurança.
- 🟡 **NÃO VERIFICADO** — é padrão do WinThor e provavelmente existe, mas este projeto nunca consultou; exige validar na rede antes de prometer.
- 🔴 **AUSENTE / NÃO CAPTURADO** — depende de dado que a operação provavelmente não registra (ex.: confirmação de entrega) ou de módulo não instalado; não construir sem uma fonte real.

---

## 1. Resumo do que já existe

**Telas atuais:** Dashboard (Visão Geral), Receitas, Custos, Devoluções, Tendências, Setores, Funcionários.

**Filtro mensal** (recém-criado) em Dashboard/Receitas/Custos/Devoluções: abre no mês atual, navega de julho/2026 até o mês corrente, persiste ao trocar de tela. Faturamento de mês fechado vem de snapshot congelado; devoluções vêm do Oracle ao vivo por intervalo.

**Indicadores já calculados:**

| Tela | Indicadores |
|---|---|
| **Dashboard** | Venda líquida, valor devolução, PDVs atendidos, peso faturado, NFs emitidas, taxa devolução (valor e notas), custo logístico %, custo bruto e líquido do mês, funcionários ativos, faltas, custo por setor, efetivo por setor, composição (salário/fixos/variáveis) |
| **Devoluções** | Total devolvido, devolução por setor responsável (Logística/Comercial/Faturamento), por motivo, top clientes, por motorista (expedidas/devolvidas/taxa/valor), devolução avulsa, taxa por valor e por nota |
| **Receitas** | Descarregamentos por tipo/fornecedor/dia, toneladas, reciclagem, total do dia |
| **Custos** | Custos fixos, variáveis, salário do efetivo, total do mês, composição |
| **Tendências** | Série de 12 meses (venda líquida, valor devolvido, peso devolvido, taxa de devolução, PDVs atendidos), comparar 2 meses, top 5 meses por devolução, variação vs. mês anterior e vs. média |

---

## 2. Dados disponíveis no banco

### 2.1. WinThor / Oracle — 🟢 CONFIRMADO (objetos e colunas que o projeto já lê)

| Objeto | Colunas em uso | Serve para |
|---|---|---|
| `PCNFSAID` (NF de saída) | `NUMTRANSVENDA`, `NUMNOTA`, `NUMCAR`, `CODFILIAL`, `DTSAIDA`, `DTCANCEL`, `CODCLI`, `CONDVENDA`, `TIPOVENDA` (VP/VV) | Vendas, NFs, clientes, vínculo com carga |
| `PCMOV` (movimento de item) | `CODFILIAL`, `DTMOV`, `CODOPER` (S/ED), `DTCANCEL`, `NUMTRANSENT`, `NUMTRANSVENDA`, `PUNIT`, `ST`, `QT`, `PESOBRUTO`, `NUMNOTA` | Peso, valor líquido item a item, devoluções (ED) |
| `PCNFENT` (NF de entrada) | `NUMTRANSENT`, `CODDEVOL` | Notas de devolução e seu motivo |
| `PCESTCOM` | `NUMTRANSENT`, `NUMTRANSVENDA` | Vínculo devolução ↔ venda de origem |
| `PCTABDEV` | `CODDEVOL`, `MOTIVO` | Descrição do motivo de devolução |
| `PCCLIENT` | `CODCLI`, `CLIENTE` | Nome do cliente |
| `PCCARREG` (carga) | `NUMCAR`, `CODMOTORISTA` | Motorista da carga *(demais colunas não lidas)* |
| `PCEMPR` | `MATRICULA`, `NOME` | Nome do motorista |
| `VIEW_BI_FATURAMENTO` | `CODFILIAL`, `DTSAIDA`, `VENDAS`, `DEVOLUCAO`, `AVULSA` | Valores oficiais (deduzem ST/IPI/bonif/avulsa) |

**Datas — já tratadas corretamente (atende à regra de "data certa"):** venda/faturamento por `DTSAIDA`; devolução por `DTMOV` do movimento `ED` (data da devolução, não da venda); canceladas excluídas por `DTCANCEL IS NULL`. Devolução avulsa (`NUMTRANSVENDA = 0`) é isolada, como o 111 faz.

### 2.2. Supabase (local, sempre disponível, gravável)

| Tabela | Conteúdo |
|---|---|
| `faturamento_mensal` | Snapshot congelado por mês+filial: venda faturada/líquida, devolução, avulsa, devolvidas, peso faturado/devolvido, emitidas, positivados, atendimentos |
| `custos_fixos`, `custos_mensais` | Custos por mês: `tipo` fixo/variável, `nome` (texto livre), `valor`, `data` |
| `funcionarios`, `setores`, `faltas` | Efetivo (custo mensal, status, setor), faltas datadas por tipo |
| `receitas_descarregamento*`, `receitas_diversas`, `fornecedores`, `precos_descarregamento` | Receitas logísticas |
| `profiles` | RBAC (admin/viewer) |

---

## 3. Indicadores que podem ser criados IMEDIATAMENTE (dados 🟢 confirmados)

Estes usam **exclusivamente** o que o projeto já lê. Nenhum inventa tabela/coluna.

| Indicador | Fórmula | Origem | Observação |
|---|---|---|---|
| **Ticket médio por nota** | `venda faturada ÷ NFs emitidas` | ambos já calculados | Trivial. *"Por pedido" ≠ "por nota"* — ver §4 |
| **Valor médio por PDV atendido** | `venda líquida ÷ atendimentos` | já calculados | |
| **Peso médio por nota** | `peso faturado ÷ NFs emitidas` | já calculados | |
| **Quantidade de cargas** | `COUNT(DISTINCT NUMCAR)` no período | `PCNFSAID.NUMCAR` 🟢 | |
| **NFs por carga (média)** | `NFs emitidas ÷ nº de cargas` | `PCNFSAID` 🟢 | |
| **Clientes por carga (média)** | `COUNT(DISTINCT CODCLI) ÷ nº cargas` | `PCNFSAID` 🟢 | |
| **Peso e valor por carga** | soma de peso (`PCMOV`) e valor (`VIEW_BI`) agrupados por `NUMCAR` | 🟢 | Base para "cargas com baixa ocupação" *em peso* (não em m³) |
| **Produtos mais devolvidos** | soma do líquido de devolução por `CODPROD` (mesma CTE `ED` já existente) | `PCMOV.CODPROD` 🟢 + nome `PCPRODUT` 🟡 | **Alto valor.** Se `PCPRODUT` não validar, mostra o código |
| **% devolução sobre faturamento (mensal)** | `valor devolução ÷ venda faturada` | `faturamento_mensal` 🟢 | Já existe pontual; falta a **evolução** |
| **Evolução mensal das devoluções** | série de `valor_devolucao` por mês | `faturamento_mensal` 🟢 | Snapshot já guarda |
| **Faturado × devolvido (comparativo)** | duas séries no mesmo eixo | `faturamento_mensal` 🟢 | |
| **Margem após custo logístico** | `venda líquida − custo total do mês` | Supabase 🟢 | Custo já somado no dashboard |
| **Receita × devolução × custo** | três séries mensais | `faturamento_mensal` + `custos_mensais` 🟢 | |
| **Variação % e ranking (melhores/piores meses)** | `(atual − anterior) ÷ anterior` | séries existentes 🟢 | Fundação em Tendências já existe |

**Comparativos temporais construíveis agora:** dia (dentro do mês), mês, mês vs. mês anterior. ⚠️ **"Mesmo mês do ano anterior" só a partir de julho/2027** — o histórico começa em julho/2026.

---

## 4. Indicadores que precisam de novos dados (ou de verificação na rede)

### 4.1. 🟡 Plausível no WinThor, mas NÃO verificado — precisa checar na rede antes de prometer

| Área | O que falta confirmar | Tabela/coluna candidata |
|---|---|---|
| **Total de pedidos, ticket por pedido, pedidos por carga, pedidos pendentes** | Se a operação usa pedido e se está populado | `PCPEDC`, `PCPEDI` 🟡 |
| **Vendedor com maior devolução/venda** | Código do vendedor na NF | `PCNFSAID.CODUSUR` 🟡 + nome `PCUSUARI` |
| **Cidade / região / rota** | Geo do cliente e rota | `PCCLIENT.MUNICENT/CODCIDADE/ESTADO`, `CODROTA`/`PCPRACA` 🟡 |
| **Status e tempos da carga** (montada/faturada/liberada/em rota; montagem→faturamento→saída) | Datas e posição da carga | `PCCARREG.DATA/DATASAIDA/POSICAO` 🟡 |
| **Veículo, custo por veículo, capacidade** | Vínculo carga↔veículo e capacidade cadastrada | `PCCARREG.CODVEICULO`, `PCVEICUL` 🟡 |
| **Aproveitamento de capacidade (m³/kg)** | Capacidade do veículo + volume da carga | `PCVEICUL.CAPACIDADE*` 🟡 |

### 4.2. 🔴 Depende de dado provavelmente NÃO capturado — não construir sem fonte real

| Área | Por que é bloqueado |
|---|---|
| **OTIF, % no prazo, % atrasadas, tempo de entrega, faturamento→entrega** | Exigem **data prometida** e **data de entrega real**. O WinThor core não registra confirmação de entrega sem módulo de **roteirização/TMS** ou canhoto eletrônico. **Nenhum dado desses está mapeado.** Sem uma fonte confirmada, é impossível — e não deve ser estimado. |
| **1ª tentativa, entregas não realizadas, motivos de insucesso** | Mesma origem (execução de entrega). Não capturado. |
| **Estoque:** giro, cobertura, ruptura, validade, acuracidade, divergência de inventário | Exigem `PCEST`/`PCPRODUT`/inventário 🟡–🔴 — nenhum consultado hoje; escopo grande; validar se a filial mantém estoque no WinThor. |
| **Separação:** produtividade, tempo, erros, pedidos por operador | Exige WMS/coletor. Não mapeado. |
| **Custo por km, combustível/manutenção/frete/pedágio estruturados** | `custos_mensais` hoje é texto livre; não há categoria estruturada nem km. Precisa de **nova captura** (local) — ver §5. |
| **Metas × realizado** | Não existe tabela de metas. Precisa de **nova tabela local** simples. |
| **Taxa de recuperação de devolvidos** | Exige destinação do produto devolvido (revenda/descarte/avaria) — não registrado. |

---

## 5. Sugestões por prioridade

### 🔴 Prioridade ALTA — construível já, alto valor, dados confirmados

1. **Aba "Cargas e Expedição" (básica):** nº de cargas, NFs/carga, clientes/carga, peso/valor por carga, tabela de cargas com peso e valor. → só `PCNFSAID` + `PCMOV`.
2. **Devolução por PRODUTO** (top devolvidos, valor e qtd) — reaproveita a CTE `ED` existente + `PCMOV.CODPROD`. Altíssimo valor de ação.
3. **Médias operacionais no Dashboard:** ticket médio/nota, valor médio/PDV, peso médio/nota. → zero dado novo.
4. **Devoluções — visão de evolução:** série mensal de devolução, faturado × devolvido, % sobre faturamento ao longo dos meses. → `faturamento_mensal`.
5. **Análise Financeira (aba):** receita × devolução × custo, margem após custo logístico, custo logístico % mês a mês. → Supabase.

### 🟡 Prioridade MÉDIA — depende de 1 verificação na rede (barata)

6. **Devolução por vendedor** (`PCNFSAID.CODUSUR`) — confirmar coluna.
7. **Recortes por cidade/região/rota** — confirmar geo em `PCCLIENT` e rota.
8. **Status e tempos de carga** (montagem→faturamento→saída, cargas paradas) — confirmar colunas de `PCCARREG`. Desbloqueia boa parte de "Cargas e Expedição" e o alerta de "cargas paradas".
9. **Custos logísticos estruturados** (nova categorização local: combustível, manutenção, frete, pedágio, diária) — transforma o texto livre em categorias; habilita custo/carga, custo/entrega, evolução por categoria. É trabalho **local**, sem depender do Oracle.

### 🟢 Prioridade BAIXA — escopo grande ou valor incremental

10. **Estoque/armazenagem** — só após confirmar `PCEST`/`PCPRODUT` e decidir escopo.
11. **Metas × realizado** — nova tabela local + telas de meta.
12. **Comparativo anual (YoY)** — só faz sentido a partir de jul/2027.

### ❌ Não recomendado agora
- **OTIF / desempenho de entregas** enquanto não houver fonte real de data de entrega. Prometer isso sem o dado seria inventar — contra sua própria regra.

---

## 6 e 7. Fórmulas e origem

Consolidados nas tabelas das §3 e §4 (coluna *Fórmula* e coluna *Origem*), para não duplicar. Todo indicador ali tem fórmula explícita e a tabela/coluna de origem com status 🟢/🟡/🔴.

---

## 8. Riscos de duplicidade e inconsistência (a vigiar em qualquer implementação)

1. **Item × nota × carga × devolução — não somar no nível errado.** `PCMOV` é item a item; `PCNFSAID` é nota; a carga agrupa notas. Somar peso/valor exige agregar no nível certo (o código atual já pré-agrega `NUMTRANSENT` para não multiplicar itens — manter esse cuidado).
2. **Valor "oficial" vem da `VIEW_BI_FATURAMENTO`, não da soma de itens.** As contagens (emitidas, positivados) e o peso vêm de `PCNFSAID`/`PCMOV`. **Misturar as duas fontes num mesmo total pode divergir do 111.** Regra do projeto: valores oficiais = view; contagens/peso = tabelas base. Não trocar.
3. **Devolução avulsa** (`NUMTRANSVENDA = 0`) precisa continuar isolada — não entra nas quebras por cliente/motorista/produto (não tem venda de origem).
4. **Data:** faturamento por `DTSAIDA`, devolução por `DTMOV` do `ED`. Cruzar devolução com a venda de origem (para "por motorista/produto") atribui a devolução à **carga/venda original**, mas conta pela **data da devolução** — manter essa separação explícita.
5. **Snapshot × ao vivo:** `faturamento_mensal` guarda só totais. Quebras (produto, cliente, motorista, setor) de meses fechados só existem via Oracle ao vivo — na rede. Se um card histórico precisar de quebra, decidir entre consultar ao vivo ou **expandir o snapshot** (mais tabelas).
6. **Parcialidade:** pedidos/notas parcialmente entregues ou devolvidos — o modelo atual trata devolução por valor líquido do item, o que já é parcial-safe; qualquer indicador de "pedido completo" (OTIF) esbarra na ausência de dado de entrega.
7. **Filial:** tudo é 1+11 consolidado. Um recorte "por filial" precisa desfazer a consolidação com cuidado (o snapshot usa a chave `filial = '1+11'`).

---

## 9. Estrutura sugerida para as telas

Manter o padrão atual (cards + navy/âmbar; **verde só para receita**) e o filtro mensal persistente em todas as abas novas. Organização em abas, sem poluir:

1. **Visão Geral** — já existe; acrescentar médias operacionais (§5.3) e nº de cargas.
2. **Entregas** — ⚠️ só criar quando/se houver fonte de entrega; senão, **não criar aba vazia**.
3. **Cargas e Expedição** — nova; começa com o que é confirmado (§5.1) e cresce após verificar `PCCARREG` (§5.8).
4. **Devoluções** — já existe; acrescentar **por produto** (§5.2) e **evolução** (§5.4).
5. **Custos** — já existe; evoluir para categorias estruturadas (§5.9).
6. **Motoristas e Veículos** — motorista já existe em Devoluções; veículo depende de verificação.
7. **Rotas e Regiões** — depende de verificação de geo/rota.
8. **Estoque e Armazenagem** — só após confirmar fonte.
9. **Análise Financeira** — nova; construível já (§5.5).
10. **Alertas e Oportunidades** — regras sobre indicadores que existirem (devolução acima da média, custo acima da média, cargas paradas *quando houver status*).

**Componentes:** cards para números-chave; barras para comparação e ranking; linha para evolução; composição só quando trivial de ler; tabelas para detalhe; badge de variação ↑/↓; tooltips por indicador; drill-down (abrir detalhe de um número). Reaproveitar `MesNav`, `BarList`, `StatCard`, `EvolucaoChart` já existentes.

---

## 10. Plano de implementação por etapas

**Etapa 0 — Verificação na rede (você, ~30 min, sem código):** rodar 4 consultas de checagem no WinThor e me dizer o resultado: (a) `PCPEDC` existe e tem dados no período? (b) `PCNFSAID.CODUSUR` populado? (c) `PCCARREG` tem `DATA/DATASAIDA/POSICAO/CODVEICULO`? (d) `PCPRODUT` acessível para nome de produto? Isso desbloqueia a prioridade MÉDIA sem chute. *(Posso te entregar as 4 queries prontas.)*

**Etapa 1 — Ganhos ALTOS, dados confirmados (sem depender da Etapa 0):**
- 1a. Médias operacionais no Dashboard (§5.3).
- 1b. Devolução por produto (§5.2).
- 1c. Aba "Análise Financeira" (§5.5) + evolução de devoluções (§5.4).
- 1d. Aba "Cargas e Expedição" básica (§5.1).

**Etapa 2 — Após Etapa 0 confirmar:** vendedor, cidade/região/rota, status/tempos de carga, alerta de cargas paradas.

**Etapa 3 — Trabalho local (independe do Oracle):** custos logísticos estruturados (§5.9) e, se quiser, metas × realizado.

**Etapa 4 — Escopo grande, só com fonte confirmada:** estoque/armazenagem; entregas/OTIF apenas se surgir fonte real de entrega.

**Regras mantidas em todas as etapas:** preservar cálculos e telas atuais; filtro mensal (jul→atual, abre no mês corrente, persiste entre abas); nunca inventar tabela/coluna; validar cada número contra a rotina do WinThor antes de fechar.

---

### Recomendação

Começar pela **Etapa 1** — são quatro entregas de alto valor que usam **apenas dados já confirmados**, sem depender de acesso à rede para serem escritas (só para renderizar com dados reais, como tudo do WinThor hoje). Em paralelo, rodar a **Etapa 0** para desbloquear a Etapa 2 com segurança.

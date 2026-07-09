# Backlog — Centro de Controle Logística

Itens combinados para fazer **quando os créditos voltarem**. Nada aqui foi implementado ainda.

---

## 1. Separar SETOR de TURNO + filtro por turno  🔜 (prioridade do Pedro)

**Decisão de design (definida com o Pedro):** setor e turno são **duas dimensões separadas**.
- `setor` = a ÁREA onde a pessoa atua (ex: Depósito, Entrega...), independente do horário.
- `turno` = QUANDO ela trabalha — campo próprio no funcionário.
Assim dá pra cruzar: custo do Depósito inteiro, custo só do turno da manhã, ou custo do Depósito NO turno da noite.

**Problema atual:** na importação da planilha, o turno ficou embutido no nome do setor
("Depósito Manhã" e "Noite" viraram setores separados). Isso precisa ser desfeito.

**Turnos:**
- **Manhã:** 07:00 às 17:00
- **Tarde:** 13:00 às 22:00
- **Noite:** 22:00 às 07:00

**⛔ BLOQUEADO — esperando input do Pedro:** a equipe dele está preenchendo, na planilha,
o **setor real de cada uma das ~247 pessoas** (uma coluna de setor por funcionário). Só
retomar quando a planilha voltar com essa coluna. NÃO implementar antes disso.

**O que fazer quando a planilha voltar:**
- Ver quais são os setores reais (valores distintos da nova coluna) e decidir a lista final de setores.
- Adicionar campo `turno` na tabela `funcionarios` (enum: `manha` / `tarde` / `noite`). Nova migration.
- Re-mapear/reclassificar cada funcionário: setor correto + turno correto (a partir da planilha atualizada — provavelmente um novo script de UPDATE, ou re-import limpo).
- Adicionar `turno` no tipo de domínio `Funcionario` e no `mapFuncionario`.
- Adicionar `turno` no formulário de funcionário (`funcionario-form.tsx`) — `<select>`.
- Métricas por turno (puras em `src/domain/metrics.ts`, com testes): custo e headcount por turno, filtráveis por setor.
- Breakdown por turno no **detalhe do setor** + **filtro por turno** na lista de funcionários. Considerar no dashboard também.
- Limpar os setores antigos ("Depósito Manhã", "Noite" etc.) depois da migração.

---

## 2. Aprimorar o front-end  (fazer só depois de tudo funcional)

Passar por uma etapa de melhoria visual/UX depois que as funcionalidades estiverem fechadas. Hoje o visual é funcional mas cru (Tailwind básico). Usar a skill `frontend-design` quando chegar a hora. **Explícito do Pedro:** primeiro finalizar tudo certinho, depois cuidar do front.

---

## 3. Não exibir contagem de DESLIGADOS nas visões de setor

Hoje os cards de setor e o detalhe do setor mostram "X ativos · Y afastados · Z desligados". O número de **desligados só cresce** conforme demite gente, então não é uma métrica útil de "pulso do setor".

**O que fazer:**
- Remover a contagem de `desligados` da exibição em `src/app/(app)/setores/page.tsx` (cards) e `src/app/(app)/setores/[id]/page.tsx` (detalhe). Mostrar só **ativos** (e possivelmente afastados).
- **Manter** o status `desligado` no registro individual do funcionário (necessário pro histórico e pra excluir do custo) — a mudança é só não somar/exibir o agregado que só cresce.
- A função `headcountPorStatus` pode continuar existindo; é só a **exibição** que muda.

---

## Outros follow-ups técnicos (não bloqueiam, do review final)
- Adicionar `<label>`s nos inputs do formulário de funcionário (acessibilidade).
- Endurecer o guard de login: `pathname === "/login"` em vez de `startsWith("/login")`.
- Decidir e ligar UI de **excluir funcionário / excluir setor** (as Server Actions já existem, mas não têm botão na tela ainda).

## Follow-ups do módulo de custos (não bloqueiam; baixa prioridade p/ 1 usuário)
- **Estado "mês aberto" explícito**: hoje o "mês aberto" é inferido de `fixos.length > 0`. Isso causa dois cantos: (a) se apagar todos os fixos de um mês já aberto, o botão "Abrir mês" reaparece e reinsere; (b) risco teórico de corrida se dois cliques/abas concorrentes passarem pela verificação de idempotência (o clique-duplo já foi mitigado desabilitando o botão). Solução ideal: marcar o mês como aberto explicitamente (coluna/sentinela) ou índice único parcial `unique (mes, nome) where tipo='fixo'` + upsert ignoreDuplicates. Exige nova migration.
- **"Abrir mês" sem fixos cadastrados**: vira no-op silencioso; mostrar mensagem apontando pra /custos/fixos.

## Integração Winthor — faturamento no dashboard  🔜 (em andamento; pausado por rede)

**Objetivo:** puxar do Winthor (Oracle) e mostrar no dashboard, referentes ao **mês corrente
(do 1º dia até HOJE — mês em andamento)**, os indicadores + derivados:
- Total positivados, NFs emitidas, NFs devolvidas, Venda líquida, Valor devolução,
  Peso faturado (kg), Peso devol. avulsa (kg).
- **Taxa de devolução** e **% do custo logístico sobre o faturamento líquido** (custo total do
  mês / venda líquida).

**Conexão (PRONTA):** `oracledb` v7 thin mode. Módulo `src/lib/oracle/client.ts` (`queryWinthor`).
Credenciais em `.env.local` como `DB_HOST/DB_PORT/DB_SERVICE/DB_USER/DB_PASSWORD` (usuário
`diaread`, somente leitura). Teste: `node --env-file=.env.local scripts/test-oracle.mjs`.
⚠️ O host só responde de dentro da **rede/VPN da empresa** (deu timeout fora). Conexão já foi
validada com sucesso quando na rede.

**Fonte dos números (DECIFRADA):** a rotina 111 (Resumo do Faturamento) usa a função Oracle
**`FUNC_RESUMOFATURAMENTO`**, chamada assim:
`SELECT * FROM table(CAST(FUNC_RESUMOFATURAMENTO(<54 params>) as tabela_faturamento))`.
Do log `~/Downloads/LOG 111 JEITO CERTO.log` extraí os **54 binds exatos** (filial `'1','11'`,
período, e ~50 flags: deduzir Devol/ST/IPI/FECP, tipo venda 1, etc.). O script de extração +
chamada está em `scripts/_tmp_call_resumo.mjs` (auto-extrai os binds do log; NÃO commitado —
depende do log local). `params=54 = binds=54` ✅.

**Valores-alvo pra conferir (período 01→08/07/2026, filial 1,11):** positivados 2.526,
emitidas 5.930, devolvidas 645, venda líquida 10.639.574,87, valor devolução 532.280,33,
peso faturado 549.069,22 kg, peso devol. avulsa 1.952,70 kg.

**Próximos passos (quando o banco estiver acessível — amanhã):**
1. Rodar `scripts/_tmp_call_resumo.mjs` → ver as COLUNAS de retorno da função e conferir vs alvos.
2. Trocar o período pros do mês corrente (1º dia → hoje) e um único conjunto de binds parametrizável.
3. Criar `src/data/faturamento.ts` (usa `queryWinthor`) retornando os 7 indicadores do mês.
4. Cards no dashboard + taxa de devolução + % custo logístico / venda líquida.
5. Deploy: lembrar que Oracle é on-premise (Vercel precisaria de túnel/VPN).

## Próximo módulo grande
- **Módulo de custos** (fixos: galpão, empilhadeira, paleteira, aluguel de 2 casas; variáveis: filme stretch, salário, frete, gasolina). Salário deve reusar o `custo_mensal` dos funcionários, não recadastrar.
- Depois: **módulo de rendimentos**.

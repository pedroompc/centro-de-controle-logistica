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

## Próximo módulo grande
- **Módulo de custos** (fixos: galpão, empilhadeira, paleteira, aluguel de 2 casas; variáveis: filme stretch, salário, frete, gasolina). Salário deve reusar o `custo_mensal` dos funcionários, não recadastrar.
- Depois: **módulo de rendimentos**.

# Backlog — Centro de Controle Logística

Itens combinados para fazer **quando os créditos voltarem**. Nada aqui foi implementado ainda.

---

## 1. Filtro / dimensão de TURNO nos setores  🔜 (prioridade do Pedro)

Cada setor tem equipe em três turnos. Pedro quer saber **quanto custa e quantas pessoas** tem em cada turno.

**Turnos:**
- **Manhã:** 07:00 às 17:00
- **Tarde:** 13:00 às 22:00
- **Noite:** 22:00 às 07:00

**O que fazer (esboço):**
- Adicionar campo `turno` na tabela `funcionarios` (enum: `manha` / `tarde` / `noite`). Nova migration.
- Adicionar `turno` no tipo de domínio `Funcionario` e no `mapFuncionario`.
- Adicionar o campo no formulário de funcionário (`funcionario-form.tsx`) — `<select>` de turno.
- Métricas por turno (funções puras em `src/domain/metrics.ts`, com testes): custo por turno e headcount por turno, filtráveis por setor.
- Mostrar breakdown por turno no **detalhe do setor** e permitir **filtrar funcionários por turno** na lista.
- Considerar mostrar no dashboard também (custo por turno geral).

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

## Próximo módulo grande
- **Módulo de custos** (fixos: galpão, empilhadeira, paleteira, aluguel de 2 casas; variáveis: filme stretch, salário, frete, gasolina). Salário deve reusar o `custo_mensal` dos funcionários, não recadastrar.
- Depois: **módulo de rendimentos**.

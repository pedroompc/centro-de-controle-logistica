-- PDVs atendidos por mês no snapshot de faturamento.
--
-- atendimentos = clientes distintos POR DIA (mesmo PDV em 2 dias = 2; várias
-- notas no mesmo dia = 1). É diferente de `positivados` (clientes distintos no
-- mês inteiro), que já existe e continua.
--
-- Nullable de propósito: os meses já congelados não têm esse número e só serão
-- preenchidos pelo backfill (scripts/backfill-atendimentos.mjs, que emite os
-- UPDATE para rodar aqui no SQL Editor). NULL = ainda não computado. Os meses
-- que fecharem a partir daqui gravam o valor automaticamente pelo app.
alter table faturamento_mensal
  add column atendimentos int;

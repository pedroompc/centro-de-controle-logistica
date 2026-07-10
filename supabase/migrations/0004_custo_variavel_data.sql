-- Data do lançamento para custos variáveis (fixos permanecem sem data — são
-- mensais/recorrentes). Nullable: lançamentos antigos ficam sem data.
alter table custos_mensais add column data date;

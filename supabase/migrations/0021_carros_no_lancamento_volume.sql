-- Carros do lançamento de Volume. O Volume é cobrado por caixa, mas também
-- chega de caminhão: o lançamento passa a dizer em quantos carros vieram as
-- caixas. NULL = não informado (lançamentos antigos) e conta como 1 carro.
-- Só o Volume usa; nos outros tipos cada lançamento segue sendo 1 carro.
alter table receitas_descarregamento
  add column if not exists carros integer;

-- ADD CONSTRAINT não tem IF NOT EXISTS; o drop-if-exists antes torna idempotente.
alter table receitas_descarregamento drop constraint if exists receitas_desc_carros_nao_neg;
alter table receitas_descarregamento
  add constraint receitas_desc_carros_nao_neg check (carros is null or carros >= 0);

-- Lançamento de descarrego por CARRO, carga isenta (FOB) e Volume com valor fechado.
--
-- carro_id: notas que vieram no mesmo caminhão compartilham o id. Só uma nota
--   do carro conta o carro (`carros` = 1); as outras ficam com `carros` = 0.
--   Assim tudo que já soma `carros` (painel, BI, tendência) conta caminhão, não
--   nota. Lançamentos antigos ficam com carro_id NULL e seguem 1 nota = 1 carro.
-- isento: carga FOB descarregada sem cobrança — receita 0, mas conta peso e carro.
-- valor_fechado: Volume cobrado por um valor total digitado, não caixas × R$/caixa.
--
-- Aditiva e idempotente.
alter table receitas_descarregamento
  add column if not exists carro_id uuid,
  add column if not exists isento boolean not null default false,
  add column if not exists valor_fechado boolean not null default false;

create index if not exists receitas_desc_carro_idx on receitas_descarregamento(carro_id);

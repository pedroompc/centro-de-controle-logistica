-- Quebra por tipo no total do dia simplificado: quantos carros de cada tipo.
--
-- Antes o total do dia guardava só `descarregos` (total do dia, sem tipo). Agora
-- o lançamento informa quantos carros foram batido/paletizado/pal_rem/volume, e
-- `descarregos` passa a ser a SOMA desses quatro. Só quantidade (carros), não R$
-- — um total do dia tem um valor único, que não se fatia por tipo.
--
-- Nullable: os registros já lançados não têm a quebra e nunca terão retroativa
-- (não dá pra saber quantos de cada tipo foram naquele dia). NULL nos quatro =
-- "sem detalhamento". Lançamentos novos gravam os quatro (0 onde não houve).
alter table receitas_descarregamento_diario
  add column qtd_batido     int check (qtd_batido >= 0),
  add column qtd_paletizado int check (qtd_paletizado >= 0),
  add column qtd_pal_rem     int check (qtd_pal_rem >= 0),
  add column qtd_volume      int check (qtd_volume >= 0);

-- 4º tipo de descarregamento: Volume, cobrado por caixas (quantidade ×
-- preço/caixa), não por peso. Registra peso como os outros, mas o valor vem da
-- contagem de caixas. Colunas próprias porque a base de cobrança é nova.

-- ALTER TYPE ... ADD VALUE não pode ser usado na mesma transação que insere
-- usando o valor novo. Daí o commit explícito antes do INSERT abaixo (mesma
-- forma da 0007).
alter type descarregamento_tipo add value if not exists 'volume';
commit;

alter table receitas_descarregamento
  add column if not exists quantidade integer,
  add column if not exists preco_por_unidade numeric(14,2);

-- ADD CONSTRAINT não tem IF NOT EXISTS; o drop-if-exists antes torna idempotente.
alter table receitas_descarregamento drop constraint if exists receitas_desc_quantidade_pos;
alter table receitas_descarregamento
  add constraint receitas_desc_quantidade_pos
  check (quantidade is null or quantidade > 0);

-- Preço/caixa padrão do Volume, configurável na página de Preços. preco_por_tonelada
-- fica 0 no Volume (n/a), mesmo padrão do pal_rem.
alter table precos_descarregamento add column if not exists preco_por_unidade numeric(14,2);
insert into precos_descarregamento (tipo, preco_por_tonelada, preco_por_unidade)
  values ('volume', 0, 0)
  on conflict (tipo) do nothing;

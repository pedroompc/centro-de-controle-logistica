-- Self-heal da foto mensal: libera o UPDATE de `faturamento_mensal` para qualquer
-- usuário autenticado (antes era só admin).
--
-- Motivo: a foto é CACHE DERIVADO gerado pelo sistema, não dado de usuário. O app
-- recalcula o mês ao vivo do Winthor (rotina 111) e SOBRESCREVE a foto sempre que
-- o valor diverge — ex.: uma devolução lançada com data retroativa cai num mês já
-- fechado. Esse upsert-que-sobrescreve (`congelarMes` em data/faturamento-mensal.ts)
-- é um UPDATE quando a linha já existe, então a RLS antiga (UPDATE só admin) barrava
-- silenciosamente a auto-cura para viewers: eles viam o número certo ao vivo, mas a
-- foto no Supabase (lastro do gráfico de Tendências e fallback offline) ficava velha.
--
-- Mesmo argumento que já libera o INSERT ao autenticado em 0005: idempotente pela PK,
-- derivado e reprodutível a partir do Winthor. Correção de dado de negócio continua
-- sendo no Winthor; aqui só se atualiza um cache. DELETE segue restrito a admin.

drop policy "update faturamento_mensal" on faturamento_mensal;

create policy "update faturamento_mensal" on faturamento_mensal
  for update to authenticated using (true) with check (true);

-- Backfill: aplica o mínimo de R$ 25,00 aos descarregamentos históricos.
--
-- CONTEXTO. A regra do mínimo não é nova na empresa — é nova no sistema. A Dia
-- sempre cobrou R$ 25,00 por descarrego cujo cálculo desse menos que isso; o
-- sistema é que registrava o valor calculado cru. Os lançamentos abaixo de 25
-- são, portanto, registros ERRADOS: divergem do que foi de fato faturado.
-- Este backfill corrige o sistema para bater com a realidade do faturamento.
--
-- Decidido pelo Pedro em 2026-07-20, revertendo conscientemente o "sem recálculo
-- retroativo" do spec original (que assumia, errado, que a regra era nova).
--
-- ESCOPO. Só toca linhas com minimo_aplicado = 0, ou seja, gravadas ANTES da
-- 0007. Linhas criadas depois já nasceram com o mínimo aplicado e por construção
-- não ficam abaixo dele.
--
-- O 25 está fixo de propósito, e não lido de config_descarregamento: esta é uma
-- correção histórica de um valor específico que vigorava nesta data. Se o mínimo
-- virar R$ 30 amanhã, esta migration NÃO deve passar a reescrever nada de novo.
--
-- Numa base nova (sem histórico) o UPDATE casa zero linhas — é no-op, não falha.

begin;

-- Backup da tabela antes de reescrever dinheiro. Fica no banco, com data no nome.
-- Para reverter:
--   update receitas_descarregamento r
--      set receita = b.receita, minimo_aplicado = b.minimo_aplicado
--     from backup_receitas_20260720 b
--    where r.id = b.id;
create table if not exists backup_receitas_20260720 as
  select * from receitas_descarregamento;

update receitas_descarregamento
   set receita = 25.00,
       minimo_aplicado = 25.00
 where minimo_aplicado = 0
   and receita < 25.00;

commit;

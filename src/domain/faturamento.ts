/**
 * Resumo de faturamento do Winthor (rotina 111), reconstruído a partir das
 * tabelas base (read-only). Todos os valores referentes ao período consultado,
 * para uma filial. Fórmulas conferidas contra a tela do 111:
 *   venda líquida = venda faturada − valor devolução
 *   taxa devolução = valor devolução / venda faturada
 */
export interface ResumoFaturamento {
  emitidas: number; // qtd de NFs emitidas (VP/VV, não canceladas)
  positivados: number; // clientes distintos que compraram
  devolvidas: number; // qtd de NFs de devolução
  vendaFaturada: number; // R$ bruto (após ST/IPI/repasse, antes de devolução)
  valorDevolucao: number; // R$ devolvido
  vendaLiquida: number; // R$ = vendaFaturada − valorDevolucao
  pesoFaturado: number; // kg líquido (venda − devolução)
  pesoDevolucao: number; // kg devolvido
}

/** Taxa de devolução (0..1) = valor devolvido / venda faturada. 0 se não houve venda. */
export function taxaDevolucao(
  r: Pick<ResumoFaturamento, "valorDevolucao" | "vendaFaturada">,
): number {
  if (r.vendaFaturada <= 0) return 0;
  return r.valorDevolucao / r.vendaFaturada;
}

/** % do custo logístico sobre a venda líquida (0..1). 0 se não houve venda líquida. */
export function percentualCustoLogistico(
  custoTotalMes: number,
  vendaLiquida: number,
): number {
  if (vendaLiquida <= 0) return 0;
  return custoTotalMes / vendaLiquida;
}

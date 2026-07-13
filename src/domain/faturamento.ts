/**
 * Resumo de faturamento do Winthor (rotina 111), reconstruído a partir das
 * tabelas base (read-only). Todos os valores referentes ao período consultado,
 * para uma filial. Fórmulas conferidas contra a tela do 111:
 *   venda líquida = venda faturada − valor devolução − devolução avulsa
 *   taxa devolução = valor devolução / venda faturada
 *
 * A devolução é sempre líquida (PUNIT − ST − IPI − repasse) e contada pela DATA
 * DA DEVOLUÇÃO — a mesma regra da rotina 111. A devolução "avulsa" (sem NF de
 * venda de origem) é separada do total, exatamente como o 111 faz na tela.
 */
export interface ResumoFaturamento {
  emitidas: number; // qtd de NFs emitidas (VP/VV, não canceladas)
  positivados: number; // clientes distintos que compraram
  devolvidas: number; // qtd de NFs de devolução vinculada (com venda de origem)
  devolvidasAvulsas: number; // qtd de NFs de devolução avulsa (sem venda de origem)
  vendaFaturada: number; // R$ bruto (após ST/IPI/repasse, antes de devolução)
  valorDevolucao: number; // R$ devolvido (vinculado) — é o número "oficial" do 111
  valorDevolucaoAvulsa: number; // R$ devolvido avulso (linha à parte no 111)
  vendaLiquida: number; // R$ = vendaFaturada − valorDevolucao − valorDevolucaoAvulsa
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

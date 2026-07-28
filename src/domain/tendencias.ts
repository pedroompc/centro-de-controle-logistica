import { primeiroDiaDoMes, mesAnterior } from "./periodo";

/** Ponto mensal do histórico de faturamento (uma foto da rotina 111). */
export interface PontoTendencia {
  mes: string; // 1º dia do mês, ISO
  vendaFaturada: number;
  vendaLiquida: number;
  valorDevolucao: number;
  valorDevolucaoAvulsa: number;
  devolvidas: number;
  devolvidasAvulsas: number;
  pesoFaturado: number;
  pesoDevolucao: number;
  emitidas: number;
  positivados: number; // clientes distintos no mês inteiro
  atendimentos: number; // PDVs atendidos = clientes distintos POR DIA
}

/** Últimos `qtd` meses FECHADOS (exclui o mês corrente), do mais antigo ao mais novo. */
export function mesesFechados(hoje: Date, qtd: number): string[] {
  let m = mesAnterior(primeiroDiaDoMes(hoje)); // começa no mês anterior ao corrente
  const lista: string[] = [];
  for (let i = 0; i < qtd; i++) {
    lista.push(m);
    m = mesAnterior(m);
  }
  return lista.reverse();
}

/** Taxa de devolução (0..1) = devolução / venda faturada. 0 se não houve venda. */
export function taxaDevolucaoMensal(
  p: Pick<PontoTendencia, "valorDevolucao" | "vendaFaturada">,
): number {
  if (p.vendaFaturada <= 0) return 0;
  return p.valorDevolucao / p.vendaFaturada;
}

export interface ResumoPeriodo {
  vendaLiquidaTotal: number;
  valorDevolucaoTotal: number;
  pesoDevolucaoTotal: number;
  taxaMedia: number; // 0..1, agregada: Σdevolução / Σvenda faturada
}

/** Totais do período + taxa média agregada (não a média das taxas mensais). */
export function resumoPeriodo(serie: PontoTendencia[]): ResumoPeriodo {
  const soma = (sel: (p: PontoTendencia) => number) => serie.reduce((t, p) => t + sel(p), 0);
  const faturado = soma((p) => p.vendaFaturada);
  const devolvido = soma((p) => p.valorDevolucao);
  return {
    vendaLiquidaTotal: soma((p) => p.vendaLiquida),
    valorDevolucaoTotal: devolvido,
    pesoDevolucaoTotal: soma((p) => p.pesoDevolucao),
    taxaMedia: faturado > 0 ? devolvido / faturado : 0,
  };
}

/** Variação relativa (fração, pode ser negativa): (atual − anterior) / anterior. */
export function variacaoPercentual(atual: number, anterior: number): number {
  if (anterior === 0) return 0;
  return (atual - anterior) / anterior;
}

/** Diferença em pontos percentuais entre duas taxas (cada uma 0..1). */
export function variacaoPP(atualFrac: number, anteriorFrac: number): number {
  return (atualFrac - anteriorFrac) * 100;
}

/** Média simples de uma lista (0 se vazia). */
export function media(valores: number[]): number {
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : 0;
}

/** Top `n` meses por valor de devolução (maior primeiro). */
export function topPorDevolucao(serie: PontoTendencia[], n: number): PontoTendencia[] {
  return [...serie].sort((a, b) => b.valorDevolucao - a.valorDevolucao).slice(0, n);
}

/**
 * Converte uma série de valores em pontos "x,y" para um <polyline> SVG.
 * Maior valor no topo, menor na base, respeitando o padding. Assume série sem
 * buracos (os pontos sem foto são filtrados antes de chamar).
 */
export function pontosLinha(
  valores: number[], largura: number, altura: number, pad = 4,
): { pontos: string; marcadores: { x: number; y: number; v: number }[] } {
  const min = valores.length ? Math.min(...valores) : 0;
  const max = valores.length ? Math.max(...valores) : 1;
  const span = max - min || 1;
  const n = valores.length;
  const stepX = n > 1 ? (largura - 2 * pad) / (n - 1) : 0;
  const marcadores = valores.map((v, i) => {
    const x = n > 1 ? pad + i * stepX : largura / 2;
    const y = altura - pad - ((v - min) / span) * (altura - 2 * pad);
    return { x: Number(x.toFixed(4)), y: Number(y.toFixed(4)), v };
  });
  return { pontos: marcadores.map((m) => `${m.x.toFixed(1)},${m.y.toFixed(1)}`).join(" "), marcadores };
}

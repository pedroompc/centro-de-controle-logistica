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
  positivados: number;
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

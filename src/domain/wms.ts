/** Teto padrão (em minutos) acima do qual uma separação é tratada como tarefa esquecida aberta. */
export const TETO_SEPARACAO_MIN = 8 * 60;

export interface EstatisticaDuracao {
  qtd: number; // durações consideradas
  descartadas: number; // negativas ou acima do teto
  mediaMin: number;
  medianaMin: number;
  p90Min: number;
}

/** Percentil (0..1) por interpolação linear numa lista JÁ ORDENADA. 0 se vazia. */
export function percentil(ordenados: number[], p: number): number {
  if (!ordenados.length) return 0;
  const pos = (ordenados.length - 1) * p;
  const base = Math.floor(pos);
  const frac = pos - base;
  const prox = ordenados[base + 1] ?? ordenados[base];
  return ordenados[base] + (prox - ordenados[base]) * frac;
}

/**
 * Estatísticas do tempo de separação (minutos). Descarta durações negativas
 * (relógio/cadastro errado) e acima de `tetoMin` (tarefa esquecida em aberto),
 * informando quantas foram descartadas para o descarte nunca ficar invisível.
 */
export function estatisticaSeparacao(
  duracoesMin: number[],
  tetoMin: number = TETO_SEPARACAO_MIN,
): EstatisticaDuracao {
  const validas = duracoesMin.filter((d) => Number.isFinite(d) && d >= 0 && d <= tetoMin);
  const ordenados = [...validas].sort((a, b) => a - b);
  const soma = ordenados.reduce((s, d) => s + d, 0);
  return {
    qtd: ordenados.length,
    descartadas: duracoesMin.length - validas.length,
    mediaMin: ordenados.length ? soma / ordenados.length : 0,
    medianaMin: percentil(ordenados, 0.5),
    p90Min: percentil(ordenados, 0.9),
  };
}

/** Razão segura: numerador ÷ denominador, 0 se o denominador não for positivo. */
export function porUnidade(numerador: number, denominador: number): number {
  return denominador > 0 ? numerador / denominador : 0;
}

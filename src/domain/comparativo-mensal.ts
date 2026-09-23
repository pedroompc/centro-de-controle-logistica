/**
 * Comparação mês a mês genérica — a base do "método de gestão" inline no
 * Dashboard. Recebe uma série de valores por mês (já ordenada, mais antigo →
 * mais novo) e devolve cada ponto com a variação vs o mês IMEDIATAMENTE anterior
 * da série. Puro e testável.
 */
export interface PontoValor {
  mes: string; // "yyyy-mm-01"
  valor: number;
}

export interface PontoComparado {
  mes: string;
  valor: number;
  deltaAbs: number | null; // valor − anterior; null se não há mês anterior na série
  deltaFrac: number | null; // (valor − anterior) / anterior; null se anterior 0 ou ausente
}

/** Anexa a variação vs o ponto anterior da série a cada mês. */
export function compararSerie(pontos: PontoValor[]): PontoComparado[] {
  return pontos.map((p, i) => {
    const ant = i > 0 ? pontos[i - 1] : null;
    if (!ant) return { mes: p.mes, valor: p.valor, deltaAbs: null, deltaFrac: null };
    const deltaAbs = p.valor - ant.valor;
    return {
      mes: p.mes,
      valor: p.valor,
      deltaAbs,
      deltaFrac: ant.valor !== 0 ? deltaAbs / ant.valor : null,
    };
  });
}

/** Valor de um mês específico numa série (0 se ausente). */
export function valorNoMes(pontos: PontoValor[], mes: string): number | null {
  const achado = pontos.find((p) => p.mes === mes);
  return achado ? achado.valor : null;
}

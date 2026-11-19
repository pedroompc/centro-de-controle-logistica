// Devoluções de RETIRA: a venda de origem não saiu em carga com motorista de
// verdade (sem carga ou na carga DIALOG do balcão). Uma linha por NF de
// devolução, com a NF de venda de origem ao lado.

export interface DevolucaoRetira {
  numTransEnt: number;
  nfDevolucao: number;
  dataDevolucao: string; // YYYY-MM-DD
  numTransVenda: number;
  nfOrigem: number;
  dataVenda: string; // YYYY-MM-DD
  valorNfOrigem: number; // VLTOTAL da NF de venda (bruto)
  codcli: number;
  cliente: string;
  motivo: string;
  setor: string;
  rca: string;
  balcao: boolean; // true = saiu na carga DIALOG; false = sem carga
  valor: number; // devolvido (líquido, base da rotina 111)
}

export interface LinhaRetira extends DevolucaoRetira {
  /** Quantas devoluções a mesma NF de origem tem no período. */
  devolucoesDaOrigem: number;
  /** A NF de origem voltou mais de uma vez e a soma passou do valor da nota. */
  duplicada: boolean;
}

/**
 * Marca as NFs de origem devolvidas mais de uma vez cuja soma devolvida passa
 * do valor da própria nota — sinal de entrada lançada em dobro (caso real: NF
 * 2551172 da FRUTART, nov/2026, duas devoluções de R$ 133.358,40 cada). Uma
 * margem de 1% absorve a diferença entre o bruto da NF e o líquido devolvido.
 */
export function marcarRetira(lista: DevolucaoRetira[]): LinhaRetira[] {
  const porOrigem = new Map<number, { n: number; soma: number }>();
  for (const d of lista) {
    const o = porOrigem.get(d.numTransVenda) ?? { n: 0, soma: 0 };
    o.n += 1;
    o.soma += d.valor;
    porOrigem.set(d.numTransVenda, o);
  }
  return lista.map((d) => {
    const o = porOrigem.get(d.numTransVenda)!;
    return { ...d, devolucoesDaOrigem: o.n, duplicada: o.n > 1 && o.soma > d.valorNfOrigem * 1.01 };
  });
}

export interface ResumoRetira {
  valor: number;
  notas: number;
  clientes: number;
  /** Valor devolvido além do valor da NF de origem, nas origens duplicadas. */
  excessoDuplicado: number;
}

export function resumirRetira(linhas: LinhaRetira[]): ResumoRetira {
  const excesso = new Map<number, number>();
  for (const l of linhas) {
    if (!l.duplicada) continue;
    excesso.set(l.numTransVenda, (excesso.get(l.numTransVenda) ?? -l.valorNfOrigem) + l.valor);
  }
  return {
    valor: linhas.reduce((t, l) => t + l.valor, 0),
    notas: new Set(linhas.map((l) => l.numTransEnt)).size,
    clientes: new Set(linhas.map((l) => l.codcli)).size,
    excessoDuplicado: [...excesso.values()].reduce((t, v) => t + Math.max(0, v), 0),
  };
}

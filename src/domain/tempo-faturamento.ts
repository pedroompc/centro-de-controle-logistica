import { classificarRegiao, ORDEM_REGIAO, type RegiaoPE } from "./pe-regioes";

/**
 * Tempo do pedido liberado até a nota emitida (calendário de rotas incluído —
 * é o tempo que o cliente sente). Liberação = DTLIBERA quando alguém liberou o
 * pedido bloqueado; senão, o horário do próprio pedido (nasceu liberado).
 */

/** Uma linha do histograma vindo do Oracle: pedidos de uma cidade com N horas inteiras. */
export interface LinhaTempo {
  cidade: string | null;
  uf: string | null;
  horas: number;
  qtd: number;
}

export interface TempoRegiao {
  regiao: RegiaoPE;
  pedidos: number;
  medianaH: number | null;
}

export interface ResumoTempos {
  pedidos: number;
  medianaH: number | null;
  /** Frações (0–1) dos pedidos faturados em menos de 24 h / 48 h e com 5 dias ou mais. */
  ate24: number;
  ate48: number;
  mais5d: number;
  porRegiao: TempoRegiao[];
}

/** Mediana ponderada pela quantidade de pedidos de cada faixa de horas. */
export function medianaDoHistograma(linhas: { horas: number; qtd: number }[]): number | null {
  const total = linhas.reduce((t, l) => t + l.qtd, 0);
  if (total === 0) return null;
  const meio = Math.ceil(total / 2);
  let acumulado = 0;
  for (const l of [...linhas].sort((a, b) => a.horas - b.horas)) {
    acumulado += l.qtd;
    if (acumulado >= meio) return l.horas;
  }
  return null;
}

export function resumirTempos(linhas: LinhaTempo[], classificar = classificarRegiao): ResumoTempos {
  const pedidos = linhas.reduce((t, l) => t + l.qtd, 0);
  const fracao = (f: (h: number) => boolean) => (pedidos === 0 ? 0 : linhas.filter((l) => f(l.horas)).reduce((t, l) => t + l.qtd, 0) / pedidos);

  const grupos = new Map<RegiaoPE, LinhaTempo[]>();
  for (const l of linhas) {
    const r = classificar(l.cidade, l.uf);
    grupos.set(r, [...(grupos.get(r) ?? []), l]);
  }
  const porRegiao = ORDEM_REGIAO.filter((r) => grupos.has(r)).map((regiao) => {
    const g = grupos.get(regiao)!;
    return { regiao, pedidos: g.reduce((t, l) => t + l.qtd, 0), medianaH: medianaDoHistograma(g) };
  });

  return {
    pedidos,
    medianaH: medianaDoHistograma(linhas),
    ate24: fracao((h) => h < 24),
    ate48: fracao((h) => h < 48),
    mais5d: fracao((h) => h >= 120),
    porRegiao,
  };
}

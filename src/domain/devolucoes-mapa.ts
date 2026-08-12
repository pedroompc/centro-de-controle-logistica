/**
 * Devolução por cidade (PE) — quebra da taxa de devolução do dashboard
 * (`taxa = devolvido / faturado`, ver [[devolucao-regra]]) por município, para o
 * mapa de calor. Puro e testável sem Oracle. Os tipos vivem aqui; a camada de
 * dados (`src/data/devolucoes.ts`) os importa.
 */
export interface LinhaCidadeDevolucao {
  ibge: string; // código IBGE (7 dígitos) — chave de junção com a geometria
  cidade: string;
  faturado: number; // R$ faturado atribuído à cidade no período
  devolvido: number; // R$ devolvido (líquido, rotina 111)
  notasDevolvidas: number;
}

export interface CidadeDevolucao extends LinhaCidadeDevolucao {
  taxa: number; // devolvido / faturado (0..1); 0 se faturado <= 0
  relevante: boolean; // faturado >= minFaturado — abaixo disso, 1 venda vira 100%
}

/** Piso de faturamento para uma cidade colorir o mapa (senão a escala é sequestrada). */
export const MIN_FATURADO_CIDADE = 5000;

/** Cinza para cidade sem volume relevante ou sem dado. slate-200. */
export const COR_NEUTRA = "#e2e8f0";

// Rampa âmbar → vermelho (amber-200 … red-600). Verde jamais (regra de identidade).
const RAMPA = [
  "#fde68a",
  "#fcd34d",
  "#fbbf24",
  "#f59e0b",
  "#fb923c",
  "#f97316",
  "#ea580c",
  "#dc2626",
];

export const COR_RAMPA_MIN = RAMPA[0];
export const COR_RAMPA_MAX = RAMPA[RAMPA.length - 1];

/** Enriquece cada linha com taxa e o flag de volume relevante. */
export function comTaxa(
  linhas: LinhaCidadeDevolucao[],
  minFaturado: number = MIN_FATURADO_CIDADE,
): CidadeDevolucao[] {
  return linhas.map((l) => ({
    ...l,
    taxa: l.faturado > 0 ? l.devolvido / l.faturado : 0,
    relevante: l.faturado >= minFaturado,
  }));
}

/**
 * Métrica que colore o mapa:
 *  - "valor": R$ devolvido (absoluto) — mostra ONDE está o volume (a metrópole
 *    acende); cidade grande lidera por porte.
 *  - "taxa": devolvido / faturado (%) — mostra a INTENSIDADE do problema; usa o
 *    piso de volume p/ vilarejo não sequestrar a escala.
 */
export type Metrica = "valor" | "taxa";

/** O número que colore a cidade na métrica escolhida. */
export function valorMetrica(c: CidadeDevolucao, m: Metrica): number {
  return m === "taxa" ? c.taxa : c.devolvido;
}

/**
 * A cidade deve ser colorida (vs. cinza) nesta métrica?
 *  - taxa: só relevante (faturado >= piso), senão 1 venda vira 100%.
 *  - valor: qualquer devolução > 0 (R$ é volume real, sem piso de faturamento).
 */
export function colorivel(c: CidadeDevolucao, m: Metrica): boolean {
  return m === "taxa" ? c.relevante : c.devolvido > 0;
}

/** Maior valor da métrica entre as cidades coloríveis — o teto da escala. 0 se nenhuma. */
export function tetoMetrica(cidades: CidadeDevolucao[], m: Metrica): number {
  return cidades
    .filter((c) => colorivel(c, m))
    .reduce((teto, c) => Math.max(teto, valorMetrica(c, m)), 0);
}

/**
 * Total agregado da métrica (headline do mapa):
 *  - valor: soma de TODO o R$ devolvido de PE no período.
 *  - taxa: taxa geral = soma devolvido / soma faturado (a devolução do estado como
 *    um todo). 0 se não houve faturamento.
 */
export function totalMetrica(cidades: CidadeDevolucao[], m: Metrica): number {
  const dev = cidades.reduce((s, c) => s + c.devolvido, 0);
  if (m === "valor") return dev;
  const fat = cidades.reduce((s, c) => s + c.faturado, 0);
  return fat > 0 ? dev / fat : 0;
}

/** Cidades coloríveis ordenadas da maior para a menor na métrica (lista ranqueada). */
export function rankingMetrica(cidades: CidadeDevolucao[], m: Metrica): CidadeDevolucao[] {
  return cidades
    .filter((c) => colorivel(c, m))
    .sort((a, b) => valorMetrica(b, m) - valorMetrica(a, m));
}

/**
 * Cor do município no mapa. Não colorível (ou teto 0) → neutro. Caso contrário,
 * um passo da rampa proporcional a `valor / teto` (o líder vira o tom mais intenso).
 */
export function corDaEscala(valor: number, colorir: boolean, teto: number): string {
  if (!colorir || teto <= 0) return COR_NEUTRA;
  const razao = Math.min(1, Math.max(0, valor / teto));
  const i = Math.min(RAMPA.length - 1, Math.floor(razao * RAMPA.length));
  return RAMPA[i];
}

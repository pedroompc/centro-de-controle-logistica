// Comparação de um indicador com o período anterior — uma regra só para o site
// inteiro (Dashboard, Tendências, BIs, Cortes, Painel TV).
//
// Cor pela identidade do site: a direção BOA fica neutra e só a RUIM ganha cor
// (rose). Verde nunca (é da receita) — a única exceção é a devolução na TV, que
// a própria tela decide. Empate conta como bom (não pinta de rose).

import { formatPercent } from "./format";

export interface Comparacao {
  texto: string; // com sinal e unidade: "+12,7%", "−1,9 p.p.", "+3"
  subindo: boolean; // direção da seta
  positivo: boolean; // essa direção é boa? (false = rose)
}

const MENOS = "−"; // sinal de menos tipográfico, não hífen

function comSinal(dif: number, texto: string): string {
  // Arredondou para zero ("0,0%"): sem sinal — "+0,0%" sugere movimento que não houve.
  if (!/[1-9]/.test(texto)) return texto;
  return `${dif > 0 ? "+" : dif < 0 ? MENOS : ""}${texto}`;
}

/** Fração com sinal: 0,127 → "+12,7%". */
export function pctComSinal(frac: number, casas = 1): string {
  return comSinal(frac, formatPercent(Math.abs(frac), casas));
}

/** Pontos percentuais com sinal: −1,94 → "−1,9 p.p.". */
export function ppComSinal(pp: number, casas = 1): string {
  return comSinal(pp, `${Math.abs(pp).toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas })} p.p.`);
}

/** Monta a comparação a partir da diferença e do texto já formatado. */
export function comparacao(dif: number, texto: string, maiorEhBom: boolean): Comparacao {
  return { texto, subindo: dif > 0, positivo: maiorEhBom ? dif >= 0 : dif <= 0 };
}

/** Variação relativa (%). `null` sem base para comparar (anterior ausente ou ≤ 0). */
export function compararPct(atual: number, anterior: number | null | undefined, maiorEhBom: boolean, casas = 1): Comparacao | null {
  if (anterior == null || !(anterior > 0)) return null;
  const frac = (atual - anterior) / anterior;
  return comparacao(frac, pctComSinal(frac, casas), maiorEhBom);
}

/**
 * Variação de uma TAXA (frações 0..1). `pp` = em pontos percentuais (padrão do
 * site); sem `pp` a diferença sai como "%" (a TV prefere assim — "p.p." confunde
 * à distância). Taxa variando em % relativo engana, por isso nunca é usado aqui.
 */
export function compararTaxa(
  atual: number | null | undefined,
  anterior: number | null | undefined,
  maiorEhBom: boolean,
  { casas = 1, pp = true }: { casas?: number; pp?: boolean } = {},
): Comparacao | null {
  if (atual == null || anterior == null) return null;
  const dif = atual - anterior;
  return comparacao(dif, pp ? ppComSinal(dif * 100, casas) : pctComSinal(dif, casas), maiorEhBom);
}

/** Diferença absoluta (contagem de pessoas, carros…): "+3" / "−2". */
export function compararAbs(atual: number, anterior: number | null | undefined, maiorEhBom: boolean, fmt: (n: number) => string = (n) => n.toLocaleString("pt-BR")): Comparacao | null {
  if (anterior == null) return null;
  const dif = atual - anterior;
  return comparacao(dif, comSinal(dif, fmt(Math.abs(dif))), maiorEhBom);
}

/** Acrescenta o período de referência ao texto: "+12,7% vs Out". */
export function comRotulo(c: Comparacao | null, rotulo: string): Comparacao | null {
  return c && { ...c, texto: `${c.texto} vs ${rotulo}` };
}

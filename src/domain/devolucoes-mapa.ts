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
 * Cidade com a maior taxa ENTRE as de volume relevante — a resposta da pergunta
 * "qual cidade tem o maior índice". Em empate, mantém a primeira encontrada.
 * `null` se nenhuma atinge o piso.
 */
export function piorCidade(cidades: CidadeDevolucao[]): CidadeDevolucao | null {
  return cidades
    .filter((c) => c.relevante)
    .reduce<CidadeDevolucao | null>(
      (pior, c) => (pior === null || c.taxa > pior.taxa ? c : pior),
      null,
    );
}

/**
 * Cor do município no mapa. Não relevante (ou teto 0) → neutro. Caso contrário,
 * um passo da rampa proporcional a `taxa / tetoRelevante` (o pior vira o tom mais
 * intenso). `tetoRelevante` = maior taxa entre as cidades relevantes.
 */
export function corDaTaxa(taxa: number, relevante: boolean, tetoRelevante: number): string {
  if (!relevante || tetoRelevante <= 0) return COR_NEUTRA;
  const razao = Math.min(1, Math.max(0, taxa / tetoRelevante));
  const i = Math.min(RAMPA.length - 1, Math.floor(razao * RAMPA.length));
  return RAMPA[i];
}

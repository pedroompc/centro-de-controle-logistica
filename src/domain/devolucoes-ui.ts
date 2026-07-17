import type { DevolucaoPorMotorista } from "./devolucoes";

/** Filtro em memória por texto: casa a busca contra qualquer um dos `campos`. */
export function filtrarPorBusca<T>(
  lista: T[],
  busca: string,
  campos: (item: T) => (string | number)[],
): T[] {
  const q = busca.toLowerCase().trim();
  if (!q) return lista;
  return lista.filter((item) =>
    campos(item).some((c) => String(c).toLowerCase().includes(q)),
  );
}

export type ColunaMotorista = "expedidas" | "devolvidas" | "taxa" | "valorDevolvido";
export type Direcao = "asc" | "desc";

/** Ordena por coluna numérica sem mutar a lista original. */
export function ordenarMotoristas(
  lista: DevolucaoPorMotorista[],
  col: ColunaMotorista,
  dir: Direcao,
): DevolucaoPorMotorista[] {
  return [...lista].sort((a, b) => (dir === "asc" ? a[col] - b[col] : b[col] - a[col]));
}

/** Semáforo da taxa de devolução: neutro < 8%, âmbar 8–15%, vermelho >= 15%.
 * Taxa saudável fica em cinza (não verde) — a identidade do site evita verde. */
export function corTaxa(taxa: number): string {
  if (taxa >= 15) return "text-rose-600";
  if (taxa >= 8) return "text-amber-600";
  return "text-slate-500";
}

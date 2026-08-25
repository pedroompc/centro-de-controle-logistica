import type { DevolucaoPorMotorista, TipoMotorista } from "./devolucoes";

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

/** Valor selecionável do filtro por vínculo: "" = todos, "F" = da casa, "T" = terceirizado. */
export type FiltroTipoMotorista = "" | "F" | "T";

/** Rótulo + classes da etiqueta de vínculo do motorista (paleta do site: navy/âmbar). */
export function tipoMotoristaInfo(tipo: TipoMotorista): { label: string; badge: string } {
  if (tipo === "F") return { label: "Da casa", badge: "bg-[#eef0fb] text-[#1b2168] border border-[#d6dbf5]" };
  if (tipo === "T") return { label: "Terceirizado", badge: "bg-amber-50 text-amber-700 border border-amber-200" };
  return { label: "Não informado", badge: "bg-slate-100 text-slate-500 border border-slate-200" };
}

/** Filtra por vínculo (F/T); `""` devolve a lista inteira. */
export function filtrarPorTipo(
  lista: DevolucaoPorMotorista[],
  tipo: FiltroTipoMotorista,
): DevolucaoPorMotorista[] {
  if (!tipo) return lista;
  return lista.filter((m) => m.tipo === tipo);
}

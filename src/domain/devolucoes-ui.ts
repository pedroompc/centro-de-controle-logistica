import type { DevolucaoPorMotorista, TipoMotorista, MotivoDetalhe, SetorDevolucao } from "./devolucoes";

// Ordem de desempate quando dois setores empatam em valor.
const ORDEM_SETOR: readonly SetorDevolucao[] = ["Logística", "Comercial", "Faturamento", "Não classificado"];

export interface SetorPredominante {
  setor: SetorDevolucao;
  fracao: number; // 0..1 — quanto do R$ devolvido veio desse setor
}

/**
 * Setor responsável predominante de uma entidade (cliente/vendedor), a partir da
 * quebra por motivo: soma o valor por setor e devolve o de maior R$, com a fração
 * que ele representa. Responde "essa devolução é mais comercial ou logística?".
 * `null` se não há motivo/valor.
 */
export function setorPredominante(motivos: MotivoDetalhe[] | undefined): SetorPredominante | null {
  if (!motivos || motivos.length === 0) return null;
  const porSetor = new Map<SetorDevolucao, number>();
  let total = 0;
  for (const m of motivos) {
    porSetor.set(m.setor, (porSetor.get(m.setor) ?? 0) + m.valor);
    total += m.valor;
  }
  if (total <= 0) return null;
  let melhor: SetorDevolucao = ORDEM_SETOR[0];
  let melhorV = -1;
  for (const s of ORDEM_SETOR) {
    const v = porSetor.get(s) ?? 0;
    if (v > melhorV) {
      melhorV = v;
      melhor = s;
    }
  }
  if (melhorV <= 0) return null;
  return { setor: melhor, fracao: melhorV / total };
}

/** Motivo isolado de maior R$ devolvido da entidade — o "porquê" específico. */
export function motivoPredominante(motivos: MotivoDetalhe[] | undefined): string | null {
  if (!motivos || motivos.length === 0) return null;
  let melhor: string | null = null;
  let melhorV = -1;
  for (const m of motivos) {
    if (m.valor > melhorV) {
      melhorV = m.valor;
      melhor = m.motivo;
    }
  }
  return melhorV > 0 ? melhor : null;
}

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

/** Etiqueta de setor responsável — mesma paleta dos cards de setor da página. */
export function setorPill(setor: string): string {
  if (setor === "Logística") return "bg-[#eef0fb] text-[#1b2168]";
  if (setor === "Comercial") return "bg-amber-50 text-amber-700";
  if (setor === "Faturamento") return "bg-rose-50 text-rose-700";
  return "bg-slate-100 text-slate-500";
}

/** Filtra por vínculo (F/T); `""` devolve a lista inteira. */
export function filtrarPorTipo(
  lista: DevolucaoPorMotorista[],
  tipo: FiltroTipoMotorista,
): DevolucaoPorMotorista[] {
  if (!tipo) return lista;
  return lista.filter((m) => m.tipo === tipo);
}

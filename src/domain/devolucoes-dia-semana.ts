/**
 * Base de data da análise de devolução:
 * - "devolucao": devoluções que ENTRARAM no período (rotina 111 — o padrão);
 * - "faturamento": das notas FATURADAS (saídas) no período, as que voltaram em
 *   qualquer data até hoje. O mês recente ainda sobe conforme as devoluções chegam.
 */
export type BaseDevolucao = "devolucao" | "faturamento";

// Padrão = "faturamento" (Dia faturado), igual ao Painel TV; ?base=devolucao
// volta para a data da devolução (rotina 111).
export const baseDevolucao = (v: string | undefined): BaseDevolucao =>
  v === "devolucao" ? "devolucao" : "faturamento";

export const ROTULOS_DIA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Linha do SQL: `dia` 0 = segunda … 6 = domingo (TRUNC(d) − TRUNC(d,'IW')). */
export interface LinhaDiaSemana {
  dia: number;
  valor: number;
  peso: number;
  notas: number;
}

export interface DevolucaoDiaSemana extends LinhaDiaSemana {
  rotulo: string;
  pctValor: number; // fração do valor total (0–1)
  pctPeso: number; // fração do peso total (0–1)
}

/** Os 7 dias (seg → dom), com zero onde não houve devolução e a participação de cada um. */
export function montarDiasSemana(linhas: LinhaDiaSemana[]): DevolucaoDiaSemana[] {
  const dias = ROTULOS_DIA.map((rotulo, dia) => ({ dia, rotulo, valor: 0, peso: 0, notas: 0, pctValor: 0, pctPeso: 0 }));
  for (const l of linhas) {
    const d = dias[l.dia];
    if (!d) continue;
    d.valor += l.valor;
    d.peso += l.peso;
    d.notas += l.notas;
  }
  const totalValor = dias.reduce((t, d) => t + d.valor, 0);
  const totalPeso = dias.reduce((t, d) => t + d.peso, 0);
  for (const d of dias) {
    d.pctValor = totalValor > 0 ? d.valor / totalValor : 0;
    d.pctPeso = totalPeso > 0 ? d.peso / totalPeso : 0;
  }
  return dias;
}

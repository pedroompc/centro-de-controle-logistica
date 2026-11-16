// Abas e links do BI Geral (/bi). A query leva a aba, o período (mes | de+ate)
// e a comparação (cmp); trocar de aba preserva período e comparação.
import { INICIO_HISTORICO, PISO_HARPIA } from "./periodo";

export const ABAS_BI = ["geral", "separacao", "recebimento", "abastecimento", "motoristas"] as const;
export type AbaBI = (typeof ABAS_BI)[number];

export const ROTULO_ABA: Record<AbaBI, string> = {
  geral: "Geral",
  separacao: "Separação",
  recebimento: "Recebimento",
  abastecimento: "Abastecimento",
  motoristas: "Motoristas",
};

export function lerAba(v: string | undefined): AbaBI {
  return (ABAS_BI as readonly string[]).includes(v ?? "") ? (v as AbaBI) : "geral";
}

/** Primeiro mês com dado: Geral e Recebimento dependem do Supabase (jul/2026); o resto, do Harpia. */
export function pisoDaAba(a: AbaBI): string {
  return a === "geral" || a === "recebimento" ? INICIO_HISTORICO : PISO_HARPIA;
}

export function hrefBI(aba: AbaBI, q: Record<string, string>): string {
  const p = new URLSearchParams();
  if (aba !== "geral") p.set("aba", aba);
  for (const [k, v] of Object.entries(q)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `/bi?${s}` : "/bi";
}

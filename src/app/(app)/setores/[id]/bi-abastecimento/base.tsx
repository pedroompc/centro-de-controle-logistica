"use client";

import { formatMesAno } from "@/domain/periodo";
import type { PapelBI } from "../bi-ui";
import type { DadosBIAbastecimento } from "../abastecimento-dados";

// Verde é só pra receita (identidade visual) — curva A em azul-céu.
const CURVA_COR: Record<string, string> = { A: "#38bdf8", B: "#5b6fd6", C: "#c2820a" };

export const corCurva = (c: string) => CURVA_COR[c] ?? "#64748b";

export type VisaoAba = "custo" | "volume" | "antecedencia" | "giro" | "movimento" | "rupturas";

export const VISOES: { id: VisaoAba; titulo: string; contexto: string }[] = [
  { id: "custo", titulo: "Custo e equipe", contexto: "quem e o que compõe o custo — pessoas por função, salários e equipamentos" },
  { id: "volume", titulo: "Volume", contexto: "o que foi reabastecido no picking (regra da A424) · clique num dia para filtrar" },
  { id: "antecedencia", titulo: "Antecedência", contexto: "folga entre o abastecimento e o fim da separação da carga · clique num dia para filtrar" },
  { id: "giro", titulo: "Giro de picking", contexto: "produtos mais reabastecidos no mês (regra da A424) · clique numa curva ABC para filtrar, num produto para ver o histórico diário" },
  { id: "movimento", titulo: "Movimentação", contexto: "quem move, descendente × ascendente × horizontal e horário — a equipe real de piso · clique num dia ou numa pessoa" },
  { id: "rupturas", titulo: "Rupturas", contexto: "estoque negativo no endereço de picking, resolvido por um abastecimento" },
];

// Fora do menu por ora (pedido do Pedro, 20/10/2026) — as visões continuam no código.
export const OCULTAS: ReadonlySet<VisaoAba> = new Set(["antecedencia", "rupturas"]);

export const PAPEIS: PapelBI[] = [
  { id: "lider", rotulo: "Líder", plural: "Liderança", cor: "#10b981" },
  { id: "empilhador", rotulo: "Empilhador", plural: "Empilhadores", cor: "#38bdf8" },
  { id: "wms", rotulo: "WMS", plural: "WMS", cor: "#c2820a" },
  { id: "operador", rotulo: "Operador", plural: "Operadores de abastecimento", cor: "#5b6fd6" },
];

export const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");

export const n1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export const mesCurto = (m: string) => formatMesAno(m).slice(0, 3);

/**
 * Custo do setor ÷ faturamento líquido do mês. No mês corrente o custo entra
 * proporcional ao que já correu (o faturamento também é parcial) — mesma
 * conta do BI do Recebimento.
 */
export function custoSobreFaturamento(d: DadosBIAbastecimento): number | null {
  const c = custoDoMes(d, d.mes);
  return c === null || !d.faturamentoLiquido || d.faturamentoLiquido <= 0 ? null : (c * d.fracaoMes) / d.faturamentoLiquido;
}

/** Custo do mês: folha (foto do mês; no corrente, o cadastro) + equipamentos de hoje. */
export function custoDoMes(d: DadosBIAbastecimento, mes: string): number | null {
  const p = d.serie.find((x) => x.mes === mes);
  if (!p || p.folha === null) return null;
  return p.folha + d.equipamentos.reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
}

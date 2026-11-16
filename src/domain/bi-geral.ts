// BI Geral: o resumo de cada setor na aba Geral. Nenhuma conta nova — cada
// número sai da MESMA função que o BI do setor usa nos quadros dele (ver
// docs/superpowers/specs/2026-11-16-bi-geral-design.md).
import { compararPct, type Comparacao } from "./comparacao";
import { resumir } from "./bi-recebimento";
import { resumoVolume, premiacaoA424 } from "./abastecimento";
import { resumoDevolucao } from "./motoristas";
import { mapaKmDia, resumoKm } from "./frota";
import { indicadoresSeparacao } from "@/app/(app)/setores/[id]/separacao-indicadores";
import { indicadoresMotoristas } from "@/app/(app)/setores/[id]/motoristas-indicadores";
import type { DadosBISeparacao } from "@/app/(app)/setores/[id]/separacao-dados";
import type { DadosBIAbastecimento } from "@/app/(app)/setores/[id]/abastecimento-dados";
import type { DadosBIMotoristas } from "@/app/(app)/setores/[id]/motoristas-dados";
import type { DadosBI } from "@/app/(app)/setores/[id]/bi-recebimento/base";

export type FormatoIndicador = "int" | "kg" | "brl" | "pct" | "brlPorCx" | "km";

export interface IndicadorGeral {
  chave: string;
  rotulo: string;
  valor: number | null; // null = sem dado (nunca 0 no lugar)
  formato: FormatoIndicador;
  maiorEhBom: boolean;
}

export type SetorGeral = "separacao" | "recebimento" | "abastecimento" | "motoristas";

export interface ResumoSetorGeral {
  setor: SetorGeral;
  indicadores: IndicadorGeral[];
  erro: string | null; // fonte fora (Harpia/Winthor): os números daquela fonte vêm null
}

const ind = (chave: string, rotulo: string, valor: number | null, formato: FormatoIndicador, maiorEhBom: boolean): IndicadorGeral => ({
  chave, rotulo, valor, formato, maiorEhBom,
});

/** Pedidos separados, peso separado e custo por caixa (quadros do BI da Separação). */
export function resumoSeparacao(d: DadosBISeparacao): ResumoSetorGeral {
  const erro = "erro" in d.producao ? d.producao.erro : null;
  const i = erro ? null : indicadoresSeparacao(d, null);
  return {
    setor: "separacao",
    erro,
    indicadores: [
      ind("pedidos", "Pedidos separados", i?.tot?.pedidos ?? null, "int", true),
      ind("peso", "Peso separado", i?.tot?.kg ?? null, "kg", true),
      ind("custoPorCaixa", "Custo por caixa", i?.unit.porCaixa ?? null, "brlPorCx", false),
    ],
  };
}

/** Peso, carros e receita do descarrego — mesma escolha do BI (fatos do recorte; sem fatos, a série do mês). */
export function resumoRecebimento(d: DadosBI): ResumoSetorGeral {
  const r = d.ref ?? d.serie.find((x) => x.mes === d.mes) ?? null;
  const f = r && d.fatos !== null ? resumir(d.fatos) : null;
  return {
    setor: "recebimento",
    erro: null,
    indicadores: [
      ind("peso", "Peso descarregado", r ? (f ? f.pesoKg : r.pesoKg) : null, "kg", true),
      ind("carros", "Carros descarregados", r ? (f ? f.carros : r.carros) : null, "int", true),
      ind("receita", "Receita de descarrego", r ? (f ? f.receita : r.receitaDescarrego) : null, "brl", true),
    ],
  };
}

/** Movimentações, reabastecimentos e rupturas (quadros do BI do Abastecimento). */
export function resumoAbastecimento(d: DadosBIAbastecimento): ResumoSetorGeral {
  const h = "dados" in d.harpia ? d.harpia.dados : null;
  const erro = "erro" in d.harpia ? d.harpia.erro : null;
  const prem = h ? premiacaoA424(h.movimentoPiso.a424, null, h.movimentoPiso.empilhadores, h.movimentoPiso.lancadoresWms) : null;
  return {
    setor: "abastecimento",
    erro,
    indicadores: [
      ind("movimentacoes", "Movimentações", prem?.total ?? null, "int", true),
      ind("reabastecimentos", "Reabastecimentos", h ? resumoVolume(h.reabastecimento).abastecimentos : null, "int", true),
      ind("rupturas", "Rupturas", h ? h.rupturas.length : null, "int", false),
    ],
  };
}

/**
 * Entregas, peso, clientes atendidos, devolução logística e km por entrega.
 * `clientesAtendidos` = cliente distinto por dia (o mesmo do Início), vem de fora.
 */
export function resumoMotoristas(d: DadosBIMotoristas, clientesAtendidos: number | null): ResumoSetorGeral {
  const erro = "erro" in d.entregas ? d.entregas.erro : null;
  const i = indicadoresMotoristas(d, null);
  const dev = d.devolucao ? resumoDevolucao(d.devolucao) : null;
  const km = i.vs && d.hodometro ? resumoKm(i.vs, mapaKmDia(d.hodometro), null) : null;
  return {
    setor: "motoristas",
    erro,
    indicadores: [
      ind("entregas", "Entregas", i.tot?.entregas ?? null, "int", true),
      ind("peso", "Peso entregue", i.tot?.kg ?? null, "kg", true),
      ind("clientes", "Clientes atendidos", erro ? null : clientesAtendidos, "int", true),
      ind("devolucao", "Devolução logística", erro ? null : dev?.taxa ?? null, "pct", false),
      ind("kmPorEntrega", "Km por entrega", km?.kmPorEntrega ?? null, "km", false),
    ],
  };
}

/** Variação contra o período de comparação; null quando falta um dos lados. */
export function variacao(atual: IndicadorGeral, base: IndicadorGeral | undefined): Comparacao | null {
  if (atual.valor === null || !base || base.valor === null) return null;
  return compararPct(atual.valor, base.valor, atual.maiorEhBom);
}

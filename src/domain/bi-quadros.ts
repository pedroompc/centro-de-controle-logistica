// Comparação nos quadros das abas de setor do BI Geral (fase 2): o número
// principal de cada quadro do topo, calculado pela MESMA conta que o quadro
// mostra — roda para o período da tela e para o de comparação.
import { comNovaTentativa, variacao, type IndicadorGeral, type FormatoIndicador } from "./bi-geral";
import { rotuloCurto, type Periodo, type PeriodoComparado } from "./periodo";
import type { Comparacao } from "./comparacao";
import { resumoVolume, premiacaoA424 } from "./abastecimento";
import { resumoDevolucao } from "./motoristas";
import { mapaKmDia, resumoKm } from "./frota";
import { indicadoresSeparacao } from "@/app/(app)/setores/[id]/separacao-indicadores";
import { indicadoresMotoristas } from "@/app/(app)/setores/[id]/motoristas-indicadores";
import { recortar } from "@/app/(app)/setores/[id]/bi-recebimento/recorte";
import type { DadosBISeparacao } from "@/app/(app)/setores/[id]/separacao-dados";
import type { DadosBIAbastecimento } from "@/app/(app)/setores/[id]/abastecimento-dados";
import type { DadosBIMotoristas } from "@/app/(app)/setores/[id]/motoristas-dados";
import type { DadosBI } from "@/app/(app)/setores/[id]/bi-recebimento/base";

/** Carga só para os quadros (período de comparação): sem visões de admin nem o período anterior ao pedido. */
export interface OpcoesCarga {
  soQuadros?: boolean;
}

/** O que a aba de setor recebe quando há `?cmp=`: os números do período de comparação. */
export interface ComparacaoQuadros {
  rotulo: string; // "vs Set/26"
  base: IndicadorGeral[] | null; // null = sem base (antes do piso) ou falhou
  falhou: boolean;
}

const q = (chave: string, valor: number | null, formato: FormatoIndicador, maiorEhBom: boolean): IndicadorGeral => ({
  chave, rotulo: chave, valor, formato, maiorEhBom,
});

export function numerosSeparacao(d: DadosBISeparacao): IndicadorGeral[] {
  const i = indicadoresSeparacao(d, null);
  return [
    q("custo", i.custo, "brl", false),
    q("producao", i.tot?.linhas ?? null, "int", true),
    q("turnos", i.tot ? i.turnos.reduce((x, t) => x + Math.round(t.kg), 0) : null, "kg", true),
    q("qualidade", i.taxaErro === null ? null : i.taxaErro / 1000, "pct", false),
  ];
}

export function numerosMotoristas(d: DadosBIMotoristas): IndicadorGeral[] {
  const i = indicadoresMotoristas(d, null);
  const km = i.vs && d.hodometro ? resumoKm(i.vs, mapaKmDia(d.hodometro), null) : null;
  const dev = d.devolucao ? resumoDevolucao(d.devolucao, null) : null;
  return [
    q("custo", i.custo, "brl", false),
    q("entregas", i.tot?.entregas ?? null, "int", true),
    q("frota", i.tot?.ocupacao ?? null, "pct", true),
    q("km", km && km.rastreados > 0 ? km.km : null, "km", false),
    q("devolucao", dev?.taxa ?? null, "pct", false),
  ];
}

export function numerosAbastecimento(d: DadosBIAbastecimento): IndicadorGeral[] {
  const h = "dados" in d.harpia ? d.harpia.dados : null;
  const prem = h ? premiacaoA424(h.movimentoPiso.a424, null, h.movimentoPiso.empilhadores, h.movimentoPiso.lancadoresWms) : null;
  return [
    // Custo: a taxa mensal (custo médio por mês) — o recorte do mês aberto é o mês
    // cheio e o do período cortado é proporcional; comparar os dois distorce.
    q("custo", d.custoMedio, "brl", false),
    q("volume", h ? resumoVolume(h.reabastecimento).caixas : null, "int", true),
    q("giro", h ? h.curvas.reduce((t, c) => t + c.abastecimentos, 0) : null, "int", true),
    q("movimento", prem?.total ?? null, "int", true),
    q("rupturas", h ? h.rupturas.length : null, "int", false),
  ];
}

export function numerosRecebimento(d: DadosBI): IndicadorGeral[] {
  // Período livre sem os fatos do descarrego: o recorte viria zerado — sem dado, não 0.
  const x = !d.mensal && d.fatos === null ? null : recortar(d, {});
  const peso = x ? (x.temFatos ? x.sel.pesoKg : x.r.pesoKg) : 0;
  return [
    q("custo", x ? x.custo : null, "brl", false),
    q("descarrego", x ? (x.temFatos ? x.sel.carros : x.r.carros) : null, "int", true),
    q("receita", x ? (x.temFatos ? x.sel.receita : x.r.receitaDescarrego) : null, "brl", true),
    q("eficiencia", x && peso > 0 ? x.custo / (peso / 1000) : null, "brlPorT", false),
  ];
}

/** Variação de um quadro: o mesmo número dos dois lados; null sem base. */
export function variacaoDoQuadro(chave: string, atuais: IndicadorGeral[], base: IndicadorGeral[] | null): Comparacao | null {
  const a = atuais.find((i) => i.chave === chave);
  return a && base ? variacao(a, base.find((i) => i.chave === chave)) : null;
}

/**
 * Números do período de comparação, pelo MESMO carregador do BI do setor.
 * Antes do piso do setor: sem base, sem consultar. Fonte fora: `falhou` (com
 * uma nova tentativa se a conexão caiu).
 */
export async function carregarComparacao<D>(
  cmp: PeriodoComparado | null | undefined,
  piso: string,
  carregar: (p: Periodo, opcoes: { soQuadros: true }) => Promise<D>,
  numeros: (d: D) => IndicadorGeral[],
  erroDe: (d: D) => string | null,
): Promise<ComparacaoQuadros | undefined> {
  if (!cmp) return undefined;
  const rotulo = `vs ${rotuloCurto(cmp.periodo)}`;
  if (cmp.periodo.de < piso) return { rotulo, base: null, falhou: false };
  try {
    const r = await comNovaTentativa(async () => {
      const d = await carregar(cmp.periodo, { soQuadros: true });
      return { d, erro: erroDe(d) };
    });
    return { rotulo, base: numeros(r.d), falhou: !!r.erro };
  } catch (e) {
    console.error("[bi-comparacao]", e instanceof Error ? e.message : String(e));
    return { rotulo, base: null, falhou: true };
  }
}

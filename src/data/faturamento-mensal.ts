import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getResumoFaturamento } from "./faturamento";
import type { ResumoFaturamento } from "@/domain/faturamento";
import { primeiroDiaDoMes, inicioFimDoMes } from "@/domain/periodo";
import { mesesFechados, type PontoTendencia } from "@/domain/tendencias";

const FILIAL = "1";
// Literal única (sem concatenação) para preservar o tipo literal que o
// supabase-js usa para inferir o formato do retorno de `.select(COLUNAS)`.
const COLUNAS =
  "mes, venda_faturada, venda_liquida, valor_devolucao, valor_devolucao_avulsa, devolvidas, devolvidas_avulsas, peso_faturado, peso_devolucao, emitidas, positivados";

const num = (v: unknown): number => Number(v) || 0;

function rowToPonto(row: Record<string, unknown>): PontoTendencia {
  return {
    mes: primeiroDiaDoMes(String(row.mes)), // normaliza p/ "YYYY-MM-01"
    vendaFaturada: num(row.venda_faturada),
    vendaLiquida: num(row.venda_liquida),
    valorDevolucao: num(row.valor_devolucao),
    valorDevolucaoAvulsa: num(row.valor_devolucao_avulsa),
    devolvidas: num(row.devolvidas),
    devolvidasAvulsas: num(row.devolvidas_avulsas),
    pesoFaturado: num(row.peso_faturado),
    pesoDevolucao: num(row.peso_devolucao),
    emitidas: num(row.emitidas),
    positivados: num(row.positivados),
  };
}

function resumoToPonto(mes: string, r: ResumoFaturamento): PontoTendencia {
  return {
    mes,
    vendaFaturada: r.vendaFaturada,
    vendaLiquida: r.vendaLiquida,
    valorDevolucao: r.valorDevolucao,
    valorDevolucaoAvulsa: r.valorDevolucaoAvulsa,
    devolvidas: r.devolvidas,
    devolvidasAvulsas: r.devolvidasAvulsas,
    pesoFaturado: r.pesoFaturado,
    pesoDevolucao: r.pesoDevolucao,
    emitidas: r.emitidas,
    positivados: r.positivados,
  };
}

type SB = Awaited<ReturnType<typeof createClient>>;

/**
 * Calcula um mês do Winthor e o congela (best-effort) se estiver fechado. Tenta
 * 2 vezes — o Oracle às vezes derruba a conexão sob concorrência. `null` se o
 * Winthor seguir indisponível.
 */
async function computarMes(supabase: SB, mes: string): Promise<PontoTendencia | null> {
  const { inicio, fim } = inicioFimDoMes(mes);
  let r = await getResumoFaturamento(inicio, fim, FILIAL);
  if (!r) r = await getResumoFaturamento(inicio, fim, FILIAL); // 1 retry
  if (!r) return null;

  // Só congela mês FECHADO (o corrente muda ao longo do dia).
  if (mes < primeiroDiaDoMes()) {
    await supabase.from("faturamento_mensal").upsert(
      {
        mes, filial: FILIAL,
        venda_faturada: r.vendaFaturada,
        venda_liquida: r.vendaLiquida,
        valor_devolucao: r.valorDevolucao,
        valor_devolucao_avulsa: r.valorDevolucaoAvulsa,
        devolvidas: r.devolvidas,
        devolvidas_avulsas: r.devolvidasAvulsas,
        peso_faturado: r.pesoFaturado,
        peso_devolucao: r.pesoDevolucao,
        emitidas: r.emitidas,
        positivados: r.positivados,
      },
      { onConflict: "mes,filial", ignoreDuplicates: true }, // = INSERT ... ON CONFLICT DO NOTHING
    );
  }
  return resumoToPonto(mes, r);
}

/**
 * Foto de um mês. Lê do Supabase; se faltar e o mês estiver FECHADO, calcula do
 * Winthor uma vez e grava. `null` se o Winthor estiver indisponível.
 */
export async function getFaturamentoMensal(mes: string): Promise<PontoTendencia | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faturamento_mensal")
    .select(COLUNAS)
    .eq("mes", mes)
    .eq("filial", FILIAL)
    .maybeSingle();
  if (error) {
    console.error("[faturamento-mensal] Supabase indisponível:", error.message);
    return null;
  }
  if (data) return rowToPonto(data as Record<string, unknown>);
  return computarMes(supabase, mes);
}

/**
 * Série dos últimos `qtd` meses fechados. Faz UMA leitura no Supabase para todos
 * os meses e só calcula do Winthor os que faltam — e SEQUENCIALMENTE, para não
 * abrir 12 conexões Oracle de uma vez (o que derrubava meses por timeout).
 */
export const getSerieTendencias = cache(
  async (qtd = 12): Promise<PontoTendencia[]> => {
    const meses = mesesFechados(new Date(), qtd);
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("faturamento_mensal")
      .select(COLUNAS)
      .eq("filial", FILIAL)
      .in("mes", meses);
    if (error) console.error("[faturamento-mensal] Supabase indisponível:", error.message);

    const porMes = new Map<string, PontoTendencia>();
    for (const row of data ?? []) {
      const p = rowToPonto(row as Record<string, unknown>);
      porMes.set(p.mes, p);
    }

    const serie: PontoTendencia[] = [];
    for (const mes of meses) {
      const cached = porMes.get(mes);
      if (cached) { serie.push(cached); continue; }
      const p = await computarMes(supabase, mes); // sequencial: sem storm de conexões
      if (p) serie.push(p);
    }
    return serie;
  },
);

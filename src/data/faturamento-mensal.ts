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

/**
 * Foto de um mês. Lê do Supabase; se faltar e o mês estiver FECHADO, calcula do
 * Winthor uma vez e grava (INSERT ... ON CONFLICT DO NOTHING). Mês corrente/futuro
 * é calculado ao vivo e NÃO gravado. `null` se o Winthor estiver indisponível.
 */
export async function getFaturamentoMensal(mes: string): Promise<PontoTendencia | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faturamento_mensal")
    .select(COLUNAS)
    .eq("mes", mes)
    .eq("filial", FILIAL)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return rowToPonto(data as Record<string, unknown>);

  const { inicio, fim } = inicioFimDoMes(mes);
  const r = await getResumoFaturamento(inicio, fim, FILIAL);
  if (!r) return null; // Winthor offline: não grava

  const ponto = resumoToPonto(mes, r);

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
  return ponto;
}

/** Série dos últimos `qtd` meses fechados (backfill dos que faltam). */
export const getSerieTendencias = cache(
  async (qtd = 12): Promise<PontoTendencia[]> => {
    const meses = mesesFechados(new Date(), qtd);
    const pontos = await Promise.all(meses.map((m) => getFaturamentoMensal(m)));
    return pontos.filter((p): p is PontoTendencia => p !== null);
  },
);

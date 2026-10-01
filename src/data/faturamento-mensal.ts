import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getResumoFaturamento } from "./faturamento";
import { FILIAL_LABEL } from "./filiais";
import type { ResumoFaturamento } from "@/domain/faturamento";
import { primeiroDiaDoMes, inicioFimDoMes } from "@/domain/periodo";
import { mesesFechados, type PontoTendencia } from "@/domain/tendencias";
// Literal única (sem concatenação) para preservar o tipo literal que o
// supabase-js usa para inferir o formato do retorno de `.select(COLUNAS)`.
const COLUNAS =
  "mes, venda_faturada, venda_liquida, valor_devolucao, valor_devolucao_avulsa, devolvidas, devolvidas_avulsas, peso_faturado, peso_devolucao, emitidas, positivados, atendimentos";

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
    atendimentos: num(row.atendimentos),
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
    atendimentos: r.atendimentos,
  };
}

type SB = Awaited<ReturnType<typeof createClient>>;

/**
 * Grava/atualiza a foto de um mês FECHADO. `onConflict` sem `ignoreDuplicates`
 * = UPSERT que SOBRESCREVE: a foto se auto-cura quando o valor ao vivo muda
 * (ex.: devolução lançada com data retroativa entra num mês já fechado).
 */
async function congelarMes(supabase: SB, mes: string, r: ResumoFaturamento): Promise<void> {
  await supabase.from("faturamento_mensal").upsert(
    {
      mes, filial: FILIAL_LABEL,
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
      atendimentos: r.atendimentos,
    },
    { onConflict: "mes,filial" }, // sobrescreve a foto com a verdade mais recente
  );
}

/** Lê só a foto do Supabase (sem tocar no Winthor). `null` se não existir. */
async function lerSnapshot(supabase: SB, mes: string): Promise<PontoTendencia | null> {
  const { data, error } = await supabase
    .from("faturamento_mensal")
    .select(COLUNAS)
    .eq("mes", mes)
    .eq("filial", FILIAL_LABEL)
    .maybeSingle();
  if (error) {
    console.error("[faturamento-mensal] Supabase indisponível:", error.message);
    return null;
  }
  return data ? rowToPonto(data as Record<string, unknown>) : null;
}

/**
 * Calcula um mês do Winthor e o congela (best-effort) se estiver fechado. Tenta
 * 2 vezes — o Oracle às vezes derruba a conexão sob concorrência. `null` se o
 * Winthor seguir indisponível.
 */
async function computarMes(supabase: SB, mes: string): Promise<PontoTendencia | null> {
  const { inicio, fim } = inicioFimDoMes(mes);
  let r = await getResumoFaturamento(inicio, fim);
  if (!r) r = await getResumoFaturamento(inicio, fim); // 1 retry
  if (!r) return null;

  // Só congela mês FECHADO (o corrente muda ao longo do dia).
  if (mes < primeiroDiaDoMes()) await congelarMes(supabase, mes, r);
  return resumoToPonto(mes, r);
}

/**
 * Foto de um mês. Lê do Supabase; se faltar e o mês estiver FECHADO, calcula do
 * Winthor uma vez e grava. `null` se o Winthor estiver indisponível.
 */
export async function getFaturamentoMensal(mes: string): Promise<PontoTendencia | null> {
  const supabase = await createClient();
  const snap = await lerSnapshot(supabase, mes);
  if (snap) return snap;
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
      .eq("filial", FILIAL_LABEL)
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

/**
 * Faturamento para o dashboard num mês qualquer. Vem SEMPRE AO VIVO do Winthor —
 * o card tem que espelhar a rotina 111, que recalcula na hora. Foto congelada
 * nunca bate no centavo com o 111 aberto depois, porque devolução entra com data
 * retroativa e cai num mês já fechado. A foto no Supabase deixa de ser a fonte e
 * passa a ser só: (1) fallback quando o Oracle está fora da rede; (2) lastro do
 * gráfico de Tendências (que não pode disparar 12 queries Oracle de uma vez).
 * Memoizado por `mes` p/ cards do topo e detalhamento do rodapé dividirem uma
 * única leitura por request.
 */
export const getResumoFaturamentoDashboard = cache(
  async (mes: string): Promise<ResumoFaturamento | null> => {
    const supabase = await createClient();
    const { inicio, fim } = inicioFimDoMes(mes);

    // 1 retry — o Oracle às vezes derruba a conexão sob concorrência.
    let r = await getResumoFaturamento(inicio, fim);
    if (!r) r = await getResumoFaturamento(inicio, fim);

    if (r) {
      // Mês fechado: atualiza a foto (self-heal) p/ Tendências e fallback offline.
      if (mes < primeiroDiaDoMes()) await congelarMes(supabase, mes, r);
      return r;
    }

    // Oracle fora: cai na última foto conhecida (só existe p/ mês fechado).
    return mes < primeiroDiaDoMes() ? lerSnapshot(supabase, mes) : null;
  },
);

/**
 * Venda líquida dos meses pedidos, SÓ das fotos do Supabase (nunca toca o
 * Winthor). Para comparativos do Painel da TV, que não pode abrir uma conexão
 * Oracle por mês. Mês sem foto (o corrente, ou Supabase fora) fica de fora.
 */
export async function vendaLiquidaDasFotos(meses: string[]): Promise<Map<string, number>> {
  const res = new Map<string, number>();
  if (meses.length === 0) return res;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faturamento_mensal")
    .select("mes, venda_liquida")
    .eq("filial", FILIAL_LABEL)
    .in("mes", meses);
  if (error) {
    console.error("[faturamento-mensal] Supabase indisponível:", error.message);
    return res;
  }
  for (const r of data ?? []) res.set(primeiroDiaDoMes(String(r.mes)), num(r.venda_liquida));
  return res;
}

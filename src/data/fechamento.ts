import { getResumoFaturamento } from "./faturamento";
import { listarFaltas } from "./faltas";
import { listarFuncionarios } from "./funcionarios";
import { createClient } from "@/lib/supabase/server";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { faltasNoPeriodo } from "@/domain/metrics";
import { montarResumoFechamento, type ResumoFechamento } from "@/domain/fechamento";

/** Soma das três origens de receita logística no intervalo [ini, fim]. */
async function receitaTotalDoPeriodo(ini: string, fim: string): Promise<number> {
  const supabase = await createClient();
  const [desc, diarios, diversas] = await Promise.all([
    supabase.from("receitas_descarregamento").select("receita").gte("data", ini).lte("data", fim),
    supabase.from("receitas_descarregamento_diario").select("receita").gte("data", ini).lte("data", fim),
    supabase.from("receitas_diversas").select("valor").gte("data", ini).lte("data", fim),
  ]);
  if (desc.error) throw new Error(desc.error.message);
  if (diarios.error) throw new Error(diarios.error.message);
  if (diversas.error) throw new Error(diversas.error.message);
  const soma = (rows: Array<Record<string, unknown>> | null, col: string) =>
    (rows ?? []).reduce((t, r) => t + Number(r[col]), 0);
  return soma(desc.data, "receita") + soma(diarios.data, "receita") + soma(diversas.data, "valor");
}

/**
 * Monta o resumo de fechamento para o intervalo [ini, fim]. O faturamento vem do
 * Winthor (dia/período e mês, este p/ a taxa de devolução); receitas e faltas do
 * Supabase. Se o Winthor estiver fora, os campos dele vêm null (o card mostra "—").
 */
export async function montarFechamento(ini: string, fim: string): Promise<ResumoFechamento> {
  const [faturamentoPeriodo, faturamentoMes, receitasLogisticas, faltasLista, funcionarios] =
    await Promise.all([
      getResumoFaturamento(ini, fim),
      getResumoFaturamento(primeiroDiaDoMes(fim), fim),
      receitaTotalDoPeriodo(ini, fim),
      listarFaltas(),
      listarFuncionarios(),
    ]);
  const faltas = faltasNoPeriodo(faltasLista, funcionarios.map((f) => f.id), ini, fim);
  return montarResumoFechamento({ ini, fim, faturamentoPeriodo, faturamentoMes, receitasLogisticas, faltas });
}

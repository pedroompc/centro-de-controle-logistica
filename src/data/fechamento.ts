import { getResumoFaturamento } from "./faturamento";
import { listarFaltas } from "./faltas";
import { listarFuncionarios } from "./funcionarios";
import { listarSetores } from "./setores";
import { receitaTotalDoPeriodo } from "./receitas";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { faltasNoPeriodo } from "@/domain/metrics";
import { montarResumoFechamento, setoresComFaltas, type ResumoFechamento } from "@/domain/fechamento";

/**
 * Monta o resumo de fechamento para o intervalo [ini, fim]. O faturamento vem do
 * Winthor (dia/período e mês, este p/ a taxa de devolução); receitas e faltas do
 * Supabase. Se o Winthor estiver fora, os campos dele vêm null (o card mostra "—").
 */
export async function montarFechamento(ini: string, fim: string): Promise<ResumoFechamento> {
  const [faturamentoDia, faturamentoMes, receitasLogisticas, faltasLista, funcionarios, setores] =
    await Promise.all([
      getResumoFaturamento(ini, fim),
      getResumoFaturamento(primeiroDiaDoMes(fim), fim),
      receitaTotalDoPeriodo(ini, fim),
      listarFaltas(),
      listarFuncionarios(),
      listarSetores(),
    ]);
  // Faturamento/peso/PDVs/notas por DATA DE EMISSÃO — batem com o 111 (decisão
  // 12/08). A versão pela janela operacional está parada em ./faturamento-operacional.
  const faturamentoPeriodo = faturamentoDia
    ? {
        vendaFaturada: faturamentoDia.vendaFaturada,
        atendimentos: faturamentoDia.atendimentos,
        emitidas: faturamentoDia.emitidas,
        pesoFaturadoKg: faturamentoDia.pesoFaturado,
      }
    : null;
  const faltas = faltasNoPeriodo(faltasLista, funcionarios.map((f) => f.id), ini, fim);
  const setorPorFuncionario = new Map(funcionarios.map((f) => [f.id, f.setorId]));
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));
  const faltasSetores = setoresComFaltas(faltasLista, setorPorFuncionario, nomeSetor, ini, fim);
  return montarResumoFechamento({
    ini, fim, faturamentoPeriodo, faturamentoMes, receitasLogisticas, faltas, faltasSetores,
  });
}

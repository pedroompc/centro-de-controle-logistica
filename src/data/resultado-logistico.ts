import { listarLancamentosDoMes } from "./custos-mensais";
import { listarFuncionarios } from "./funcionarios";
import { receitaTotalDoMes } from "./receitas";
import { custoTotalAtivos } from "@/domain/metrics";
import { somaLancamentos } from "@/domain/custos-metrics";
import { custoLiquido } from "@/domain/receitas-metrics";

export interface ResultadoLogistico {
  brutos: number;
  receitas: number;
  liquido: number;
}

/**
 * Resultado logístico do mês: custos brutos (salário + fixos + variáveis) menos
 * as receitas de descarregamento. A receita é só demonstrada — não altera nenhum
 * lançamento de custo.
 */
export async function resultadoLogisticoDoMes(mes: string): Promise<ResultadoLogistico> {
  const [lancamentos, funcionarios, receitas] = await Promise.all([
    listarLancamentosDoMes(mes),
    listarFuncionarios(),
    receitaTotalDoMes(mes),
  ]);
  const salario = custoTotalAtivos(funcionarios);
  const brutos = salario + somaLancamentos(lancamentos, "fixo") + somaLancamentos(lancamentos, "variavel");
  return { brutos, receitas, liquido: custoLiquido(brutos, receitas) };
}

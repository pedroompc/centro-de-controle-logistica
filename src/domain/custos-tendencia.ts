/**
 * Custos mês a mês com a lente de EFICIÊNCIA — o que a aba de Custos acrescenta
 * ao comparativo do Dashboard: custo logístico (custo ÷ venda líquida) e R$ por
 * kg faturado. Puro e testável; a camada de dados junta as fontes (custos_mensais
 * + folha do efetivo + faturamento) e passa por mês.
 */
import { percentualCustoLogistico } from "./faturamento";

export interface EntradaCustoMes {
  mes: string; // "yyyy-mm-01"
  fixos: number;
  variaveis: number;
  salario: number; // folha dos ativos
  vendaLiquida: number; // 0 = desconhecida (sem faturamento no mês)
  pesoFaturado: number; // kg; 0 = desconhecido
}

export interface PontoCustoMensal {
  mes: string;
  fixos: number;
  variaveis: number;
  salario: number;
  custoTotal: number; // fixos + variáveis + salário
  custoLogistico: number; // 0..1 (custo ÷ venda líquida); 0 se sem venda
  rsPorKg: number; // custo ÷ kg faturado; 0 se sem peso
}

export function montarCustosMensais(entradas: EntradaCustoMes[]): PontoCustoMensal[] {
  return entradas
    .map((e) => {
      const custoTotal = e.fixos + e.variaveis + e.salario;
      return {
        mes: e.mes,
        fixos: e.fixos,
        variaveis: e.variaveis,
        salario: e.salario,
        custoTotal,
        custoLogistico: percentualCustoLogistico(custoTotal, e.vendaLiquida),
        rsPorKg: e.pesoFaturado > 0 ? custoTotal / e.pesoFaturado : 0,
      };
    })
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

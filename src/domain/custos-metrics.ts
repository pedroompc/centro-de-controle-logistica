import type { CustoMensal, CustoTipo } from "./types";

export function somaLancamentos(custos: CustoMensal[], tipo?: CustoTipo): number {
  return custos
    .filter((c) => (tipo ? c.tipo === tipo : true))
    .reduce((total, c) => total + c.valor, 0);
}

export function totalDoMes(custos: CustoMensal[], salarioEfetivo: number): number {
  return somaLancamentos(custos) + salarioEfetivo;
}

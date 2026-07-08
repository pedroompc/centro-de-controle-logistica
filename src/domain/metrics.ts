import type { Funcionario, Falta, StatusFuncionario } from "./types";

export function custoDoSetor(funcionarios: Funcionario[], setorId: string): number {
  return funcionarios
    .filter((f) => f.setorId === setorId && f.status === "ativo")
    .reduce((total, f) => total + f.custoMensal, 0);
}

export function headcountPorStatus(
  funcionarios: Funcionario[],
  setorId: string,
): Record<StatusFuncionario, number> {
  const base: Record<StatusFuncionario, number> = {
    ativo: 0,
    afastado: 0,
    desligado: 0,
  };
  for (const f of funcionarios) {
    if (f.setorId === setorId) base[f.status] += 1;
  }
  return base;
}

export function faltasNoPeriodo(
  faltas: Falta[],
  funcionarioIds: string[],
  inicio: string,
  fim: string,
): number {
  const ids = new Set(funcionarioIds);
  return faltas.filter(
    (falta) =>
      ids.has(falta.funcionarioId) && falta.data >= inicio && falta.data <= fim,
  ).length;
}

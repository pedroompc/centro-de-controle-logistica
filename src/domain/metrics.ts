import type { Funcionario, Falta, StatusFuncionario, Turno } from "./types";

export const TURNOS: readonly Turno[] = ["manha", "tarde", "noite"];

export const ROTULO_TURNO: Record<Turno, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

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

export function custoTotalAtivos(funcionarios: Funcionario[]): number {
  return funcionarios
    .filter((f) => f.status === "ativo")
    .reduce((total, f) => total + f.custoMensal, 0);
}

/**
 * Ativos e custo mensal por turno — de um setor ou, sem `setorId`, do efetivo
 * inteiro. Devolve sempre os 3 turnos (zerados quando vazios) na ordem do dia.
 */
export function resumoPorTurno(
  funcionarios: Funcionario[],
  setorId?: string,
): { turno: Turno; ativos: number; custo: number }[] {
  return TURNOS.map((turno) => {
    const doTurno = funcionarios.filter(
      (f) => f.turno === turno && f.status === "ativo" && (!setorId || f.setorId === setorId),
    );
    return { turno, ativos: doTurno.length, custo: doTurno.reduce((t, f) => t + f.custoMensal, 0) };
  });
}

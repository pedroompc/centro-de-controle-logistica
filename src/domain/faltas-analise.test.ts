import { describe, it, expect } from "vitest";
import { detalharFaltasDoPeriodo, rankingFaltas } from "./faltas-analise";
import type { Funcionario, Falta } from "./types";

const f = (over: Partial<Funcionario>): Funcionario => ({
  id: "1",
  nome: "X",
  cargo: "Operador",
  setorId: "s1",
  custoMensal: 1000,
  dataAdmissao: "2024-01-01",
  status: "ativo",
  salarioBase: null,
  passagem: null,
  alimentacao: null,
  planoSaude: null,
  ajudaCusto: null,
  premiacao: null,
  adicionalNoturno: null,
  ...over,
});

const funcionarios = [
  f({ id: "a", nome: "Ana", setorId: "s1" }),
  f({ id: "b", nome: "Bruno", setorId: "s2" }),
  f({ id: "c", nome: "Carlos", setorId: "s1" }),
];

const faltas: Falta[] = [
  { id: "1", funcionarioId: "a", data: "2026-07-03", tipo: "injustificada", observacao: "sem aviso" },
  { id: "2", funcionarioId: "a", data: "2026-07-20", tipo: "atestado", observacao: "gripe" },
  { id: "3", funcionarioId: "b", data: "2026-07-10", tipo: "ferias", observacao: null },
  { id: "4", funcionarioId: "a", data: "2026-06-15", tipo: "justificada", observacao: null },
  { id: "5", funcionarioId: "c", data: "2026-07-05", tipo: "injustificada", observacao: null },
  { id: "6", funcionarioId: "zumbi", data: "2026-07-05", tipo: "injustificada", observacao: null },
];

describe("detalharFaltasDoPeriodo", () => {
  it("resolve o funcionário e ordena da mais recente para a mais antiga", () => {
    const det = detalharFaltasDoPeriodo(faltas, funcionarios, "2026-07-01", "2026-07-31");
    expect(det.map((d) => d.id)).toEqual(["2", "3", "5", "1"]);
    expect(det[0]).toMatchObject({ funcionarioNome: "Ana", setorId: "s1", tipo: "atestado" });
  });

  it("inclui férias/folga (explica o número do card) e descarta funcionário inexistente", () => {
    const det = detalharFaltasDoPeriodo(faltas, funcionarios, "2026-07-01", "2026-07-31");
    expect(det.some((d) => d.tipo === "ferias")).toBe(true);
    expect(det.some((d) => d.funcionarioId === "zumbi")).toBe(false);
  });
});

describe("rankingFaltas", () => {
  it("conta ausências reais de todos os períodos, ignorando férias/folga", () => {
    const rank = rankingFaltas(faltas, funcionarios);
    // Ana: injustificada + atestado + justificada = 3; Carlos: 1; Bruno: só férias = 0 (fora).
    expect(rank.map((r) => [r.nome, r.total])).toEqual([
      ["Ana", 3],
      ["Carlos", 1],
    ]);
  });

  it("guarda o detalhamento por tipo, inclusive férias", () => {
    const rank = rankingFaltas(faltas, funcionarios);
    expect(rank[0].porTipo).toMatchObject({ injustificada: 1, atestado: 1, justificada: 1, ferias: 0 });
  });
});

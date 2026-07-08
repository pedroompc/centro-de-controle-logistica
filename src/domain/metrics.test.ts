import { describe, it, expect } from "vitest";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo } from "./metrics";
import type { Funcionario, Falta } from "./types";

const f = (over: Partial<Funcionario>): Funcionario => ({
  id: "1",
  nome: "X",
  cargo: "Operador",
  setorId: "s1",
  custoMensal: 1000,
  dataAdmissao: "2024-01-01",
  status: "ativo",
  ...over,
});

describe("custoDoSetor", () => {
  it("soma apenas ativos do setor", () => {
    const funcs = [
      f({ id: "1", setorId: "s1", custoMensal: 1000, status: "ativo" }),
      f({ id: "2", setorId: "s1", custoMensal: 2000, status: "ativo" }),
      f({ id: "3", setorId: "s1", custoMensal: 5000, status: "afastado" }),
      f({ id: "4", setorId: "s2", custoMensal: 9000, status: "ativo" }),
    ];
    expect(custoDoSetor(funcs, "s1")).toBe(3000);
  });

  it("retorna 0 para setor sem ativos", () => {
    expect(custoDoSetor([f({ status: "desligado" })], "s1")).toBe(0);
  });
});

describe("headcountPorStatus", () => {
  it("conta por status dentro do setor", () => {
    const funcs = [
      f({ id: "1", setorId: "s1", status: "ativo" }),
      f({ id: "2", setorId: "s1", status: "ativo" }),
      f({ id: "3", setorId: "s1", status: "afastado" }),
      f({ id: "4", setorId: "s2", status: "ativo" }),
    ];
    expect(headcountPorStatus(funcs, "s1")).toEqual({
      ativo: 2,
      afastado: 1,
      desligado: 0,
    });
  });
});

describe("faltasNoPeriodo", () => {
  const faltas: Falta[] = [
    { id: "1", funcionarioId: "a", data: "2026-07-03", tipo: "injustificada", observacao: null },
    { id: "2", funcionarioId: "a", data: "2026-06-30", tipo: "atestado", observacao: null },
    { id: "3", funcionarioId: "b", data: "2026-07-10", tipo: "folga", observacao: null },
    { id: "4", funcionarioId: "c", data: "2026-07-05", tipo: "ferias", observacao: null },
  ];

  it("conta faltas dos funcionários no intervalo (inclusive)", () => {
    expect(faltasNoPeriodo(faltas, ["a", "b"], "2026-07-01", "2026-07-31")).toBe(2);
  });

  it("exclui funcionário fora da lista", () => {
    expect(faltasNoPeriodo(faltas, ["a"], "2026-07-01", "2026-07-31")).toBe(1);
  });
});

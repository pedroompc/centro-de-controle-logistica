import { describe, it, expect } from "vitest";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo, custoTotalAtivos, resumoPorTurno } from "./metrics";
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
  turno: "manha",
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

describe("custoTotalAtivos", () => {
  it("soma custo_mensal só dos ativos", () => {
    const funcs = [
      f({ id: "1", custoMensal: 3034, status: "ativo" }),
      f({ id: "2", custoMensal: 3034, status: "ativo" }),
      f({ id: "3", custoMensal: 3034, status: "desligado" }),
    ];
    expect(custoTotalAtivos(funcs)).toBe(6068);
  });
});

describe("resumoPorTurno", () => {
  const funcs = [
    f({ id: "1", setorId: "s1", turno: "manha", custoMensal: 1000 }),
    f({ id: "2", setorId: "s1", turno: "noite", custoMensal: 2000 }),
    f({ id: "3", setorId: "s1", turno: "noite", custoMensal: 3000 }),
    f({ id: "4", setorId: "s1", turno: "noite", custoMensal: 9000, status: "desligado" }),
    f({ id: "5", setorId: "s2", turno: "tarde", custoMensal: 500 }),
  ];

  it("conta ativos e soma custo por turno, sempre com os 3 turnos na ordem", () => {
    expect(resumoPorTurno(funcs, "s1")).toEqual([
      { turno: "manha", ativos: 1, custo: 1000 },
      { turno: "tarde", ativos: 0, custo: 0 },
      { turno: "noite", ativos: 2, custo: 5000 },
    ]);
  });

  it("sem setor considera o efetivo inteiro", () => {
    expect(resumoPorTurno(funcs).map((t) => t.ativos)).toEqual([1, 1, 2]);
  });
});

import { describe, it, expect } from "vitest";
import { mapFuncionario, mapSetor, mapFalta } from "./mappers";

describe("mapFuncionario", () => {
  it("converte snake_case e custo_mensal string em number", () => {
    const row = {
      id: "u1",
      nome: "João",
      cargo: "Operador",
      setor_id: "s1",
      custo_mensal: "2500.50",
      data_admissao: "2024-03-01",
      status: "ativo",
    };
    expect(mapFuncionario(row)).toEqual({
      id: "u1",
      nome: "João",
      cargo: "Operador",
      setorId: "s1",
      custoMensal: 2500.5,
      dataAdmissao: "2024-03-01",
      status: "ativo",
    });
  });
});

describe("mapSetor", () => {
  it("mapeia setor", () => {
    expect(mapSetor({ id: "s1", nome: "Expedição" })).toEqual({
      id: "s1",
      nome: "Expedição",
    });
  });
});

describe("mapFalta", () => {
  it("mapeia falta com observacao null", () => {
    const row = {
      id: "fa1",
      funcionario_id: "u1",
      data: "2026-07-03",
      tipo: "injustificada",
      observacao: null,
    };
    expect(mapFalta(row)).toEqual({
      id: "fa1",
      funcionarioId: "u1",
      data: "2026-07-03",
      tipo: "injustificada",
      observacao: null,
    });
  });
});

import { mapCustoFixo, mapCustoMensal } from "./mappers";

describe("mapCustoFixo", () => {
  it("mapeia e converte valor string em number", () => {
    expect(mapCustoFixo({ id: "cf1", nome: "Galpão", valor: "12000.00", ativo: true }))
      .toEqual({ id: "cf1", nome: "Galpão", valor: 12000, ativo: true });
  });
});

describe("mapCustoMensal", () => {
  it("mapeia lançamento mensal", () => {
    const row = { id: "cm1", mes: "2026-07-01", nome: "Gasolina", tipo: "variavel", valor: "3500.50" };
    expect(mapCustoMensal(row)).toEqual({
      id: "cm1", mes: "2026-07-01", nome: "Gasolina", tipo: "variavel", valor: 3500.5,
    });
  });
});

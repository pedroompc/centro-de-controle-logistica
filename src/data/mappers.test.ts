import { describe, it, expect } from "vitest";
import { mapFuncionario, mapSetor, mapFalta, mapCustoFixo, mapCustoMensal, mapReceita, mapConfig, mapReceitaDiversa, mapTotalDiario } from "./mappers";

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

describe("mapReceita", () => {
  it("converte campos numeric (string) do PostgREST em number", () => {
    const row = {
      id: "r1",
      data: "2026-07-10",
      fornecedor_id: "f1",
      fornecedores: { nome: "Fornecedor 1" },
      peso_kg: "1234.500",
      tipo: "pal_rem",
      preco_por_tonelada: "33.33",
      receita: "41.13",
      minimo_aplicado: "25.00",
      observacao: null,
    };
    const receita = mapReceita(row);
    expect(receita).toEqual({
      id: "r1",
      data: "2026-07-10",
      fornecedorId: "f1",
      fornecedorNome: "Fornecedor 1",
      pesoKg: 1234.5,
      tipo: "pal_rem",
      precoPorTonelada: 33.33,
      receita: 41.13,
      minimoAplicado: 25,
      observacao: null,
    });
    expect(typeof receita.pesoKg).toBe("number");
    expect(typeof receita.precoPorTonelada).toBe("number");
    expect(typeof receita.receita).toBe("number");
    expect(typeof receita.minimoAplicado).toBe("number");
  });
});

describe("mapConfig", () => {
  it("converte valor_minimo (string do PostgREST) em number", () => {
    const config = mapConfig({ valor_minimo: "25.00" });
    expect(config).toEqual({ valorMinimo: 25 });
    expect(typeof config.valorMinimo).toBe("number");
  });
});

describe("mapReceitaDiversa", () => {
  it("converte campos numeric (string) do PostgREST em number", () => {
    expect(
      mapReceitaDiversa({
        id: "d1", data: "2026-07-10", categoria: "reciclagem",
        material: "Plástico stretch", quantidade: "100.500", unidade: "kg",
        preco_unitario: "1.20", valor: "120.60", observacao: null,
      }),
    ).toEqual({
      id: "d1", data: "2026-07-10", categoria: "reciclagem",
      material: "Plástico stretch", quantidade: 100.5, unidade: "kg",
      precoUnitario: 1.2, valor: 120.6, observacao: null,
    });
  });

  it("preserva null em quantidade e preço — não vira zero", () => {
    const m = mapReceitaDiversa({
      id: "d2", data: "2026-07-11", categoria: "reciclagem",
      material: null, quantidade: null, unidade: "kg",
      preco_unitario: null, valor: "80", observacao: "ajuste",
    });
    expect(m.quantidade).toBeNull();
    expect(m.precoUnitario).toBeNull();
    expect(m.valor).toBe(80);
  });
});

describe("mapTotalDiario", () => {
  it("converte snake_case e numéricos vindos como string", () => {
    const row = {
      id: "t1",
      data: "2026-07-15",
      descarregos: "12",
      peso_kg: "34000.000",
      receita: "900.00",
      observacao: null,
    };
    expect(mapTotalDiario(row)).toEqual({
      id: "t1",
      data: "2026-07-15",
      descarregos: 12,
      pesoKg: 34000,
      receita: 900,
      observacao: null,
    });
  });
});

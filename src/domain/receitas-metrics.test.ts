import { describe, it, expect } from "vitest";
import {
  toneladas, calcularReceita, arredonda2, receitaTotal, toneladasTotal,
  valorMedioPorTonelada, receitaPorFornecedor, receitaPorTipo, custoLiquido,
} from "./receitas-metrics";
import type { Receita } from "./types";

const r = (over: Partial<Receita>): Receita => ({
  id: "x", data: "2026-07-10", fornecedorId: "f1", fornecedorNome: "Forn 1",
  pesoKg: 1000, tipo: "batido", precoPorTonelada: 20, receita: 20, observacao: null, ...over,
});

describe("receitas-metrics", () => {
  it("converte kg para toneladas", () => {
    expect(toneladas(12500)).toBe(12.5);
  });

  it("calcula receita = toneladas × preço, 2 casas (exemplo do spec)", () => {
    expect(calcularReceita(12500, 20)).toBe(250);
  });

  it("arredonda a receita a centavos", () => {
    // 1234 kg = 1,234 t × 33,33 = 41,12922 → 41,13
    expect(calcularReceita(1234, 33.33)).toBe(41.13);
    expect(arredonda2(41.129)).toBe(41.13);
  });

  it("soma receita total e toneladas totais", () => {
    const rs = [r({ receita: 250, pesoKg: 12500 }), r({ receita: 100, pesoKg: 5000 })];
    expect(receitaTotal(rs)).toBe(350);
    expect(toneladasTotal(rs)).toBe(17.5);
  });

  it("valor médio por tonelada = receita total / toneladas totais", () => {
    const rs = [r({ receita: 250, pesoKg: 12500 }), r({ receita: 100, pesoKg: 5000 })];
    expect(valorMedioPorTonelada(rs)).toBe(20);
    expect(valorMedioPorTonelada([])).toBe(0);
  });

  it("agrupa receita por fornecedor, desc", () => {
    const rs = [
      r({ fornecedorId: "a", fornecedorNome: "A", receita: 100 }),
      r({ fornecedorId: "b", fornecedorNome: "B", receita: 300 }),
      r({ fornecedorId: "a", fornecedorNome: "A", receita: 50 }),
    ];
    expect(receitaPorFornecedor(rs)).toEqual([
      { fornecedorId: "b", nome: "B", valor: 300 },
      { fornecedorId: "a", nome: "A", valor: 150 },
    ]);
  });

  it("agrupa receita por tipo, incluindo pal_rem", () => {
    const rs = [
      r({ tipo: "batido", receita: 100 }),
      r({ tipo: "paletizado", receita: 40 }),
      r({ tipo: "batido", receita: 10 }),
      r({ tipo: "pal_rem", receita: 25 }),
    ];
    expect(receitaPorTipo(rs)).toEqual({ batido: 110, paletizado: 40, pal_rem: 25 });
  });

  it("zera os tipos sem lançamento em vez de omiti-los", () => {
    expect(receitaPorTipo([])).toEqual({ batido: 0, paletizado: 0, pal_rem: 0 });
  });

  it("custo líquido = brutos − receitas", () => {
    expect(custoLiquido(50000, 8000)).toBe(42000);
  });
});

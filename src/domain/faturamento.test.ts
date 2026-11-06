import { describe, it, expect } from "vitest";
import { taxaDevolucao, taxaDevolucaoNotas, percentualCustoLogistico } from "./faturamento";

describe("taxaDevolucao", () => {
  it("calcula a fração devolvida", () => {
    // valores da tela 111 (filial 1, 01/07): 99.028,07 / 1.380.012,38 ≈ 0,0718
    expect(taxaDevolucao({ valorDevolucao: 99028.07, vendaFaturada: 1380012.38 })).toBeCloseTo(
      0.0718,
      4,
    );
  });
  it("é zero quando não houve venda", () => {
    expect(taxaDevolucao({ valorDevolucao: 100, vendaFaturada: 0 })).toBe(0);
  });
});

describe("taxaDevolucaoNotas", () => {
  it("calcula a fração de NFs devolvidas sobre emitidas", () => {
    // 1.325 devolvidas / 13.685 emitidas ≈ 0,0968
    expect(taxaDevolucaoNotas({ devolvidas: 1325, emitidas: 13685 })).toBeCloseTo(0.0968, 4);
  });
  it("é zero quando não houve emissão", () => {
    expect(taxaDevolucaoNotas({ devolvidas: 5, emitidas: 0 })).toBe(0);
  });
});

describe("percentualCustoLogistico", () => {
  it("calcula custo sobre venda líquida", () => {
    expect(percentualCustoLogistico(128092.5, 1280925.27)).toBeCloseTo(0.1, 4);
  });
  it("é zero quando não houve venda líquida", () => {
    expect(percentualCustoLogistico(5000, 0)).toBe(0);
  });
});

import { somarResumos } from "./faturamento";

describe("somarResumos", () => {
  const r = (v: number) => ({
    emitidas: v, positivados: v, atendimentos: v, devolvidas: v, devolvidasAvulsas: v,
    vendaFaturada: v * 10, valorDevolucao: v, valorDevolucaoAvulsa: 0, vendaLiquida: v * 9, pesoFaturado: v, pesoDevolucao: v,
  });
  it("soma os meses; positivados vem da contagem distinta do período", () => {
    const t = somarResumos([r(1), r(2), r(3)], 4);
    expect(t.vendaFaturada).toBe(60);
    expect(t.vendaLiquida).toBe(54);
    expect(t.atendimentos).toBe(6);
    expect(t.positivados).toBe(4);
  });
});

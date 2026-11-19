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

import { partesEntregaRetira, liquidoEntregaRetira, taxaDevEntregaRetira } from "./faturamento";

const DEV0 = { devEntrega: 0, devRetira: 0, notasDevEntrega: 0, notasDevRetira: 0 };

describe("partesEntregaRetira", () => {
  it("divide o faturado entre entrega e retira (somam 100%)", () => {
    const p = partesEntregaRetira({ entrega: 33_085_227.88, retira: 3_983_984.84, notasEntrega: 17283, notasRetira: 629, ...DEV0 });
    expect(p.entrega).toBeCloseTo(0.8925, 4);
    expect(p.entrega + p.retira).toBeCloseTo(1, 10);
  });
  it("sem venda → zeros", () => {
    expect(partesEntregaRetira({ entrega: 0, retira: 0, notasEntrega: 0, notasRetira: 0, ...DEV0 })).toEqual({ entrega: 0, retira: 0 });
  });
});

describe("liquido/taxa entrega × retira", () => {
  const f = { entrega: 1000, retira: 200, notasEntrega: 10, notasRetira: 2, devEntrega: 50, devRetira: 40, notasDevEntrega: 1, notasDevRetira: 1 };
  it("líquido de cada lado = faturado − devolução do lado", () => {
    expect(liquidoEntregaRetira(f)).toEqual({ entrega: 950, retira: 160 });
  });
  it("taxa de cada lado sobre o próprio faturado", () => {
    expect(taxaDevEntregaRetira(f)).toEqual({ entrega: 0.05, retira: 0.2 });
    expect(taxaDevEntregaRetira({ ...f, retira: 0 }).retira).toBe(0);
  });
});

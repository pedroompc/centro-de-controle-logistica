import { describe, it, expect } from "vitest";
import {
  mesesFechados, taxaDevolucaoMensal, pontosLinha,
  resumoPeriodo, variacaoPercentual, variacaoPP, media, topPorDevolucao, indice,
  type PontoTendencia,
} from "./tendencias";

const ponto = (over: Partial<PontoTendencia>): PontoTendencia => ({
  mes: "2026-01-01", vendaFaturada: 1000, vendaLiquida: 900, valorDevolucao: 100,
  valorDevolucaoAvulsa: 0, devolvidas: 5, devolvidasAvulsas: 0, pesoFaturado: 500,
  pesoDevolucao: 50, emitidas: 20, positivados: 10, ...over,
});

describe("mesesFechados", () => {
  it("retorna os N meses fechados, do mais antigo ao mais novo, sem o corrente", () => {
    const r = mesesFechados(new Date(2026, 6, 13), 3); // julho/2026
    expect(r).toEqual(["2026-04-01", "2026-05-01", "2026-06-01"]);
  });
  it("cruza a virada de ano", () => {
    const r = mesesFechados(new Date(2026, 0, 10), 2); // janeiro/2026
    expect(r).toEqual(["2025-11-01", "2025-12-01"]);
  });
});

describe("taxaDevolucaoMensal", () => {
  it("é devolução / venda faturada", () => {
    expect(taxaDevolucaoMensal({ valorDevolucao: 100, vendaFaturada: 1000 })).toBeCloseTo(0.1, 6);
  });
  it("é 0 quando não houve venda", () => {
    expect(taxaDevolucaoMensal({ valorDevolucao: 50, vendaFaturada: 0 })).toBe(0);
  });
});

describe("pontosLinha", () => {
  it("mapeia o maior valor no topo e o menor na base (dentro do padding)", () => {
    const { pontos, marcadores } = pontosLinha([0, 10], 100, 100, 5);
    // 2 pontos: x nas bordas (pad e largura-pad), y invertido (maior em cima)
    expect(marcadores[0]).toEqual({ x: 5, y: 95, v: 0 });   // menor → base
    expect(marcadores[1]).toEqual({ x: 95, y: 5, v: 10 });  // maior → topo
    expect(pontos).toBe("5.0,95.0 95.0,5.0");
  });
  it("valores iguais ficam no meio (sem divisão por zero)", () => {
    const { marcadores } = pontosLinha([7, 7], 100, 100, 5);
    expect(marcadores.every((m) => m.y === 95)).toBe(true);
  });
});

describe("resumoPeriodo", () => {
  it("soma totais e calcula taxa média agregada (Σdevol / Σfaturado)", () => {
    const r = resumoPeriodo([
      ponto({ vendaFaturada: 1000, vendaLiquida: 900, valorDevolucao: 100, pesoDevolucao: 50 }),
      ponto({ vendaFaturada: 3000, vendaLiquida: 2700, valorDevolucao: 300, pesoDevolucao: 150 }),
    ]);
    expect(r.vendaLiquidaTotal).toBe(3600);
    expect(r.valorDevolucaoTotal).toBe(400);
    expect(r.pesoDevolucaoTotal).toBe(200);
    expect(r.taxaMedia).toBeCloseTo(400 / 4000, 6); // 0.1
  });
  it("taxa média é 0 sem faturamento", () => {
    expect(resumoPeriodo([ponto({ vendaFaturada: 0, valorDevolucao: 10 })]).taxaMedia).toBe(0);
  });
});

describe("variacaoPercentual", () => {
  it("calcula a fração de variação (positiva e negativa)", () => {
    expect(variacaoPercentual(120, 100)).toBeCloseTo(0.2, 6);
    expect(variacaoPercentual(80, 100)).toBeCloseTo(-0.2, 6);
  });
  it("é 0 quando o anterior é 0", () => {
    expect(variacaoPercentual(50, 0)).toBe(0);
  });
});

describe("variacaoPP", () => {
  it("diferença em pontos percentuais entre duas taxas", () => {
    expect(variacaoPP(0.0558, 0.0753)).toBeCloseTo(-1.95, 4); // −1,95 p.p.
  });
});

describe("media", () => {
  it("média simples", () => {
    expect(media([2, 4, 6])).toBe(4);
  });
  it("0 para lista vazia", () => {
    expect(media([])).toBe(0);
  });
});

describe("topPorDevolucao", () => {
  it("ordena por valor de devolução desc e corta em n", () => {
    const r = topPorDevolucao([
      ponto({ mes: "2026-01-01", valorDevolucao: 100 }),
      ponto({ mes: "2026-02-01", valorDevolucao: 300 }),
      ponto({ mes: "2026-03-01", valorDevolucao: 200 }),
    ], 2);
    expect(r.map((p) => p.mes)).toEqual(["2026-02-01", "2026-03-01"]);
  });
});

describe("indice", () => {
  it("normaliza cada valor como fração do maior", () => {
    expect(indice([25, 50, 100])).toEqual([0.25, 0.5, 1]);
  });
  it("não divide por zero quando tudo é 0", () => {
    expect(indice([0, 0])).toEqual([0, 0]);
  });
});

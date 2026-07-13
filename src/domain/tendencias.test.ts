import { describe, it, expect } from "vitest";
import { mesesFechados, taxaDevolucaoMensal, pontosLinha } from "./tendencias";

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

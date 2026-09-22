import { describe, it, expect } from "vitest";
import { montarCustosMensais } from "./custos-tendencia";

describe("montarCustosMensais", () => {
  it("soma o custo total e deriva custo logístico e R$/kg", () => {
    const [p] = montarCustosMensais([
      { mes: "2026-07-01", fixos: 1000, variaveis: 500, salario: 8500, vendaLiquida: 200000, pesoFaturado: 5000 },
    ]);
    expect(p.custoTotal).toBe(10000);
    expect(p.custoLogistico).toBeCloseTo(0.05); // 10000 / 200000
    expect(p.rsPorKg).toBeCloseTo(2); // 10000 / 5000
  });

  it("sem venda/peso, as razões viram 0 (não divide por zero)", () => {
    const [p] = montarCustosMensais([
      { mes: "2026-08-01", fixos: 100, variaveis: 0, salario: 900, vendaLiquida: 0, pesoFaturado: 0 },
    ]);
    expect(p.custoTotal).toBe(1000);
    expect(p.custoLogistico).toBe(0);
    expect(p.rsPorKg).toBe(0);
  });

  it("ordena por mês", () => {
    const pts = montarCustosMensais([
      { mes: "2026-09-01", fixos: 0, variaveis: 0, salario: 0, vendaLiquida: 0, pesoFaturado: 0 },
      { mes: "2026-07-01", fixos: 0, variaveis: 0, salario: 0, vendaLiquida: 0, pesoFaturado: 0 },
    ]);
    expect(pts.map((p) => p.mes)).toEqual(["2026-07-01", "2026-09-01"]);
  });
});

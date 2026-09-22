import { describe, it, expect } from "vitest";
import { compararSerie, valorNoMes } from "./comparativo-mensal";

describe("compararSerie", () => {
  it("primeiro ponto não tem variação; os demais comparam com o anterior", () => {
    const r = compararSerie([
      { mes: "2026-07-01", valor: 100 },
      { mes: "2026-08-01", valor: 150 },
      { mes: "2026-09-01", valor: 120 },
    ]);
    expect(r[0]).toEqual({ mes: "2026-07-01", valor: 100, deltaAbs: null, deltaFrac: null });
    expect(r[1].deltaAbs).toBe(50);
    expect(r[1].deltaFrac).toBeCloseTo(0.5);
    expect(r[2].deltaAbs).toBe(-30);
    expect(r[2].deltaFrac).toBeCloseTo(-0.2);
  });

  it("anterior zero → deltaAbs existe, deltaFrac é null (não divide por zero)", () => {
    const r = compararSerie([
      { mes: "2026-07-01", valor: 0 },
      { mes: "2026-08-01", valor: 40 },
    ]);
    expect(r[1].deltaAbs).toBe(40);
    expect(r[1].deltaFrac).toBeNull();
  });
});

describe("valorNoMes", () => {
  const pontos = [
    { mes: "2026-07-01", valor: 10 },
    { mes: "2026-08-01", valor: 20 },
  ];
  it("retorna o valor do mês pedido, ou null se ausente", () => {
    expect(valorNoMes(pontos, "2026-08-01")).toBe(20);
    expect(valorNoMes(pontos, "2026-09-01")).toBeNull();
  });
});

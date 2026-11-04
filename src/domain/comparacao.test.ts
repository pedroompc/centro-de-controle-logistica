import { describe, it, expect } from "vitest";
import { pctComSinal, ppComSinal, compararPct, compararTaxa, compararAbs, comRotulo } from "./comparacao";

describe("formatação com sinal", () => {
  it("usa o menos tipográfico e some com o sinal no zero arredondado", () => {
    expect(pctComSinal(0.127)).toBe("+12,7%");
    expect(pctComSinal(-0.45, 0)).toBe("−45%");
    expect(pctComSinal(0.0001)).toBe("0,0%");
    expect(ppComSinal(-1.94)).toBe("−1,9 p.p.");
    expect(ppComSinal(0.004, 2)).toBe("0,00 p.p.");
  });
});

describe("compararPct", () => {
  it("direção e cor dependem de 'maior é bom'; empate é bom", () => {
    expect(compararPct(120, 100, false)).toEqual({ texto: "+20,0%", subindo: true, positivo: false });
    expect(compararPct(80, 100, true)).toEqual({ texto: "−20,0%", subindo: false, positivo: false });
    expect(compararPct(100, 100, false)).toEqual({ texto: "0,0%", subindo: false, positivo: true });
  });
  it("sem base não compara", () => {
    expect(compararPct(10, 0, true)).toBeNull();
    expect(compararPct(10, null, true)).toBeNull();
  });
});

describe("compararTaxa", () => {
  it("compara em p.p. por padrão e em % de diferença quando pedido", () => {
    expect(compararTaxa(0.0009, 0.002, false, { casas: 2 })).toEqual({ texto: "−0,11 p.p.", subindo: false, positivo: true });
    expect(compararTaxa(0.053, 0.039, false, { pp: false })).toEqual({ texto: "+1,4%", subindo: true, positivo: false });
    expect(compararTaxa(null, 0.1, false)).toBeNull();
  });
});

describe("compararAbs e comRotulo", () => {
  it("contagem com sinal e período de referência no texto", () => {
    expect(compararAbs(5, 8, true)).toEqual({ texto: "−3", subindo: false, positivo: false });
    expect(comRotulo(compararPct(110, 100, true), "Out")?.texto).toBe("+10,0% vs Out");
    expect(comRotulo(null, "Out")).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { somaLancamentos, totalDoMes } from "./custos-metrics";
import type { CustoMensal } from "./types";

const c = (over: Partial<CustoMensal>): CustoMensal => ({
  id: "1", mes: "2026-07-01", nome: "X", tipo: "fixo", valor: 100, data: null, ...over,
});

describe("somaLancamentos", () => {
  const custos = [
    c({ tipo: "fixo", valor: 1000 }),
    c({ tipo: "fixo", valor: 500 }),
    c({ tipo: "variavel", valor: 300 }),
  ];
  it("soma todos sem filtro", () => {
    expect(somaLancamentos(custos)).toBe(1800);
  });
  it("soma só os fixos", () => {
    expect(somaLancamentos(custos, "fixo")).toBe(1500);
  });
  it("soma só os variáveis", () => {
    expect(somaLancamentos(custos, "variavel")).toBe(300);
  });
});

describe("totalDoMes", () => {
  it("soma lançamentos + salário do efetivo", () => {
    const custos = [c({ valor: 1000 }), c({ tipo: "variavel", valor: 500 })];
    expect(totalDoMes(custos, 749398)).toBe(750898);
  });
});

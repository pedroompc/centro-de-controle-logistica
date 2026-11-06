import { describe, it, expect } from "vitest";
import { somaNosMeses, custoBrutoDoPeriodo } from "./custo-periodo";

describe("somaNosMeses", () => {
  const m = new Map([["2026-07-01", 10], ["2026-08-01", 20]]);
  it("soma só os meses que existem", () => {
    expect(somaNosMeses(m, ["2026-07-01", "2026-08-01", "2026-09-01"])).toBe(30);
  });
  it("nenhum mês com dado = null (sem dado, não zero)", () => {
    expect(somaNosMeses(m, ["2025-07-01"])).toBeNull();
  });
});

describe("custoBrutoDoPeriodo", () => {
  it("Q3 = soma de jul+ago+set (folha + fixos + variáveis)", () => {
    const folha = new Map([["2026-07-01", 100], ["2026-08-01", 110], ["2026-09-01", 120]]);
    const custos = new Map([["2026-07-01", { fixos: 5, variaveis: 1 }], ["2026-09-01", { fixos: 5, variaveis: 2 }]]);
    expect(custoBrutoDoPeriodo(["2026-07-01", "2026-08-01", "2026-09-01"], folha, custos)).toBe(343);
  });
  it("antes do histórico = null", () => {
    expect(custoBrutoDoPeriodo(["2025-07-01"], new Map(), new Map())).toBeNull();
  });
});

import { mesesEquivalentes } from "./custo-periodo";

describe("mesesEquivalentes", () => {
  const HOJE = new Date(2026, 10, 15);
  it("trimestre fechado = 3", () => {
    expect(mesesEquivalentes({ de: "2026-07-01", ate: "2026-09-30" }, HOJE)).toBeCloseTo(3);
  });
  it("mês corrente = fração decorrida (igual ao fracaoDoMes)", () => {
    expect(mesesEquivalentes({ de: "2026-11-01", ate: "2026-11-30" }, HOJE)).toBeCloseTo(15 / 30);
  });
  it("meio mês fechado", () => {
    expect(mesesEquivalentes({ de: "2026-09-16", ate: "2026-09-30" }, HOJE)).toBeCloseTo(0.5);
  });
});

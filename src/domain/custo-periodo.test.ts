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

import { custoDoRecorte } from "./custo-periodo";

describe("custoDoRecorte", () => {
  const hoje = new Date(2026, 10, 6); // 06/11/2026
  const custos = new Map<string, number | null>([
    ["2026-07-01", 100],
    ["2026-08-01", 200],
    ["2026-09-01", 300],
    ["2026-10-01", 400],
    ["2026-11-01", 300],
  ]);
  it("trimestre fechado = soma dos meses", () => {
    expect(custoDoRecorte({ de: "2026-07-01", ate: "2026-09-30" }, custos, hoje)).toEqual({ total: 600, fracao: 3, completo: true });
  });
  it("mês corrente = proporcional aos dias decorridos", () => {
    const r = custoDoRecorte({ de: "2026-11-01", ate: "2026-11-30" }, custos, hoje);
    expect(r.fracao).toBeCloseTo(6 / 30);
    expect(r.total).toBeCloseTo(300 * (6 / 30));
  });
  it("intervalo livre pega a fração de cada mês", () => {
    const r = custoDoRecorte({ de: "2026-09-16", ate: "2026-10-31" }, custos, hoje);
    expect(r.fracao).toBeCloseTo(15 / 30 + 1);
    expect(r.total).toBeCloseTo(150 + 400);
  });
  it("mês sem custo fica de fora e marca incompleto", () => {
    const r = custoDoRecorte({ de: "2026-06-01", ate: "2026-07-31" }, custos, hoje);
    expect(r).toEqual({ total: 100, fracao: 2, completo: false });
  });
  it("nenhum mês com custo = null", () => {
    expect(custoDoRecorte({ de: "2025-10-01", ate: "2025-12-31" }, custos, hoje)).toEqual({ total: null, fracao: 3, completo: false });
  });
});

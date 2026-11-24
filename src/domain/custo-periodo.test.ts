import { describe, it, expect } from "vitest";
import { somaNosMeses, custoBrutoDoPeriodo, custoLogisticoDoPeriodo } from "./custo-periodo";
import type { CustoMensal } from "./types";

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

import { custoDoRecorte, fracaoCustoDoMes } from "./custo-periodo";

describe("fracaoCustoDoMes", () => {
  const hoje = new Date(2026, 10, 6); // 06/11/2026
  it("mês corrente e passados = 1 (custo cheio); futuro = 0", () => {
    expect(fracaoCustoDoMes("2026-11-01", hoje)).toBe(1);
    expect(fracaoCustoDoMes("2026-10-01", hoje)).toBe(1);
    expect(fracaoCustoDoMes("2026-12-01", hoje)).toBe(0);
  });
});

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
  it("mês corrente = custo do mês cheio, fixo (não pelos dias corridos)", () => {
    const r = custoDoRecorte({ de: "2026-11-01", ate: "2026-11-30" }, custos, hoje);
    expect(r.fracao).toBe(1);
    expect(r.total).toBe(300);
  });
  it("mês futuro fica de fora do custo", () => {
    const r = custoDoRecorte({ de: "2026-11-01", ate: "2026-12-31" }, custos, hoje);
    expect(r.fracao).toBe(1);
    expect(r.total).toBe(300);
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

describe("custoLogisticoDoPeriodo (regra do Início)", () => {
  const lanc = [{ valor: 100 }, { valor: 50 }] as CustoMensal[];
  const folhaPorMes = new Map([["2026-08-01", 1000], ["2026-09-01", 2000]]);
  const custosPorMes = new Map([["2026-08-01", { fixos: 10, variaveis: 5 }]]);
  const base = { comHistorico: true, mesUnico: null, lancamentosMes: lanc, folhaAtual: 700, meses: ["2026-08-01", "2026-09-01"], folhaPorMes, custosPorMes };

  it("sem histórico no Supabase: null", () => {
    expect(custoLogisticoDoPeriodo({ ...base, comHistorico: false })).toBeNull();
  });
  it("mês único: lançamentos do mês + folha atual", () => {
    expect(custoLogisticoDoPeriodo({ ...base, mesUnico: "2026-08-01" })).toBe(850);
  });
  it("período livre: soma dos meses tocados", () => {
    expect(custoLogisticoDoPeriodo(base)).toBe(3015);
  });
});

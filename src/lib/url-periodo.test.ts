import { describe, it, expect } from "vitest";
import { comPeriodo, trocarPeriodo, paramsPeriodoDe } from "./url-periodo";

describe("comPeriodo", () => {
  it("preserva de/ate nas telas com período", () => {
    expect(comPeriodo("/custos", new URLSearchParams("de=2026-07-01&ate=2026-09-30&x=1"))).toBe("/custos?de=2026-07-01&ate=2026-09-30");
  });
  it("preserva mes", () => {
    expect(comPeriodo("/", { mes: "2026-09-01" })).toBe("/?mes=2026-09-01");
  });
  it("ignora telas sem período", () => {
    expect(comPeriodo("/setores", { de: "2026-07-01", ate: "2026-09-30" })).toBe("/setores");
  });
  it("sem período = link limpo", () => {
    expect(comPeriodo("/devolucoes", new URLSearchParams(""))).toBe("/devolucoes");
  });
});

describe("trocarPeriodo", () => {
  it("de/ate vence mes; troca preserva filtros e limpa chaves pedidas", () => {
    expect(paramsPeriodoDe({ mes: "2026-09-01", de: "2026-07-01", ate: "2026-07-31" })).toEqual({ de: "2026-07-01", ate: "2026-07-31" });
    const p = trocarPeriodo(new URLSearchParams("mes=2026-09-01&motivo=3&dia=2026-09-10"), { de: "2026-07-01", ate: "2026-09-30" }, ["dia"]);
    expect(p.toString()).toBe("motivo=3&de=2026-07-01&ate=2026-09-30");
  });
});

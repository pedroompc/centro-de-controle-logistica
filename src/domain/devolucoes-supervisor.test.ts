import { describe, it, expect } from "vitest";
import { pastaDoSupervisor, agruparPorPasta, taxaSobreLiquido, totalPastas, setoresZerados } from "./devolucoes-supervisor";
import type { LinhaSupervisor } from "./devolucoes-supervisor";

describe("pastaDoSupervisor", () => {
  it.each([
    [43, "DIA FOOD INTERNET", "DIA FOOD"],
    [67, "DIA FOOD SERVICE VENDA EXTERNA ESP", "DIA FOOD"],
    [13, "DIA  WINE  LD VINHO", "DIA WINE"],
    [24, "DIA  WINE INTERNET WEB ", "DIA WINE"],
    [87, "DIA  WINE X WINE ", "DIA WINE"],
    [17, "ATACADIA", "ATACADIA"],
    [88, "ATACADIA SERTAO", "ATACADIA"],
    [73, "ATACADO", "ATACADIA"],
    [82, "AGRESTE 2 ESP TAYNA IGOR", "AGRESTE"],
    [39, "RMR/ZM 2 NORTE RODERICO ARAUJO ESP", "RMR/ZM"],
    [91, "SERTAO 2 ESP PETROLINA/ARARIPE", "SERTÃO"],
    [90, "DIA PET", "DIA PET"],
    [28, "FARMADIA", "FARMADIA"],
    [49, "WEB DIST B2B NOVOS CLIENTES", "WEB DIST B2B NOVOS CLIENTES"],
    [0, "", "SEM SUPERVISOR"],
  ])("%i %s → %s", (cod, nome, pasta) => {
    expect(pastaDoSupervisor(cod, nome)).toBe(pasta);
  });
});

const linha = (over: Partial<LinhaSupervisor>): LinhaSupervisor => ({
  cod: 1, nome: "X", faturado: 1000, devolvidoTodos: 100,
  setores: { ...setoresZerados(), Comercial: 60, Logística: 40 }, ...over,
});

describe("agruparPorPasta", () => {
  it("soma os supervisores na pasta e calcula o líquido", () => {
    const r = agruparPorPasta([
      linha({ cod: 15, nome: "DIA FOOD SERVICE TELEVENDAS" }),
      linha({ cod: 16, nome: "DIA FOOD SERVICE VENDA EXTERNA", faturado: 3000, devolvidoTodos: 0, setores: setoresZerados() }),
      linha({ cod: 90, nome: "DIA PET", faturado: 500, devolvidoTodos: 0, setores: setoresZerados() }),
    ]);
    expect(r.map((p) => p.pasta)).toEqual(["DIA FOOD", "DIA PET"]);
    const food = r[0];
    expect(food.liquido).toBe(900 + 3000);
    expect(food.devolucao).toBe(100);
    expect(food.setores.Comercial).toBe(60);
    expect(food.supervisores.map((s) => s.cod)).toEqual([16, 15]); // maior líquido primeiro
  });

  it("líquido usa a devolução sem filtro; a coluna de devolução usa a filtrada", () => {
    const [p] = agruparPorPasta([
      linha({ devolvidoTodos: 100, setores: { ...setoresZerados(), Logística: 40 } }),
    ]);
    expect(p.liquido).toBe(900);
    expect(p.devolucao).toBe(40);
  });

  it("total soma as pastas", () => {
    const t = totalPastas(agruparPorPasta([linha({ cod: 15, nome: "DIA FOOD A" }), linha({ cod: 26, nome: "DIA WINE VINHO" })]));
    expect(t.liquido).toBe(1800);
    expect(t.devolucao).toBe(200);
    expect(t.setores.Logística).toBe(80);
  });
});

describe("taxaSobreLiquido", () => {
  it("divide pelo líquido e protege líquido ≤ 0", () => {
    expect(taxaSobreLiquido(50, 1000)).toBe(0.05);
    expect(taxaSobreLiquido(50, 0)).toBe(0);
    expect(taxaSobreLiquido(50, -10)).toBe(0);
  });
});

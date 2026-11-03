import { describe, it, expect } from "vitest";
import { montarDiasSemana, baseDevolucao, ROTULOS_DIA } from "./devolucoes-dia-semana";

describe("montarDiasSemana", () => {
  it("devolve sempre os 7 dias, de segunda a domingo, com zero onde não há devolução", () => {
    const dias = montarDiasSemana([{ dia: 2, valor: 300, peso: 30, notas: 3 }]);
    expect(dias.map((d) => d.rotulo)).toEqual(ROTULOS_DIA);
    expect(dias[2]).toMatchObject({ dia: 2, rotulo: "Qua", valor: 300, peso: 30, notas: 3 });
    expect(dias[0]).toMatchObject({ valor: 0, peso: 0, notas: 0 });
  });

  it("calcula a participação de cada dia no total de valor e de peso", () => {
    const dias = montarDiasSemana([
      { dia: 0, valor: 750, peso: 10, notas: 1 },
      { dia: 4, valor: 250, peso: 30, notas: 1 },
    ]);
    expect(dias[0].pctValor).toBeCloseTo(0.75);
    expect(dias[4].pctValor).toBeCloseTo(0.25);
    expect(dias[4].pctPeso).toBeCloseTo(0.75);
  });

  it("soma linhas repetidas do mesmo dia e ignora dia fora de 0–6", () => {
    const dias = montarDiasSemana([
      { dia: 1, valor: 100, peso: 1, notas: 1 },
      { dia: 1, valor: 50, peso: 2, notas: 2 },
      { dia: 9, valor: 999, peso: 9, notas: 9 },
    ]);
    expect(dias[1]).toMatchObject({ valor: 150, peso: 3, notas: 3 });
    expect(dias.reduce((t, d) => t + d.valor, 0)).toBe(150);
  });

  it("sem devolução, as participações ficam em zero (sem divisão por zero)", () => {
    expect(montarDiasSemana([]).every((d) => d.pctValor === 0 && d.pctPeso === 0)).toBe(true);
  });
});

describe("baseDevolucao", () => {
  it("só aceita 'faturamento'; qualquer outro valor cai na data da devolução", () => {
    expect(baseDevolucao("faturamento")).toBe("faturamento");
    expect(baseDevolucao(undefined)).toBe("devolucao");
    expect(baseDevolucao("x")).toBe("devolucao");
  });
});

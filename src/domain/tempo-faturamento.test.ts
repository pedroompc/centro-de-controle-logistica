import { describe, expect, it } from "vitest";
import { medianaDoHistograma, resumirTempos } from "./tempo-faturamento";

describe("medianaDoHistograma", () => {
  it("pondera pela quantidade de pedidos", () => {
    expect(medianaDoHistograma([{ horas: 10, qtd: 1 }, { horas: 20, qtd: 1 }, { horas: 30, qtd: 1 }])).toBe(20);
    expect(medianaDoHistograma([{ horas: 50, qtd: 1 }, { horas: 10, qtd: 3 }])).toBe(10);
  });
  it("vazio dá null", () => {
    expect(medianaDoHistograma([])).toBeNull();
  });
});

describe("resumirTempos", () => {
  const linhas = [
    { cidade: "RECIFE", uf: "PE", horas: 10, qtd: 2 },
    { cidade: "RECIFE", uf: "PE", horas: 30, qtd: 1 },
    { cidade: "CARUARU", uf: "PE", horas: 47, qtd: 1 },
    { cidade: "PETROLINA", uf: "PE", horas: 130, qtd: 1 },
  ];

  it("totais, mediana e faixas", () => {
    const r = resumirTempos(linhas);
    expect(r.pedidos).toBe(5);
    expect(r.medianaH).toBe(30);
    expect(r.ate24).toBeCloseTo(2 / 5);
    expect(r.ate48).toBeCloseTo(4 / 5);
    expect(r.mais5d).toBeCloseTo(1 / 5);
  });

  it("por região na ordem fixa, sem regiões vazias", () => {
    const r = resumirTempos(linhas);
    expect(r.porRegiao.map((g) => g.regiao)).toEqual(["RMR", "Agreste", "Sertão"]);
    expect(r.porRegiao[0]).toEqual({ regiao: "RMR", pedidos: 3, medianaH: 10 });
  });

  it("sem pedidos: tudo zerado e mediana null", () => {
    const r = resumirTempos([]);
    expect(r).toMatchObject({ pedidos: 0, medianaH: null, ate24: 0, porRegiao: [] });
  });
});

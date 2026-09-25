import { describe, it, expect } from "vitest";
import {
  janelaGestao, mesAnoAnterior, comparar, media12, INDICADORES, MES_VAZIO, type MesGestao,
} from "./gestao";

const ind = (id: string) => INDICADORES.find((i) => i.id === id)!;
const mes = (m: string, over: Partial<MesGestao> = {}): MesGestao => ({ ...MES_VAZIO(m), ...over });

describe("janelaGestao", () => {
  it("tem 13 meses terminando no mês pedido, incluindo o mesmo mês do ano anterior", () => {
    const j = janelaGestao("2026-08-01");
    expect(j).toHaveLength(13);
    expect(j[0]).toBe("2025-08-01");
    expect(j[12]).toBe("2026-08-01");
  });
  it("normaliza qualquer dia para o 1º do mês", () => {
    expect(janelaGestao("2026-08-17")[12]).toBe("2026-08-01");
  });
});

describe("mesAnoAnterior", () => {
  it("volta 12 meses", () => {
    expect(mesAnoAnterior("2026-01-01")).toBe("2025-01-01");
  });
});

describe("comparar", () => {
  it("taxa compara em pontos percentuais e respeita a direção", () => {
    const r = comparar(ind("devolucao"),
      mes("2026-08-01", { valorDevolucao: 30, vendaFaturada: 1000 }),
      mes("2026-07-01", { valorDevolucao: 20, vendaFaturada: 1000 }));
    expect(r.delta).toBeCloseTo(1, 6); // 3% − 2% = +1 p.p.
    expect(r.bom).toBe(false); // devolução subiu = ruim
  });
  it("volume compara em variação percentual e é neutro", () => {
    const r = comparar(ind("peso"), mes("2026-08-01", { pesoKg: 1100 }), mes("2026-07-01", { pesoKg: 1000 }));
    expect(r.delta).toBeCloseTo(0.1, 6);
    expect(r.bom).toBeNull();
  });
  it("sem dado num dos meses não compara (nem inventa zero)", () => {
    const r = comparar(ind("peso"), mes("2026-08-01", { pesoKg: 1000 }), mes("2026-07-01"));
    expect(r).toEqual({ valor: 1000, base: null, delta: null, bom: null });
  });
  it("mês ausente da série vira sem dado", () => {
    expect(comparar(ind("peso"), undefined, undefined).valor).toBeNull();
  });
  it("D+1 sobe = bom", () => {
    const servico = (ateD1: number) => ({ pedidos: 100, ateD0: 0, ateD1, d3mais: 0, medianaHoras: null, p90Horas: null, comHora: 0 });
    const r = comparar(ind("d1"), mes("2026-08-01", { servico: servico(90) }), mes("2026-07-01", { servico: servico(80) }));
    expect(r.delta).toBeCloseTo(10, 6);
    expect(r.bom).toBe(true);
  });
  it("movimentos por tonelada precisa de verticais, horizontais e peso", () => {
    const m = mes("2026-08-01", { movVerticais: 300, movHorizontais: 100, pesoKg: 200_000 });
    expect(ind("movTon").valor(m)).toBe(2);
    expect(ind("movTon").valor(mes("2026-08-01", { movVerticais: 300, pesoKg: 200_000 }))).toBeNull();
  });
});

describe("media12", () => {
  it("média dos meses anteriores com dado, sem o mês atual", () => {
    const serie = [
      mes("2026-06-01", { pesoKg: 100 }),
      mes("2026-07-01"),
      mes("2026-08-01", { pesoKg: 300 }),
      mes("2026-09-01", { pesoKg: 999 }),
    ];
    expect(media12(ind("peso"), serie, "2026-09-01")).toBe(200);
  });
  it("sem nenhum mês com dado é null", () => {
    expect(media12(ind("peso"), [mes("2026-08-01")], "2026-09-01")).toBeNull();
  });
});

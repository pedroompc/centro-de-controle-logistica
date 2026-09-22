import { describe, it, expect } from "vitest";
import {
  agregarPorMes,
  pesoMedioPorCarro,
  receitaMediaPorCarro,
  tipoPredominante,
  mixFracao,
} from "./descarregamento-tendencia";
import type { TotalDiarioDescarregamento } from "./types";

function diario(
  data: string,
  descarregos: number,
  porTipo: TotalDiarioDescarregamento["porTipo"],
  pesoKg: number,
  receita: number,
): TotalDiarioDescarregamento {
  return { id: data, data, descarregos, porTipo, pesoKg, receita, observacao: null };
}

describe("agregarPorMes", () => {
  it("soma carros, peso, receita e tipos por mês, ordenando por mês", () => {
    const pontos = agregarPorMes([
      diario("2026-08-05", 4, { batido: 3, paletizado: 1, pal_rem: 0, volume: 0 }, 12000, 800),
      diario("2026-07-20", 2, { batido: 1, paletizado: 0, pal_rem: 1, volume: 0 }, 5000, 300),
      diario("2026-08-18", 3, { batido: 0, paletizado: 2, pal_rem: 0, volume: 1 }, 9000, 600),
    ]);

    expect(pontos.map((p) => p.mes)).toEqual(["2026-07-01", "2026-08-01"]);

    const ago = pontos[1];
    expect(ago.carros).toBe(7);
    expect(ago.carrosDetalhados).toBe(7);
    expect(ago.pesoKg).toBe(21000);
    expect(ago.receita).toBe(1400);
    expect(ago.dias).toBe(2);
    expect(ago.porTipo).toEqual({ batido: 3, paletizado: 3, pal_rem: 0, volume: 1 });
  });

  it("registro sem quebra por tipo conta em carros mas não em carrosDetalhados", () => {
    const [p] = agregarPorMes([
      diario("2026-09-01", 5, null, 15000, 1000),
      diario("2026-09-02", 2, { batido: 2, paletizado: 0, pal_rem: 0, volume: 0 }, 6000, 400),
    ]);
    expect(p.carros).toBe(7);
    expect(p.carrosDetalhados).toBe(2);
    expect(p.porTipo.batido).toBe(2);
  });
});

describe("métricas derivadas", () => {
  const p = {
    mes: "2026-08-01",
    carros: 10,
    carrosDetalhados: 10,
    pesoKg: 30000,
    receita: 2000,
    porTipo: { batido: 6, paletizado: 3, pal_rem: 1, volume: 0 },
    dias: 5,
  };

  it("peso e receita médios por carro", () => {
    expect(pesoMedioPorCarro(p)).toBe(3000);
    expect(receitaMediaPorCarro(p)).toBe(200);
  });

  it("divisão por zero vira 0 (mês sem carro)", () => {
    expect(pesoMedioPorCarro({ pesoKg: 100, carros: 0 })).toBe(0);
    expect(receitaMediaPorCarro({ receita: 100, carros: 0 })).toBe(0);
  });

  it("tipo predominante é o de mais carros, com sua fração", () => {
    const t = tipoPredominante(p);
    expect(t.tipo).toBe("batido");
    expect(t.carros).toBe(6);
    expect(t.fracao).toBeCloseTo(0.6);
  });

  it("mês sem quebra não tem tipo predominante", () => {
    const t = tipoPredominante({ ...p, carrosDetalhados: 0, porTipo: { batido: 0, paletizado: 0, pal_rem: 0, volume: 0 } });
    expect(t.tipo).toBeNull();
    expect(t.fracao).toBe(0);
  });

  it("mix em fração soma ~1 quando há carros detalhados", () => {
    const mix = mixFracao(p);
    const soma = mix.batido + mix.paletizado + mix.pal_rem + mix.volume;
    expect(soma).toBeCloseTo(1);
    expect(mix.batido).toBeCloseTo(0.6);
  });
});

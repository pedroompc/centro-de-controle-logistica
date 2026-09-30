import { describe, it, expect } from "vitest";
import {
  agregarPorMes,
  pesoMedioPorCarro,
  receitaMediaPorCarro,
  tipoPredominante,
  mixFracao,
  diariosDosLancamentos,
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
  it("carros = batido+paletizado+pal-rem; volume vira caixas, fora de carros", () => {
    const pontos = agregarPorMes([
      diario("2026-08-05", 4, { batido: 3, paletizado: 1, pal_rem: 0, volume: 0 }, 12000, 800),
      diario("2026-07-20", 2, { batido: 1, paletizado: 0, pal_rem: 1, volume: 0 }, 5000, 300),
      diario("2026-08-18", 100, { batido: 0, paletizado: 2, pal_rem: 0, volume: 98 }, 9000, 600),
    ]);

    expect(pontos.map((p) => p.mes)).toEqual(["2026-07-01", "2026-08-01"]);

    const ago = pontos[1];
    // 4 (3+1) + 2 paletizado = 6 carros; os 98 volume NÃO contam como carro
    expect(ago.carros).toBe(6);
    expect(ago.carrosDetalhados).toBe(6);
    expect(ago.caixas).toBe(98);
    expect(ago.pesoKg).toBe(21000);
    expect(ago.receita).toBe(1400);
    expect(ago.porTipo).toEqual({ batido: 3, paletizado: 3, pal_rem: 0, volume: 98 });
  });

  it("registro sem quebra por tipo cai no total gravado (melhor esforço)", () => {
    const [p] = agregarPorMes([
      diario("2026-09-01", 5, null, 15000, 1000),
      diario("2026-09-02", 2, { batido: 2, paletizado: 0, pal_rem: 0, volume: 0 }, 6000, 400),
    ]);
    expect(p.carros).toBe(7); // 5 (fallback) + 2 batido
    expect(p.carrosDetalhados).toBe(2);
    expect(p.caixas).toBe(0);
  });
});

describe("métricas derivadas", () => {
  const p = {
    mes: "2026-08-01",
    carros: 10,
    carrosDetalhados: 10,
    caixas: 500,
    pesoKg: 30000,
    receita: 2000,
    porTipo: { batido: 6, paletizado: 3, pal_rem: 1, volume: 500 },
    dias: 5,
  };

  it("peso e receita médios por carro (volume não infla o denominador)", () => {
    expect(pesoMedioPorCarro(p)).toBe(3000);
    expect(receitaMediaPorCarro(p)).toBe(200);
  });

  it("divisão por zero vira 0 (mês sem carro)", () => {
    expect(pesoMedioPorCarro({ pesoKg: 100, carros: 0 })).toBe(0);
    expect(receitaMediaPorCarro({ receita: 100, carros: 0 })).toBe(0);
  });

  it("tipo predominante é o tipo de carro com mais carros (volume ignorado)", () => {
    const t = tipoPredominante(p);
    expect(t.tipo).toBe("batido");
    expect(t.carros).toBe(6);
    expect(t.fracao).toBeCloseTo(0.6);
  });

  it("mix em fração soma ~1 sobre os carros; volume fica de fora", () => {
    const mix = mixFracao(p);
    const soma = mix.batido + mix.paletizado + mix.pal_rem;
    expect(soma).toBeCloseTo(1);
    expect(mix.volume).toBe(0);
    expect(mix.batido).toBeCloseTo(0.6);
  });
});

describe("diariosDosLancamentos", () => {
  const lanc = (data: string, tipo: "batido" | "paletizado" | "pal_rem" | "volume", pesoKg: number, receita: number, quantidade: number | null = null) =>
    ({ data, tipo, quantidade, pesoKg, receita });

  it("um dia por data: cada lançamento de carro é 1 carro; volume soma caixas", () => {
    const dias = diariosDosLancamentos([
      lanc("2026-09-01", "batido", 20000, 1260),
      lanc("2026-09-01", "pal_rem", 5000, 260),
      lanc("2026-09-01", "volume", 800, 64, 80),
      lanc("2026-09-02", "paletizado", 10000, 300),
    ]);
    expect(dias).toHaveLength(2);
    const d1 = dias.find((d) => d.data === "2026-09-01")!;
    expect(d1.descarregos).toBe(2); // volume não é carro
    expect(d1.porTipo).toEqual({ batido: 1, paletizado: 0, pal_rem: 1, volume: 80 });
    expect(d1.pesoKg).toBe(25800);
    expect(d1.receita).toBe(1584);
  });

  it("junto com totais do dia: soma as duas origens e não conta o dia duas vezes", () => {
    const [p] = agregarPorMes([
      diario("2026-09-01", 3, { batido: 3, paletizado: 0, pal_rem: 0, volume: 0 }, 9000, 500),
      ...diariosDosLancamentos([lanc("2026-09-01", "batido", 20000, 1260), lanc("2026-09-03", "volume", 100, 25, 40)]),
    ]);
    expect(p.carros).toBe(4);
    expect(p.carrosDetalhados).toBe(4);
    expect(p.caixas).toBe(40);
    expect(p.receita).toBe(1785);
    expect(p.dias).toBe(2);
  });
});

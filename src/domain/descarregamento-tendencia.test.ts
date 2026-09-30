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
    pesoPorTipo: { batido: 18000, paletizado: 9000, pal_rem: 3000, volume: 0 },
    descargasVolume: 0,
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
    expect(d1.pesoPorTipo).toEqual({ batido: 20000, paletizado: 0, pal_rem: 5000, volume: 800 });
    expect(d1.descargasVolume).toBe(1); // 1 descarga de volume, com 80 caixas
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
    // Peso por tipo só do que tem quebra: os 9000 kg do total do dia ficam de fora.
    expect(p.pesoPorTipo).toEqual({ batido: 20000, paletizado: 0, pal_rem: 0, volume: 100 });
    expect(p.pesoKg).toBe(29100);
    expect(p.descargasVolume).toBe(1);
    expect(p.carros).toBe(4); // a descarga de volume não vira carro
  });
});

describe("diariosDosLancamentos com a contagem real de carros", () => {
  it("troca carros e descargas de volume do dia; peso, receita e caixas seguem as notas", () => {
    const lanc = (tipo: "batido" | "pal_rem" | "volume", quantidade: number | null = null) =>
      ({ data: "2026-07-10", tipo, quantidade, pesoKg: 1000, receita: 100 });
    const [d] = diariosDosLancamentos(
      [lanc("batido"), lanc("batido"), lanc("batido"), lanc("pal_rem"), lanc("volume", 40)],
      [{ data: "2026-07-10", porTipo: { batido: 1, paletizado: 0, pal_rem: 1, volume: 0 } }],
    );
    expect(d.descarregos).toBe(2);
    expect(d.porTipo).toEqual({ batido: 1, paletizado: 0, pal_rem: 1, volume: 40 });
    expect(d.descargasVolume).toBe(0);
    expect(d.pesoKg).toBe(5000);
    expect(d.receita).toBe(500);
    expect(agregarPorMes([d])[0].carros).toBe(2);
  });
});

describe("descargas de volume com carros no lançamento", () => {
  it("soma os carros do lançamento de volume (sem informar, 1)", () => {
    const [d] = diariosDosLancamentos([
      { data: "2026-10-01", tipo: "volume", quantidade: 300, carros: 2, pesoKg: 900, receita: 240 },
      { data: "2026-10-01", tipo: "volume", quantidade: 40, carros: null, pesoKg: 100, receita: 32 },
    ]);
    expect(d.descargasVolume).toBe(3);
    expect(d.porTipo!.volume).toBe(340); // caixas
    expect(d.descarregos).toBe(0); // volume fora dos carros de batido/paletizado/pal-rem
  });
});

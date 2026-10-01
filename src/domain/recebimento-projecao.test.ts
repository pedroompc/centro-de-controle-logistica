import { describe, it, expect } from "vitest";
import { carrosPorDia, percentil, perfilDiario, baseDoRitmo, projetar, CENARIO_ATUAL } from "./recebimento-projecao";
import { calcularIndicadores } from "./recebimento";
import type { TotalDiarioDescarregamento } from "./types";

function dia(data: string, descarregos: number, porTipo?: TotalDiarioDescarregamento["porTipo"]): TotalDiarioDescarregamento {
  return { id: data, data, descarregos, porTipo, pesoKg: 0, receita: 0, observacao: null } as TotalDiarioDescarregamento;
}

describe("carrosPorDia / perfil", () => {
  it("soma as duas formas de lançar no mesmo dia e usa a quebra por tipo quando existe", () => {
    const r = carrosPorDia([
      dia("2026-09-02", 3),
      dia("2026-09-02", 0, { batido: 1, paletizado: 1, pal_rem: 2, volume: 500 }),
      dia("2026-09-01", 5),
    ]);
    expect(r).toEqual([
      { data: "2026-09-01", carros: 5 },
      { data: "2026-09-02", carros: 7 },
    ]);
  });
  it("percentil e pico", () => {
    expect(percentil([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
    const p = perfilDiario([{ data: "a", carros: 4 }, { data: "b", carros: 10 }, { data: "c", carros: 7 }]);
    expect(p.pico).toBe(10);
    expect(p.diaPico).toBe("b");
    expect(p.media).toBe(7);
  });
});

const equipe = { setor: "Recebimento", total: 8, ajudantes: 5, conferentes: 2, custo: 30_000 };
const mes = (m: string, carros: number, fr = 1) =>
  calcularIndicadores({
    mes: m,
    equipe,
    equipeEstimada: false,
    diasDescarrego: 20,
    carros,
    pesoKg: carros * 15_000,
    receitaDescarrego: carros * 1_000,
    faturamentoLiquido: 4_000_000,
    fracaoMes: fr,
  });
const serie = [mes("2026-07-01", 140), mes("2026-08-01", 150), mes("2026-09-01", 160), mes("2026-10-01", 10, 0.1)];
const base = baseDoRitmo(serie, { ajudante: 3000, conferente: 3500 })!;
const perfil = { dias: 60, media: 7.5, p90: 10, pico: 12, diaPico: "x" };

describe("baseDoRitmo", () => {
  it("média dos meses fechados; ignora o mês em andamento", () => {
    expect(base.meses).toEqual(["2026-07-01", "2026-08-01", "2026-09-01"]);
    expect(base.carrosMes).toBe(150);
    expect(base.receitaPorCarro).toBe(1000);
    expect(base.kgPorCarro).toBe(15_000);
    expect(base.faturamentoMes).toBe(4_000_000);
  });
});

describe("projetar", () => {
  it("ritmo atual: 12 meses iguais, resultado = receita − custo", () => {
    const p = projetar(base, perfil, CENARIO_ATUAL);
    expect(p.meses).toHaveLength(12);
    expect(p.mensal.receita).toBe(150_000);
    expect(p.anual.resultado).toBe(12 * (150_000 - 30_000));
    expect(p.ajudante.porPessoaDia).toBe(2.4); // maior dia 12 ÷ 5 ajudantes
    expect(p.ajudante.uso).toBeCloseTo(10 / 12); // dia forte 10 de 12 possíveis
    expect(p.ajudante.situacao).toBe("folga");
  });
  it("+1 carro/dia: soma dias×1 carro por mês e chega no limite", () => {
    const p = projetar(base, perfil, { ...CENARIO_ATUAL, carrosExtrasDia: 1 });
    expect(p.mensal.carros).toBe(170);
    expect(p.mensal.receita).toBe(170_000);
    expect(p.ajudante.situacao).toBe("no limite"); // 11 de 12
  });
  it("+3 carros/dia: passa do maior dia e pede mais gente", () => {
    const p = projetar(base, perfil, { ...CENARIO_ATUAL, carrosExtrasDia: 3 });
    expect(p.ajudante.situacao).toBe("não dá conta"); // 13 de 12
    expect(p.ajudante.necessarios).toBe(6); // 13 ÷ 2,4 por ajudante
  });
  it("contratar 1 ajudante: custo sobe o custo médio e a capacidade folga", () => {
    const p = projetar(base, perfil, { ...CENARIO_ATUAL, deltaAjudantes: 1 });
    expect(p.mensal.custo).toBe(33_000);
    expect(p.ajudante.capacidadeDia).toBeCloseTo(14.4);
    expect(p.ajudante.situacao).toBe("folga");
  });
  it("demitir não deixa equipe negativa", () => {
    const p = projetar(base, perfil, { ...CENARIO_ATUAL, deltaAjudantes: -10 });
    expect(p.ajudantes).toBe(0);
    expect(p.mensal.kgPorAjudanteDia).toBeNull();
  });
});

describe("baseDoRitmo · janela", () => {
  const longa = ["2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01"].map((m, i) => mes(m, 100 + i * 10));
  it("3 = últimos 3 fechados (a janela anda); 999 = todos", () => {
    expect(baseDoRitmo(longa, { ajudante: 0, conferente: 0 }, 3)!.meses).toEqual(["2026-09-01", "2026-10-01", "2026-11-01"]);
    expect(baseDoRitmo(longa, { ajudante: 0, conferente: 0 }, 3)!.carrosMes).toBe(130);
    expect(baseDoRitmo(longa, { ajudante: 0, conferente: 0 }, 999)!.carrosMes).toBe(120);
  });
});

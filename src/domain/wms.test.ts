import { describe, it, expect } from "vitest";
import {
  percentil, estatisticaSeparacao, porUnidade, TETO_SEPARACAO_MIN, janelaMeses,
  movimentosPorTonelada, abastecimentosPorCarga, linhasPorHora, estatisticaPorMes,
  MOV_VAZIO, COLETOR_VAZIO, type PontoWms,
} from "./wms";

describe("percentil", () => {
  it("interpola entre os vizinhos", () => {
    expect(percentil([10, 20, 30, 40], 0.5)).toBe(25);
    expect(percentil([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 0.9)).toBe(90);
  });
  it("lista de um elemento devolve o próprio", () => {
    expect(percentil([7], 0.9)).toBe(7);
  });
  it("é 0 para lista vazia", () => {
    expect(percentil([], 0.5)).toBe(0);
  });
});

describe("estatisticaSeparacao", () => {
  it("calcula média, mediana e P90 das durações válidas", () => {
    const r = estatisticaSeparacao([30, 10, 20, 40]);
    expect(r.qtd).toBe(4);
    expect(r.descartadas).toBe(0);
    expect(r.mediaMin).toBe(25);
    expect(r.medianaMin).toBe(25);
    expect(r.p90Min).toBeCloseTo(37, 6);
  });
  it("descarta negativas e acima do teto e conta o descarte", () => {
    const r = estatisticaSeparacao([20, -5, TETO_SEPARACAO_MIN + 1, 40, NaN]);
    expect(r.qtd).toBe(2);
    expect(r.descartadas).toBe(3);
    expect(r.mediaMin).toBe(30);
  });
  it("mediana resiste a um pedido que virou a noite (dentro do teto)", () => {
    const r = estatisticaSeparacao([15, 20, 25, 400], 480);
    expect(r.medianaMin).toBe(22.5);
    expect(r.mediaMin).toBe(115);
  });
  it("aceita teto customizado", () => {
    expect(estatisticaSeparacao([10, 100], 60).qtd).toBe(1);
  });
  it("lista vazia zera tudo", () => {
    expect(estatisticaSeparacao([])).toEqual({
      qtd: 0, descartadas: 0, mediaMin: 0, medianaMin: 0, p90Min: 0,
    });
  });
});

describe("porUnidade", () => {
  it("divide normalmente", () => {
    expect(porUnidade(1200, 40)).toBe(30);
  });
  it("é 0 quando o denominador não é positivo", () => {
    expect(porUnidade(10, 0)).toBe(0);
    expect(porUnidade(10, -1)).toBe(0);
  });
});

describe("janelaMeses", () => {
  it("termina no mês corrente e cruza a virada de ano", () => {
    expect(janelaMeses(new Date(2026, 1, 10), 3)).toEqual(["2025-12-01", "2026-01-01", "2026-02-01"]);
  });
});

const ponto = (over: Partial<PontoWms> = {}): PontoWms => ({
  mes: "2026-08-01",
  pesoFaturadoKg: 200_000,
  mov: { ...MOV_VAZIO, verticais: 300, horizontais: 100, abastecimentos: 120 },
  cargas: {
    cargas: 40, pesoKg: 200_000,
    separacao: estatisticaSeparacao([]), ciclo: estatisticaSeparacao([]),
  },
  coletor: { ...COLETOR_VAZIO },
  ...over,
});

describe("indicadores normalizados", () => {
  it("movimentos por tonelada = (verticais + horizontais) ÷ t faturadas", () => {
    expect(movimentosPorTonelada(ponto())).toBe(2); // 400 ÷ 200 t
  });
  it("abastecimentos por carga", () => {
    expect(abastecimentosPorCarga(ponto())).toBe(3); // 120 ÷ 40
  });
  it("linhas por hora de coletor", () => {
    expect(linhasPorHora({ tarefas: 10, separadores: 2, minutos: 90, linhas: 300 })).toBe(200);
  });
  it("sem expedição/sem tempo dá 0 em vez de infinito", () => {
    const p = ponto({ pesoFaturadoKg: null, cargas: { ...ponto().cargas, cargas: 0, pesoKg: 0 } });
    expect(movimentosPorTonelada(p)).toBe(0);
    expect(abastecimentosPorCarga(p)).toBe(0);
    expect(linhasPorHora(COLETOR_VAZIO)).toBe(0);
  });
});

describe("estatisticaPorMes", () => {
  it("agrupa por mês e conta etapa sem registro (nulo) como descartada", () => {
    const r = estatisticaPorMes([
      { mes: "2026-07-01", minutos: 10 },
      { mes: "2026-07-01", minutos: 30 },
      { mes: "2026-08-01", minutos: null },
      { mes: "2026-08-01", minutos: 60 },
    ], 480);
    expect(r.get("2026-07-01")?.medianaMin).toBe(20);
    expect(r.get("2026-08-01")).toMatchObject({ qtd: 1, descartadas: 1, medianaMin: 60 });
  });
});

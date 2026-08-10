import { describe, it, expect } from "vitest";
import {
  montarResumoFechamento,
  rotuloPeriodo,
  intervaloDias,
  clampDia,
  hojeISO,
} from "./fechamento";
import type { ResumoFaturamento } from "./faturamento";

const fatur = (over: Partial<ResumoFaturamento> = {}): ResumoFaturamento => ({
  emitidas: 1240, positivados: 300, atendimentos: 318,
  devolvidas: 10, devolvidasAvulsas: 2,
  vendaFaturada: 487320, valorDevolucao: 23400, valorDevolucaoAvulsa: 0,
  vendaLiquida: 463920, pesoFaturado: 128400, pesoDevolucao: 6000,
  ...over,
});

describe("montarResumoFechamento", () => {
  it("mapeia faturamento presente e calcula a taxa do mês", () => {
    const r = montarResumoFechamento({
      ini: "2026-08-10", fim: "2026-08-10",
      faturamentoPeriodo: fatur(),
      faturamentoMes: fatur({ vendaFaturada: 1000000, valorDevolucao: 48000 }),
      receitasLogisticas: 3210, faltas: 2,
    });
    expect(r.isPeriodo).toBe(false);
    expect(r.faturamentoBruto).toBe(487320);
    expect(r.pdvsAtendidos).toBe(318);
    expect(r.notasEmitidas).toBe(1240);
    expect(r.pesoFaturadoKg).toBe(128400);
    expect(r.taxaDevolucaoMes).toBeCloseTo(0.048, 3);
    expect(r.receitasLogisticas).toBe(3210);
    expect(r.faltas).toBe(2);
  });

  it("Winthor indisponível → campos do faturamento e taxa viram null", () => {
    const r = montarResumoFechamento({
      ini: "2026-08-01", fim: "2026-08-10",
      faturamentoPeriodo: null, faturamentoMes: null,
      receitasLogisticas: 500, faltas: 0,
    });
    expect(r.isPeriodo).toBe(true);
    expect(r.faturamentoBruto).toBeNull();
    expect(r.taxaDevolucaoMes).toBeNull();
    expect(r.receitasLogisticas).toBe(500);
  });
});

describe("rotuloPeriodo", () => {
  it("dia único", () => {
    const { eyebrow, titulo } = rotuloPeriodo("2026-08-10", "2026-08-10");
    expect(eyebrow).toContain("Fechamento do dia");
    expect(titulo).toContain("10 de agosto");
  });
  it("período no mesmo mês", () => {
    const { eyebrow, titulo } = rotuloPeriodo("2026-08-01", "2026-08-10");
    expect(eyebrow).toContain("Período");
    expect(titulo).toBe("1 a 10 de agosto");
  });
  it("período entre meses", () => {
    const { titulo } = rotuloPeriodo("2026-07-28", "2026-08-03");
    expect(titulo).toBe("28 de julho a 3 de agosto");
  });
});

describe("intervaloDias / clampDia", () => {
  it("ordena datas trocadas", () => {
    expect(intervaloDias("2026-08-10", "2026-08-01")).toEqual({ ini: "2026-08-01", fim: "2026-08-10" });
  });
  it("prende ao histórico e a hoje", () => {
    const hoje = new Date("2026-08-10T12:00:00Z");
    expect(clampDia("2026-06-01", hoje)).toBe("2026-07-01");
    expect(clampDia("2026-12-31", hoje)).toBe("2026-08-10");
    expect(clampDia("2026-08-05", hoje)).toBe("2026-08-05");
  });
  it("hojeISO formata a data local", () => {
    expect(hojeISO(new Date("2026-08-10T12:00:00Z"))).toBe("2026-08-10");
  });
});

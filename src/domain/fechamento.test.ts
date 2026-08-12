import { describe, it, expect } from "vitest";
import {
  montarResumoFechamento,
  setoresComFaltas,
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
      faturamentoPeriodo: { vendaFaturada: 487320, atendimentos: 318, emitidas: 1240, pesoFaturadoKg: 128400 },
      faturamentoMes: fatur({ vendaFaturada: 1000000, valorDevolucao: 48000, pesoDevolucao: 12000 }),
      receitasLogisticas: 3210, faltas: 2, faltasSetores: ["Expedição", "Recebimento"],
    });
    expect(r.isPeriodo).toBe(false);
    expect(r.faturamentoBruto).toBe(487320);
    expect(r.pdvsAtendidos).toBe(318);
    expect(r.notasEmitidas).toBe(1240);
    expect(r.pesoFaturadoKg).toBe(128400);
    expect(r.taxaDevolucaoMes).toBeCloseTo(0.048, 3);
    expect(r.devolucaoMesValor).toBe(48000);
    expect(r.devolucaoMesPesoKg).toBe(12000);
    expect(r.receitasLogisticas).toBe(3210);
    expect(r.faltas).toBe(2);
    expect(r.faltasSetores).toEqual(["Expedição", "Recebimento"]);
  });

  it("Winthor indisponível → campos do faturamento e taxa viram null", () => {
    const r = montarResumoFechamento({
      ini: "2026-08-01", fim: "2026-08-10",
      faturamentoPeriodo: null, faturamentoMes: null,
      receitasLogisticas: 500, faltas: 0, faltasSetores: [],
    });
    expect(r.isPeriodo).toBe(true);
    expect(r.faturamentoBruto).toBeNull();
    expect(r.taxaDevolucaoMes).toBeNull();
    expect(r.devolucaoMesValor).toBeNull();
    expect(r.devolucaoMesPesoKg).toBeNull();
    expect(r.receitasLogisticas).toBe(500);
  });
});

describe("setoresComFaltas", () => {
  const setorPorFunc = new Map([
    ["f1", "s1"], ["f2", "s1"], ["f3", "s2"], ["f4", "s3"],
  ]);
  const nomeSetor = new Map([["s1", "Expedição"], ["s2", "Recebimento"], ["s3", "Armazenagem"]]);

  it("ordena setores do mais para o menos faltoso e ignora fora do período", () => {
    const faltas = [
      { funcionarioId: "f1", data: "2026-08-10" }, // s1
      { funcionarioId: "f2", data: "2026-08-10" }, // s1
      { funcionarioId: "f3", data: "2026-08-10" }, // s2
      { funcionarioId: "f4", data: "2026-08-01" }, // s3 — fora do período
    ];
    expect(setoresComFaltas(faltas, setorPorFunc, nomeSetor, "2026-08-10", "2026-08-10")).toEqual([
      "Expedição",
      "Recebimento",
    ]);
  });

  it("sem faltas → lista vazia", () => {
    expect(setoresComFaltas([], setorPorFunc, nomeSetor, "2026-08-10", "2026-08-10")).toEqual([]);
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

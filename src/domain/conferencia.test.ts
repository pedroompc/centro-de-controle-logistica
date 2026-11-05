import { describe, it, expect } from "vitest";
import { avaliarPar, fecharConferencia, resumoPublico, proximaRodada, type ParConferencia } from "./conferencia";

const par = (a: number | null, b: number | null, tolerancia = 5, chave = "x"): ParConferencia => ({
  chave, nome: "X", mes: "2026-10-01", unidade: "R$", tolerancia,
  a: { fonte: "A", valor: a }, b: { fonte: "B", valor: b },
});

describe("avaliarPar", () => {
  it("dentro da tolerância bate; fora diverge; lado sem resposta não confere", () => {
    expect(avaliarPar(par(100, 98)).ok).toBe(true);
    expect(avaliarPar(par(100, 90))).toMatchObject({ ok: false, diferenca: 10 });
    expect(avaliarPar(par(null, 90))).toMatchObject({ ok: null, diferenca: null });
  });
});

describe("fecharConferencia / resumoPublico", () => {
  it("reprova só com par divergente e a versão pública não leva valor", () => {
    const c = fecharConferencia([par(1, 1, 0, "a"), par(5, 1, 0, "b"), par(null, 1, 0, "c")], new Date("2026-11-05T09:00:00Z"));
    expect(c.ok).toBe(false);
    expect(resumoPublico(c)).toEqual({ em: "2026-11-05T09:00:00.000Z", ok: false, pares: 3, divergentes: ["b"], naoConferidos: 1 });
    expect(JSON.stringify(resumoPublico(c))).not.toMatch(/valor|fonte/);
    expect(fecharConferencia([par(null, 1)]).ok).toBe(true);
  });
});

describe("proximaRodada", () => {
  it("6h de Recife (09h UTC): hoje se ainda não passou, senão amanhã", () => {
    expect(proximaRodada(new Date("2026-11-05T08:00:00Z")).toISOString()).toBe("2026-11-05T09:00:00.000Z");
    expect(proximaRodada(new Date("2026-11-05T10:00:00Z")).toISOString()).toBe("2026-11-06T09:00:00.000Z");
    expect(proximaRodada(new Date("2026-11-06T02:30:00Z")).toISOString()).toBe("2026-11-06T09:00:00.000Z");
  });
});

import { describe, it, expect } from "vitest";
import { periodoAnterior, periodoDoMes } from "./periodo";

// Regra das comparações "vs mês anterior" (Painel TV e BIs): mês aberto compara
// com o mês anterior ATÉ O MESMO DIA; mês fechado, com o mês anterior inteiro.
describe("periodoAnterior · mês anterior comparável", () => {
  const hoje = new Date(2026, 10, 24); // 24/11/2026

  it("mês em andamento = mês anterior do dia 1 até o mesmo dia", () => {
    expect(periodoAnterior(periodoDoMes("2026-11-01"), hoje)).toEqual({ de: "2026-10-01", ate: "2026-10-24" });
  });

  it("mês fechado = mês anterior inteiro", () => {
    expect(periodoAnterior(periodoDoMes("2026-10-01"), hoje)).toEqual({ de: "2026-09-01", ate: "2026-09-30" });
  });

  it("dia 31 com mês anterior de 30 dias: para no fim do mês anterior", () => {
    expect(periodoAnterior(periodoDoMes("2026-12-01"), new Date(2026, 11, 31))).toEqual({ de: "2026-11-01", ate: "2026-11-30" });
  });
});

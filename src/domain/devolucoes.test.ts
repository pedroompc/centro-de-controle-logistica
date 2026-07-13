import { describe, it, expect } from "vitest";
import { agregarPorSetor, piorMotorista } from "./devolucoes";
import type { DevolucaoPorMotivo, DevolucaoPorMotorista } from "./devolucoes";

const m = (over: Partial<DevolucaoPorMotivo>): DevolucaoPorMotivo => ({
  motivo: "X", setor: "Logística", notas: 1, valor: 100, ...over,
});

describe("agregarPorSetor", () => {
  it("soma valor e notas por setor", () => {
    const r = agregarPorSetor([
      m({ setor: "Logística", notas: 3, valor: 300 }),
      m({ setor: "Logística", notas: 2, valor: 200 }),
      m({ setor: "Comercial", notas: 1, valor: 50 }),
    ]);
    expect(r).toEqual([
      { setor: "Logística", notas: 5, valor: 500 },
      { setor: "Comercial", notas: 1, valor: 50 },
    ]);
  });

  it("mantém a ordem fixa (Logística primeiro) mesmo fora de ordem na entrada", () => {
    const r = agregarPorSetor([
      m({ setor: "Faturamento", valor: 10 }),
      m({ setor: "Logística", valor: 20 }),
    ]);
    expect(r.map((s) => s.setor)).toEqual(["Logística", "Faturamento"]);
  });

  it("lista vazia → vazio", () => {
    expect(agregarPorSetor([])).toEqual([]);
  });
});

const mot = (over: Partial<DevolucaoPorMotorista>): DevolucaoPorMotorista => ({
  codMotorista: 1, nome: "X", expedidas: 100, devolvidas: 10, taxa: 10, valorDevolvido: 0, ...over,
});

describe("piorMotorista", () => {
  it("escolhe a maior taxa entre quem tem volume", () => {
    const r = piorMotorista([
      mot({ codMotorista: 1, taxa: 12, expedidas: 200 }),
      mot({ codMotorista: 2, taxa: 25, expedidas: 120 }),
      mot({ codMotorista: 3, taxa: 90, expedidas: 2 }), // ignorado: pouco volume
    ]);
    expect(r?.codMotorista).toBe(2);
  });
  it("null quando ninguém atinge o volume mínimo", () => {
    expect(piorMotorista([mot({ expedidas: 3, taxa: 80 })])).toBeNull();
  });
});

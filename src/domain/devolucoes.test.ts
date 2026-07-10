import { describe, it, expect } from "vitest";
import { agregarPorSetor } from "./devolucoes";
import type { DevolucaoPorMotivo } from "./devolucoes";

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

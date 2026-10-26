import { describe, it, expect } from "vitest";
import { turnosDivergentes, confrontoDiario, diasUteisSemProducao, linhasPorTipo, diferenca } from "./separacao-auditoria";
import type { LinhaSep } from "./separacao";

const L = (o: Partial<LinhaSep>): LinhaSep => ({ mapa: 1, dia: "2026-10-01", usuario: null, hora: 15, linhas: 0, caixas: 0, unidades: 0, kg: 0, ...o });

describe("auditoria da separação", () => {
  it("aponta quem trabalha à tarde e está cadastrado de manhã", () => {
    const d = turnosDivergentes([L({ usuario: 1, hora: 15, linhas: 10 }), L({ usuario: 1, hora: 9, linhas: 2 }), L({ usuario: 2, hora: 9, linhas: 5 })], new Map([[1, "manha"], [2, "manha"]]));
    expect(d).toEqual([{ usuario: 1, cadastro: "manha", horario: "tarde", horaMediana: 15, linhas: 12 }]);
  });
  it("confronto só da filial 1 e diferença relativa", () => {
    const c = confrontoDiario([{ dia: "2026-10-01", pedidos: 102, clientes: 0, cargas: 0, mapas: 1 }], new Map([["2026-10-01", 1050]]), [
      { dia: "2026-10-01", filial: "1", pedidos: 100, kg: 1000 },
      { dia: "2026-10-01", filial: "11", pedidos: 5, kg: 9000 },
    ]);
    expect(c).toEqual([{ dia: "2026-10-01", pedidosHarpia: 102, pedidosWinthor: 100, kgHarpia: 1050, kgWinthor: 1000 }]);
    expect(diferenca(102, 100)).toBeCloseTo(0.02);
    expect(diferenca(1, 0)).toBeNull();
  });
  it("dias úteis sem mapa até a data", () => {
    // out/2026: 01 é quinta; 03–04 fim de semana
    expect(diasUteisSemProducao("2026-10-01", [{ dia: "2026-10-01", pedidos: 1, clientes: 1, cargas: 1, mapas: 1 }], "2026-10-05")).toEqual(["2026-10-02", "2026-10-05"]);
  });
  it("linhas e cobertura por tipo de mapa", () => {
    const r = linhasPorTipo([L({ mapa: 1, linhas: 10, usuario: 3 }), L({ mapa: 2, linhas: 30 })], [
      { mapa: 1, dia: "2026-10-01", tipo: 4, pedidos: 1, clientes: 1 },
      { mapa: 2, dia: "2026-10-01", tipo: 0, pedidos: 9, clientes: 9 },
    ]);
    expect(r.map((x) => [x.tipo, x.linhas, x.comSeparador])).toEqual([[0, 30, 0], [4, 10, 10]]);
  });
});

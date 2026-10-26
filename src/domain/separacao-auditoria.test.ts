import { describe, it, expect } from "vitest";
import { turnosDivergentes } from "./separacao-auditoria";
import type { LinhaSep } from "./separacao";
import type { TurnoSep } from "./turnos-separacao";

const L = (o: Partial<LinhaSep>): LinhaSep => ({ mapa: 1, dia: "2026-10-01", usuario: null, hora: 15, linhas: 0, caixas: 0, unidades: 0, kg: 0, ...o });

describe("auditoria da separação", () => {
  it("aponta quem separa de madrugada e está cadastrado no dia", () => {
    const d = turnosDivergentes(
      [L({ usuario: 1, hora: 23, linhas: 10 }), L({ usuario: 1, hora: 15, linhas: 2 }), L({ usuario: 2, hora: 9, linhas: 5 })],
      new Map<number, TurnoSep>([[1, "dia"], [2, "dia"]]),
    );
    expect(d).toEqual([{ usuario: 1, cadastro: "dia", horario: "noite", horaMediana: 23, linhas: 12 }]);
  });
});

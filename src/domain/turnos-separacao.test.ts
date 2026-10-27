import { describe, it, expect } from "vitest";
import { diaOperacional, turnoDaHora, TURNOS_SEPARACAO } from "./turnos-separacao";

describe("turnos da separação", () => {
  it("dia operacional vira às 07h", () => {
    expect(diaOperacional(new Date(2026, 9, 24, 3, 26))).toBe("2026-10-23");
    expect(diaOperacional(new Date(2026, 9, 24, 7, 0))).toBe("2026-10-24");
    expect(diaOperacional(new Date(2026, 10, 1, 6, 59))).toBe("2026-10-31");
  });
  it("as janelas cobrem as 24h sem sobrepor", () => {
    for (let h = 0; h < 24; h++) {
      const n = TURNOS_SEPARACAO.filter((t) => (t.inicio < t.fim ? h >= t.inicio && h < t.fim : h >= t.inicio || h < t.fim)).length;
      expect(n, `hora ${h}`).toBe(1);
    }
    expect(turnoDaHora(9)).toBe("dia");
    expect(turnoDaHora(19)).toBe("dia");
    expect(turnoDaHora(20)).toBe("noite");
    expect(turnoDaHora(6)).toBe("noite");
  });
});

import { describe, it, expect } from "vitest";
import { diaOperacional, EUGENIO } from "./fechamento-janela";

describe("diaOperacional", () => {
  const OUTRO = 999;

  it("madrugada (<07h) fica no mesmo dia, qualquer motorista", () => {
    expect(diaOperacional("2026-08-10", 0, OUTRO)).toBe("2026-08-10");
    expect(diaOperacional("2026-08-10", 3, null)).toBe("2026-08-10");
    expect(diaOperacional("2026-08-10", 6, OUTRO)).toBe("2026-08-10");
  });

  it("07–12h: Eugênio fica no mesmo dia; os outros vão pro dia seguinte", () => {
    expect(diaOperacional("2026-08-10", 7, EUGENIO)).toBe("2026-08-10");
    expect(diaOperacional("2026-08-10", 12, EUGENIO)).toBe("2026-08-10");
    expect(diaOperacional("2026-08-10", 7, OUTRO)).toBe("2026-08-11");
    expect(diaOperacional("2026-08-10", 10, null)).toBe("2026-08-11");
  });

  it("13h em diante vai pro dia seguinte, inclusive Eugênio", () => {
    expect(diaOperacional("2026-08-10", 13, EUGENIO)).toBe("2026-08-11");
    expect(diaOperacional("2026-08-10", 22, OUTRO)).toBe("2026-08-11");
    expect(diaOperacional("2026-08-10", 23, null)).toBe("2026-08-11");
  });

  it("vira o mês corretamente", () => {
    expect(diaOperacional("2026-08-31", 22, OUTRO)).toBe("2026-09-01");
    expect(diaOperacional("2026-12-31", 15, null)).toBe("2027-01-01");
  });
});

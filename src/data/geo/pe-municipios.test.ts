import { describe, it, expect } from "vitest";
import municipios from "./pe-municipios.json";

describe("pe-municipios.json", () => {
  it("cobre os municípios de PE (>= 184)", () => {
    expect(municipios.length).toBeGreaterThanOrEqual(184);
  });

  it("todo município tem IBGE de 7 dígitos e um path não vazio", () => {
    for (const m of municipios) {
      expect(m.ibge).toMatch(/^\d{7}$/);
      expect(m.d.length).toBeGreaterThan(0);
      expect(m.d.startsWith("M")).toBe(true);
    }
  });

  it("inclui Recife (2611606)", () => {
    expect(municipios.some((m) => m.ibge === "2611606")).toBe(true);
  });

  it("não tem IBGE duplicado", () => {
    const set = new Set(municipios.map((m) => m.ibge));
    expect(set.size).toBe(municipios.length);
  });
});

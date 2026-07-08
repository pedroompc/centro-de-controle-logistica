import { describe, it, expect } from "vitest";
import { formatBRL, formatDataBR } from "./format";

describe("formatBRL", () => {
  it("formata em reais", () => {
    expect(formatBRL(1234.56)).toBe("R$ 1.234,56");
  });
  it("formata zero", () => {
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});

describe("formatDataBR", () => {
  it("converte ISO para dd/mm/aaaa", () => {
    expect(formatDataBR("2026-07-08")).toBe("08/07/2026");
  });
});

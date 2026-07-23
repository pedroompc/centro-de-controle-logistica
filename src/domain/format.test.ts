import { describe, it, expect } from "vitest";
import { formatBRL, formatDataBR, formatKg, formatPercent } from "./format";

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

describe("formatKg", () => {
  it("formata peso sem casas decimais", () => {
    expect(formatKg(94871.23)).toBe("94.871 kg");
  });
  it("formata zero", () => {
    expect(formatKg(0)).toBe("0 kg");
  });
  it("preserva casas decimais quando pedido (reciclagem, balança fracionária)", () => {
    expect(formatKg(47.35, 3)).toBe("47,350 kg");
  });
  it("não engole quantidade fracionária pequena", () => {
    expect(formatKg(0.4, 3)).toBe("0,400 kg");
  });
});

describe("formatPercent", () => {
  it("converte fração em percentual pt-BR", () => {
    expect(formatPercent(0.0718)).toBe("7,2%");
  });
  it("formata zero", () => {
    expect(formatPercent(0)).toBe("0,0%");
  });
});

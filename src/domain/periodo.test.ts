import { describe, it, expect } from "vitest";
import { primeiroDiaDoMes, mesAnterior, mesProximo, formatMesAno } from "./periodo";

describe("primeiroDiaDoMes", () => {
  it("de uma data ISO string", () => {
    expect(primeiroDiaDoMes("2026-07-08")).toBe("2026-07-01");
  });
  it("de um Date", () => {
    expect(primeiroDiaDoMes(new Date(2026, 6, 20))).toBe("2026-07-01");
  });
});

describe("mesAnterior / mesProximo", () => {
  it("mês anterior dentro do ano", () => {
    expect(mesAnterior("2026-07-01")).toBe("2026-06-01");
  });
  it("mês anterior virando o ano", () => {
    expect(mesAnterior("2026-01-01")).toBe("2025-12-01");
  });
  it("mês próximo virando o ano", () => {
    expect(mesProximo("2026-12-01")).toBe("2027-01-01");
  });
});

describe("formatMesAno", () => {
  it("formata em pt-BR", () => {
    expect(formatMesAno("2026-07-01")).toBe("Julho/2026");
  });
});

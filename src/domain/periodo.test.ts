import { describe, it, expect } from "vitest";
import { primeiroDiaDoMes, mesAnterior, mesProximo, formatMesAno, inicioFimDoMes } from "./periodo";

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

describe("inicioFimDoMes", () => {
  it("retorna 1º e último dia de um mês de 31 dias", () => {
    expect(inicioFimDoMes("2026-05-01")).toEqual({ inicio: "2026-05-01", fim: "2026-05-31" });
  });
  it("trata fevereiro corretamente", () => {
    expect(inicioFimDoMes("2026-02-01")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
  });
});

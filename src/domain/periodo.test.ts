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

import { lerComparacao, paramComparacao } from "./periodo";

describe("lerComparacao", () => {
  const out26 = { de: "2026-10-01", ate: "2026-10-31" };
  const hoje = new Date(2026, 10, 6);
  it("desligada sem parâmetro ou com lixo", () => {
    expect(lerComparacao(undefined, out26, hoje)).toBeNull();
    expect(lerComparacao("xyz", out26, hoje)).toBeNull();
    expect(lerComparacao("2026-02-30_2026-03-01", out26, hoje)).toBeNull();
  });
  it("anterior e ano passado", () => {
    expect(lerComparacao("ant", out26, hoje)).toEqual({ modo: "ant", periodo: { de: "2026-09-01", ate: "2026-09-30" } });
    expect(lerComparacao("ano", out26, hoje)).toEqual({ modo: "ano", periodo: { de: "2025-10-01", ate: "2025-10-31" } });
  });
  it("período livre, em qualquer ordem", () => {
    expect(lerComparacao("2026-03-31_2026-01-01", out26, hoje)).toEqual({ modo: "livre", periodo: { de: "2026-01-01", ate: "2026-03-31" } });
  });
  it("ida e volta pela URL", () => {
    const p = { de: "2026-01-01", ate: "2026-03-31" };
    expect(lerComparacao(paramComparacao("livre", p), out26, hoje)?.periodo).toEqual(p);
    expect(paramComparacao("ano")).toBe("ano");
  });
});

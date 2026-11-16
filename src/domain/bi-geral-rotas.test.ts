import { describe, expect, it } from "vitest";
import { lerAba, pisoDaAba, hrefBI } from "./bi-geral-rotas";
import { INICIO_HISTORICO, PISO_HARPIA } from "./periodo";

describe("lerAba", () => {
  it("aba inválida ou ausente cai na Geral", () => {
    expect(lerAba("xyz")).toBe("geral");
    expect(lerAba(undefined)).toBe("geral");
  });
  it("aba válida passa", () => {
    expect(lerAba("motoristas")).toBe("motoristas");
  });
});

describe("pisoDaAba", () => {
  it("Recebimento e Geral dependem do Supabase; os outros do Harpia", () => {
    expect(pisoDaAba("recebimento")).toBe(INICIO_HISTORICO);
    expect(pisoDaAba("geral")).toBe(INICIO_HISTORICO);
    expect(pisoDaAba("separacao")).toBe(PISO_HARPIA);
  });
});

describe("hrefBI", () => {
  it("leva aba, período e comparação", () => {
    const h = hrefBI("separacao", { mes: "2026-10-01", cmp: "ano" });
    expect(h.startsWith("/bi?")).toBe(true);
    const q = new URLSearchParams(h.slice(4));
    expect(q.get("aba")).toBe("separacao");
    expect(q.get("mes")).toBe("2026-10-01");
    expect(q.get("cmp")).toBe("ano");
  });
  it("Geral sem nada é só /bi", () => {
    expect(hrefBI("geral", {})).toBe("/bi");
  });
});

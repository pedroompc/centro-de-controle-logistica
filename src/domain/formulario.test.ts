import { describe, it, expect } from "vitest";
import { umDe, valorBR, paraCampoBR } from "./formulario";

describe("umDe", () => {
  const TURNOS = ["manha", "tarde", "noite"] as const;
  it("aceita opção válida, usa o padrão no vazio e recusa o resto", () => {
    expect(umDe("noite", TURNOS, "manha")).toBe("noite");
    expect(umDe(null, TURNOS, "manha")).toBe("manha");
    expect(umDe(" ", TURNOS, "manha")).toBe("manha");
    expect(() => umDe("madrugada", TURNOS, "manha")).toThrow(/inválido/);
  });
});

describe("valorBR", () => {
  it("lê vírgula como decimal e ponto como milhar", () => {
    expect(valorBR("1234,56")).toBe(1234.56);
    expect(valorBR("1.234,56")).toBe(1234.56);
    expect(valorBR("400.000,00")).toBe(400000);
    expect(valorBR("400.000")).toBe(400000);
    expect(valorBR("7,05")).toBe(7.05);
    expect(valorBR(" R$ 18.044,47 ")).toBe(18044.47);
    expect(valorBR("231")).toBe(231);
  });
  it("ainda aceita ponto decimal de quem digita no formato antigo", () => {
    expect(valorBR("1234.56")).toBe(1234.56);
    expect(valorBR("7.05")).toBe(7.05);
  });
  it("vazio ou lixo = null (não grava)", () => {
    expect(valorBR("")).toBeNull();
    expect(valorBR(null)).toBeNull();
    expect(valorBR("abc")).toBeNull();
    expect(valorBR("1,2,3")).toBeNull();
    expect(valorBR("-5")).toBeNull();
  });
});

describe("paraCampoBR", () => {
  it("mostra o valor salvo com vírgula, sem milhar", () => {
    expect(paraCampoBR(1234.5)).toBe("1234,50");
    expect(paraCampoBR(400000)).toBe("400000,00");
    expect(paraCampoBR(7.05, 3)).toBe("7,050");
  });
});

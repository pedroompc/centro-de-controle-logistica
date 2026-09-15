import { describe, it, expect } from "vitest";
import { classificarRegiao } from "./pe-regioes";

describe("classificarRegiao", () => {
  it("classifica as cidades de maior volume", () => {
    expect(classificarRegiao("RECIFE", "PE")).toBe("RMR");
    expect(classificarRegiao("CARUARU", "PE")).toBe("Agreste");
    expect(classificarRegiao("GARANHUNS", "PE")).toBe("Agreste");
    expect(classificarRegiao("PETROLINA", "PE")).toBe("Sertão");
    expect(classificarRegiao("GOIANA", "PE")).toBe("Zona da Mata");
  });

  it("casa nome truncado do Winthor (prefixo)", () => {
    expect(classificarRegiao("JABOATAO DOS GU", "PE")).toBe("RMR");
    expect(classificarRegiao("CABO DE SANTO AG", "PE")).toBe("RMR");
  });

  it("ignora acento e caixa", () => {
    expect(classificarRegiao("vitória de santo antão", "PE")).toBe("Zona da Mata");
  });

  it("fora de PE ou desconhecida cai em Outras", () => {
    expect(classificarRegiao("SAO PAULO", "SP")).toBe("Outras");
    expect(classificarRegiao("CIDADE INEXISTENTE XYZ", "PE")).toBe("Outras");
    expect(classificarRegiao(null, null)).toBe("Outras");
  });
});

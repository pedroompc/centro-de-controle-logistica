import { describe, expect, it } from "vitest";
import { normalizarCidade, criarIndiceCalendario } from "./calendario";
import type { Rota } from "./tipos";

const rota = (over: Partial<Rota>): Rota => ({
  cidade: "OROBO", uf: "PE", regiaoOperacional: "MATA", rota: "SEG-01",
  grupoRota: null, diaSaidaRota: ["SEGUNDA"], diaLimitePedido: "SEXTA",
  janelaEntrega: [], aliases: [], observacao: null, ...over,
});

describe("normalizarCidade", () => {
  it("remove acento, sobe caixa e colapsa espaços", () => {
    expect(normalizarCidade("  São   Bento do Una ")).toBe("SAO BENTO DO UNA");
  });
});

describe("criarIndiceCalendario", () => {
  it("acha por nome exato normalizado", () => {
    const idx = criarIndiceCalendario([rota({ cidade: "Orobó" })]);
    expect(idx.buscar("OROBO")?.rota).toBe("SEG-01");
  });

  it("acha por alias", () => {
    const idx = criarIndiceCalendario([
      rota({ cidade: "SAO BENTO DO UNA", aliases: ["SAO BENTO DO UMA"] }),
    ]);
    expect(idx.buscar("Sao Bento do Uma")?.cidade).toBe("SAO BENTO DO UNA");
  });

  it("retorna null p/ cidade ausente ou vazia", () => {
    const idx = criarIndiceCalendario([rota({})]);
    expect(idx.buscar("CIDADE INEXISTENTE")).toBeNull();
    expect(idx.buscar(null)).toBeNull();
    expect(idx.buscar("   ")).toBeNull();
  });
});

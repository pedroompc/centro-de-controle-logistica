import { describe, it, expect } from "vitest";
import { tipoVendaInfo } from "./pedidos-consulta";

describe("tipoVendaInfo", () => {
  it("dá nome aos tipos usados nas filiais 1 e 11", () => {
    expect(tipoVendaInfo(1).label).toBe("Venda normal");
    expect(tipoVendaInfo(5).label).toBe("Bonificação");
    expect(tipoVendaInfo(10).label).toBe("Transferência");
  });

  it("código desconhecido aparece com o número; sem código vira traço", () => {
    expect(tipoVendaInfo(7).label).toBe("Tipo 7");
    expect(tipoVendaInfo(null).label).toBe("—");
  });

  it("bonificação se destaca em âmbar (verde só para receita)", () => {
    expect(tipoVendaInfo(5).badge).toContain("amber");
  });
});

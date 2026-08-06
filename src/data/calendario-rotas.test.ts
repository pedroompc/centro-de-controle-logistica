import { describe, expect, it } from "vitest";
import { mapRowToRota } from "./calendario-rotas";

describe("mapRowToRota", () => {
  it("mapea colunas snake_case → camelCase e arrays", () => {
    const r = mapRowToRota({
      cidade: "OROBO", uf: "PE", regiao_operacional: "MATA", rota: "SEG-01",
      grupo_rota: null, dia_saida_rota: ["SEGUNDA"], dia_limite_pedido: "SEXTA",
      janela_entrega: [], aliases: ["OROBÓ"], observacao: null,
    });
    expect(r.cidade).toBe("OROBO");
    expect(r.regiaoOperacional).toBe("MATA");
    expect(r.diaSaidaRota).toEqual(["SEGUNDA"]);
    expect(r.aliases).toEqual(["OROBÓ"]);
  });

  it("normaliza nulos de array para []", () => {
    const r = mapRowToRota({ cidade: "X", dia_saida_rota: null, janela_entrega: null, aliases: null });
    expect(r.diaSaidaRota).toEqual([]);
    expect(r.janelaEntrega).toEqual([]);
    expect(r.aliases).toEqual([]);
  });
});

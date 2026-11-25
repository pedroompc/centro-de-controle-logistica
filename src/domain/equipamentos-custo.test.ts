import { describe, it, expect } from "vitest";
import { linhasDeEquipamento, ehLinhaDeEquipamento } from "./equipamentos-custo";

describe("linhasDeEquipamento", () => {
  it("uma linha por equipamento com a quantidade geral (soma dos setores)", () => {
    const l = linhasDeEquipamento([
      { id: "1", nome: "Patinha", setor: "Separação", quantidade: 27, custoUnitario: 77 },
      { id: "4", nome: "Patinha", setor: "Recebimento", quantidade: 3, custoUnitario: 77 },
      { id: "2", nome: "Empilhadeira", setor: "Recebimento", quantidade: 1, custoUnitario: 6000 },
      { id: "3", nome: "Vazio", setor: "ADM", quantidade: 0, custoUnitario: 10 },
    ]);
    expect(l).toEqual([
      { nome: "Equipamento · Empilhadeira", valor: 6000 },
      { nome: "Equipamento · Patinha (30 un)", valor: 2310 },
    ]);
    expect(l.every((x) => ehLinhaDeEquipamento(x.nome))).toBe(true);
    expect(ehLinhaDeEquipamento("Galpão")).toBe(false);
  });
});

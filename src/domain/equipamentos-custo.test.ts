import { describe, it, expect } from "vitest";
import { linhasDeEquipamento, ehLinhaDeEquipamento } from "./equipamentos-custo";

describe("linhasDeEquipamento", () => {
  it("uma linha por equipamento, quantidade × unitário, setor no nome", () => {
    const l = linhasDeEquipamento([
      { id: "1", nome: "Patinha", setor: "Separação", quantidade: 27, custoUnitario: 77 },
      { id: "2", nome: "Empilhadeira", setor: "Recebimento", quantidade: 1, custoUnitario: 6000 },
      { id: "3", nome: "Vazio", setor: "ADM", quantidade: 0, custoUnitario: 10 },
    ]);
    expect(l).toEqual([
      { nome: "Equipamento · Empilhadeira (Recebimento)", valor: 6000 },
      { nome: "Equipamento · Patinha (Separação · 27 un)", valor: 2079 },
    ]);
    expect(l.every((x) => ehLinhaDeEquipamento(x.nome))).toBe(true);
    expect(ehLinhaDeEquipamento("Galpão")).toBe(false);
  });
});

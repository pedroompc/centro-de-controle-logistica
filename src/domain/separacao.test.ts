import { describe, it, expect } from "vitest";
import { ehSetorSeparacao, mesmoSetor, papelSeparacao, serieCustoSetor } from "./separacao";

describe("separação", () => {
  it("reconhece o setor e compara nomes sem acento", () => {
    expect(ehSetorSeparacao("SEPARAÇÃO")).toBe(true);
    expect(ehSetorSeparacao("Recebimento")).toBe(false);
    expect(mesmoSetor("SEPARAÇÃO", "Separacao ")).toBe(true);
  });
  it("função pelo cargo", () => {
    expect(papelSeparacao("SEPARADOR")).toBe("separador");
    expect(papelSeparacao("AJUDANTE DE CARGA E DESCARGA")).toBe("separador");
    expect(papelSeparacao("CONFERENTE")).toBe("conferente");
    expect(papelSeparacao("Operador de empilhadeira")).toBe("maquina");
    expect(papelSeparacao("LÍDER DE SEPARAÇÃO")).toBe("lider");
    expect(papelSeparacao("Motorista")).toBe("outros");
  });
  it("série: foto nos meses passados, cadastro no corrente, vazio sem foto", () => {
    const s = serieCustoSetor(
      ["2026-08-01", "2026-09-01", "2026-10-01"],
      [{ mes: "2026-09-01", ativos: 10, custoAtivos: 40_000 }],
      "2026-10-01",
      { pessoas: 11, folha: 44_000 },
    );
    expect(s).toEqual([
      { mes: "2026-08-01", pessoas: null, folha: null },
      { mes: "2026-09-01", pessoas: 10, folha: 40_000 },
      { mes: "2026-10-01", pessoas: 11, folha: 44_000 },
    ]);
  });
});

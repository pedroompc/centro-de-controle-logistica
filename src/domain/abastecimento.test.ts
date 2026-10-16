import { describe, it, expect } from "vitest";
import { pessoasMovimento } from "./abastecimento";

describe("pessoasMovimento", () => {
  const linha = (dia: string, usuario: number, total: number, descendente: number, ascendente: number) =>
    ({ dia, usuario, nome: `U${usuario}`, departamento: "LOGISTICA", total, descendente, ascendente, caixas: total * 10, peso: total * 100, caixasDesc: descendente * 10, pesoDesc: descendente * 100, skus: 2 });

  it("soma descendente/ascendente por pessoa e o resto é horizontal", () => {
    const r = pessoasMovimento([linha("2026-10-01", 1, 10, 7, 2), linha("2026-10-02", 1, 5, 4, 1), linha("2026-10-01", 2, 3, 3, 0)], null);
    expect(r[0]).toMatchObject({ usuario: 1, total: 15, descendente: 11, ascendente: 3, horizontal: 1, caixas: 150, peso: 1500, pesoDesc: 1100, dias: 2 });
    expect(r[1]).toMatchObject({ usuario: 2, total: 3, descendente: 3, ascendente: 0, horizontal: 0 });
  });

  it("SKUs do mês vêm de skusMes (não somam os dias); no dia, os do dia", () => {
    const linhas = [linha("2026-10-01", 1, 10, 7, 2), linha("2026-10-02", 1, 5, 4, 1)];
    expect(pessoasMovimento(linhas, null, [{ usuario: 1, skus: 3 }])[0].skus).toBe(3);
    expect(pessoasMovimento(linhas, "2026-10-01")[0].skus).toBe(2);
  });

  it("filtra pelo dia", () => {
    const r = pessoasMovimento([linha("2026-10-01", 1, 10, 7, 2), linha("2026-10-02", 1, 5, 4, 1)], "2026-10-02");
    expect(r).toEqual([expect.objectContaining({ total: 5, descendente: 4, ascendente: 1, horizontal: 0 })]);
  });
});

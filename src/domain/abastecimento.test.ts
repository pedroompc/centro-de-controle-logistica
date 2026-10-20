import { describe, it, expect } from "vitest";
import { rendimentoA424, historicoA424, premiacaoA424, premiacaoPorDia, papelAbastecimento } from "./abastecimento";

describe("papelAbastecimento", () => {
  it("separa liderança, empilhadores, WMS e ajudantes pelo cargo", () => {
    expect(papelAbastecimento("ENCARREGADO")).toBe("lider");
    expect(papelAbastecimento("EMPILHADOR SENIOR")).toBe("empilhador");
    expect(papelAbastecimento("EMPILHADOR JUNIOR")).toBe("empilhador");
    expect(papelAbastecimento("AUX. DE LOGISTICA")).toBe("wms");
    expect(papelAbastecimento("AJUDANTE")).toBe("operador");
  });
});

describe("rendimentoA424", () => {
  const l = (funcao: "03" | "04", dia: string, usuario: number, tarefas: number, caixas: number) =>
    ({ funcao, dia, usuario, nome: `U${usuario}`, tarefas, caixas, peso: caixas * 5, skus: tarefas });

  const linhas = [
    l("03", "2026-10-01", 54, 10, 500),
    l("04", "2026-10-01", 54, 12, 520),
    l("03", "2026-10-02", 54, 5, 100),
    l("03", "2026-10-01", 51, 20, 300),
  ];

  it("separa reabastecimento (03) de empilhadeira (04) e conta dias distintos", () => {
    const r = rendimentoA424(linhas, null);
    expect(r[0]).toMatchObject({ usuario: 54, dias: 2, reabastecimento: { tarefas: 15, caixas: 600, peso: 3000 }, empilhadeira: { tarefas: 12, caixas: 520 } });
    expect(r[1]).toMatchObject({ usuario: 51, dias: 1, reabastecimento: { tarefas: 20, caixas: 300 }, empilhadeira: { tarefas: 0, caixas: 0 } });
  });

  it("ordena por caixas reabastecidas", () => {
    expect(rendimentoA424(linhas, null).map((r) => r.usuario)).toEqual([54, 51]);
  });

  it("filtra pelo dia; SKUs do mês vêm de skusMes", () => {
    expect(rendimentoA424(linhas, "2026-10-02")).toEqual([expect.objectContaining({ usuario: 54, dias: 1, reabastecimento: { tarefas: 5, caixas: 100, peso: 500, skus: 5 } })]);
    const mes = rendimentoA424(linhas, null, [{ funcao: "03", usuario: 54, skus: 7 }]);
    expect(mes[0].reabastecimento.skus).toBe(7);
  });

  it("histórico diário: movimentações e o reabastecimento (03) do dia", () => {
    expect(historicoA424([l("03", "2026-10-01", 54, 10, 500), l("04", "2026-10-01", 54, 12, 520), l("03", "2026-10-02", 54, 5, 100)], 54)).toEqual([
      { dia: "2026-10-01", movimentacoes: 12, tarefas: 10, caixas: 500, peso: 2500 },
      { dia: "2026-10-02", movimentacoes: 0, tarefas: 5, caixas: 100, peso: 500 },
    ]);
  });
});

describe("premiacaoA424", () => {
  const l = (funcao: "03" | "04", dia: string, usuario: number, tarefas: number) =>
    ({ funcao, dia, usuario, nome: null, tarefas, caixas: 0, peso: 0, skus: 0 });
  // Dia 13/10/2026 como a A424 mostrava na hora em que a conferente contou.
  const dia13 = [
    l("03", "2026-10-13", 51, 43), l("03", "2026-10-13", 54, 32), l("03", "2026-10-13", 57, 21), l("03", "2026-10-13", 76, 28),
    l("04", "2026-10-13", 51, 44), l("04", "2026-10-13", 54, 36), l("04", "2026-10-13", 57, 21), l("04", "2026-10-13", 76, 28),
    l("04", "2026-10-13", 100, 155), l("04", "2026-10-13", 16, 144),
    l("03", "2026-10-13", 16, 7), l("04", "2026-10-13", 36, 47), // nem empilhador nem lançador: fora
  ];

  it("bate com a contagem da premiação: 428 = 304 asc + 124 desc", () => {
    expect(premiacaoA424(dia13, null, [51, 54, 57, 76], [16, 100])).toEqual({ total: 428, descendente: 124, ascendente: 304, lancadoWms: 299 });
  });

  it("filtra pelo dia e soma o total por dia", () => {
    expect(premiacaoA424(dia13, "2026-10-14", [51, 54, 57, 76], [16, 100]).total).toBe(0);
    expect(premiacaoPorDia(dia13, [51, 54, 57, 76], [16, 100]).get("2026-10-13")).toBe(428);
  });
});

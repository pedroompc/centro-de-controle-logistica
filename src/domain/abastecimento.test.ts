import { describe, it, expect } from "vitest";
import { pessoasMovimento, rendimentoA424, historicoA424 } from "./abastecimento";

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

  it("histórico diário só da função 03", () => {
    expect(historicoA424(linhas, 54)).toEqual([
      { dia: "2026-10-01", tarefas: 10, caixas: 500, peso: 2500 },
      { dia: "2026-10-02", tarefas: 5, caixas: 100, peso: 500 },
    ]);
  });
});

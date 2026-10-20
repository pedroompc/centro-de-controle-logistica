import { describe, it, expect } from "vitest";
import { rendimentoA424, historicoA424 } from "./abastecimento";

describe("rendimentoA424", () => {
  const l = (funcao: "03" | "04", dia: string, usuario: number, tarefas: number, caixas: number, tarefasConvocacao = 0) =>
    ({ funcao, dia, usuario, nome: `U${usuario}`, tarefas, tarefasConvocacao, caixas, peso: caixas * 5, skus: tarefas });

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

  it("movimentações = tarefas 04 + tarefas 03 da convocação (o mesmo movimento da 502 não conta duas vezes)", () => {
    const r = rendimentoA424([l("03", "2026-10-01", 54, 10, 500, 3), l("04", "2026-10-01", 54, 12, 520)], null);
    expect(r[0].movimentacoes).toBe(15);
  });

  it("histórico diário: movimentações e o reabastecimento (03) do dia", () => {
    expect(historicoA424([l("03", "2026-10-01", 54, 10, 500, 3), l("04", "2026-10-01", 54, 12, 520), l("03", "2026-10-02", 54, 5, 100)], 54)).toEqual([
      { dia: "2026-10-01", movimentacoes: 15, tarefas: 10, caixas: 500, peso: 2500 },
      { dia: "2026-10-02", movimentacoes: 0, tarefas: 5, caixas: 100, peso: 500 },
    ]);
  });
});

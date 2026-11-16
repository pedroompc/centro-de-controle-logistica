import { describe, expect, it, vi } from "vitest";

vi.mock("@/data/funcionarios", () => ({ listarFuncionarios: vi.fn(async () => { throw new Error("supabase fora"); }) }));
vi.mock("@/data/custos-mensais", () => ({ listarLancamentosDoMes: vi.fn(async () => []), serieCustosMensais: vi.fn(async () => []) }));
vi.mock("@/data/efetivo-mensal", () => ({ serieEfetivoSetorMensal: vi.fn(async () => []) }));
vi.mock("@/data/faturamento-mensal", () => ({ getResumoFaturamentoPeriodo: vi.fn(async () => null) }));

import { carregarResumoCasa } from "./resumo-casa";

describe("carregarResumoCasa", () => {
  it("Supabase fora: devolve tudo sem dado e o erro, sem lançar (a página não cai)", async () => {
    const r = await carregarResumoCasa({ de: "2026-10-01", ate: "2026-10-31" });
    expect(r.erro).toMatch(/supabase fora/);
    expect(r).toMatchObject({ efetivo: null, faturamentoLiquido: null, custoLogistico: null, custoSobreFat: null });
  });
});

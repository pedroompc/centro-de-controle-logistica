import { describe, it, expect } from "vitest";
import {
  comTaxa,
  piorCidade,
  corDaTaxa,
  COR_NEUTRA,
  MIN_FATURADO_CIDADE,
} from "./devolucoes-mapa";
import type { LinhaCidadeDevolucao, CidadeDevolucao } from "./devolucoes-mapa";

const linha = (over: Partial<LinhaCidadeDevolucao>): LinhaCidadeDevolucao => ({
  ibge: "2611606",
  cidade: "Recife",
  faturado: 10000,
  devolvido: 500,
  notasDevolvidas: 3,
  ...over,
});

const cidade = (over: Partial<CidadeDevolucao>): CidadeDevolucao => ({
  ...linha({}),
  taxa: 0.05,
  relevante: true,
  ...over,
});

describe("comTaxa", () => {
  it("calcula taxa = devolvido / faturado", () => {
    const [c] = comTaxa([linha({ faturado: 10000, devolvido: 500 })]);
    expect(c.taxa).toBeCloseTo(0.05, 6);
  });

  it("taxa 0 quando faturado <= 0 (e marca como não relevante)", () => {
    const [c] = comTaxa([linha({ faturado: 0, devolvido: 500 })]);
    expect(c.taxa).toBe(0);
    expect(c.relevante).toBe(false);
  });

  it("marca relevante quando faturado >= o piso", () => {
    const r = comTaxa(
      [
        linha({ ibge: "A", faturado: MIN_FATURADO_CIDADE, devolvido: 100 }),
        linha({ ibge: "B", faturado: MIN_FATURADO_CIDADE - 1, devolvido: 100 }),
      ],
      MIN_FATURADO_CIDADE,
    );
    expect(r.find((c) => c.ibge === "A")!.relevante).toBe(true);
    expect(r.find((c) => c.ibge === "B")!.relevante).toBe(false);
  });
});

describe("piorCidade", () => {
  it("retorna a maior taxa entre as relevantes", () => {
    const r = piorCidade([
      cidade({ ibge: "A", taxa: 0.05, relevante: true }),
      cidade({ ibge: "B", taxa: 0.20, relevante: true }),
      cidade({ ibge: "C", taxa: 0.90, relevante: false }), // ignorada (não relevante)
    ]);
    expect(r?.ibge).toBe("B");
  });

  it("retorna null quando nenhuma é relevante", () => {
    const r = piorCidade([cidade({ taxa: 0.9, relevante: false })]);
    expect(r).toBeNull();
  });
});

describe("corDaTaxa", () => {
  it("não relevante → cor neutra", () => {
    expect(corDaTaxa(0.5, false, 0.1)).toBe(COR_NEUTRA);
  });

  it("teto 0 → cor neutra (evita divisão por zero)", () => {
    expect(corDaTaxa(0.05, true, 0)).toBe(COR_NEUTRA);
  });

  it("pior cidade (taxa == teto) recebe o tom mais intenso", () => {
    expect(corDaTaxa(0.1, true, 0.1)).toBe("#dc2626");
  });

  it("taxa maior (relevante) nunca clareia em relação a uma menor", () => {
    const menor = corDaTaxa(0.02, true, 0.1);
    const maior = corDaTaxa(0.08, true, 0.1);
    expect(menor).not.toBe(COR_NEUTRA);
    expect(maior).not.toBe(COR_NEUTRA);
    expect(menor).not.toBe(maior);
  });
});

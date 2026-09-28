import { describe, it, expect } from "vitest";
import {
  comTaxa,
  totalMetrica,
  rankingMetrica,
  tetoMetrica,
  valorMetrica,
  colorivel,
  corDaEscala,
  COR_NEUTRA,
  MIN_FATURADO_CIDADE,
} from "./devolucoes-mapa";
import type { LinhaCidadeDevolucao, CidadeDevolucao } from "./devolucoes-mapa";

const linha = (over: Partial<LinhaCidadeDevolucao>): LinhaCidadeDevolucao => ({
  ibge: "2611606",
  cidade: "Recife",
  faturado: 10000,
  devolvido: 500,
  notasEntregues: 60,
  notasDevolvidas: 3,
  motivo: "—",
  motivoValor: 0,
  ...over,
});

const cidade = (over: Partial<CidadeDevolucao>): CidadeDevolucao => ({
  ...linha({}),
  taxa: 0.05,
  relevante: true,
  ...over,
});

// Cenário realista: metrópole (muito R$, taxa baixa) vs vilarejo (pouco R$, taxa alta).
const RECIFE = cidade({ ibge: "R", cidade: "Recife", faturado: 15_000_000, devolvido: 600_000, taxa: 0.04, relevante: true });
const BETANIA = cidade({ ibge: "B", cidade: "Betânia", faturado: 14_000, devolvido: 13_700, taxa: 0.979, relevante: true });
const MICRO = cidade({ ibge: "M", cidade: "Micro", faturado: 1_000, devolvido: 500, taxa: 0.5, relevante: false });
const SEMDEV = cidade({ ibge: "Z", cidade: "SemDev", faturado: 30_000, devolvido: 0, taxa: 0, relevante: true });

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

describe("valorMetrica", () => {
  it("taxa → a taxa; valor → o R$ devolvido", () => {
    expect(valorMetrica(RECIFE, "taxa")).toBe(0.04);
    expect(valorMetrica(RECIFE, "valor")).toBe(600_000);
  });
});

describe("colorivel", () => {
  it("taxa: só relevante (faturado >= piso)", () => {
    expect(colorivel(RECIFE, "taxa")).toBe(true);
    expect(colorivel(MICRO, "taxa")).toBe(false);
  });

  it("valor: qualquer cidade com devolução > 0 (sem piso de faturamento)", () => {
    expect(colorivel(MICRO, "valor")).toBe(true); // R$500 é volume real, só pequeno
    expect(colorivel(SEMDEV, "valor")).toBe(false); // R$0 devolvido → sem cor
  });
});

describe("tetoMetrica", () => {
  it("valor → maior R$ devolvido (metrópole)", () => {
    expect(tetoMetrica([RECIFE, BETANIA, MICRO, SEMDEV], "valor")).toBe(600_000);
  });
  it("taxa → maior taxa entre relevantes (vilarejo)", () => {
    expect(tetoMetrica([RECIFE, BETANIA, MICRO, SEMDEV], "taxa")).toBeCloseTo(0.979, 6);
  });
  it("0 quando ninguém é colorível", () => {
    expect(tetoMetrica([SEMDEV], "valor")).toBe(0);
  });
});

describe("totalMetrica", () => {
  it("valor → soma de TODO o R$ devolvido (inclui micro e sem-devolução)", () => {
    // 600000 + 13700 + 500 + 0
    expect(totalMetrica([RECIFE, BETANIA, MICRO, SEMDEV], "valor")).toBe(614_200);
  });
  it("taxa → taxa geral = soma devolvido / soma faturado", () => {
    // 614200 / (15000000 + 14000 + 1000 + 30000)
    expect(totalMetrica([RECIFE, BETANIA, MICRO, SEMDEV], "taxa")).toBeCloseTo(614_200 / 15_045_000, 6);
  });
  it("0 em lista vazia", () => {
    expect(totalMetrica([], "valor")).toBe(0);
    expect(totalMetrica([], "taxa")).toBe(0);
  });
});

describe("rankingMetrica", () => {
  it("valor: coloríveis ordenados por R$ desc (inclui micro, exclui sem devolução)", () => {
    const r = rankingMetrica([BETANIA, RECIFE, MICRO, SEMDEV], "valor");
    expect(r.map((c) => c.ibge)).toEqual(["R", "B", "M"]);
  });
  it("taxa: só relevantes, ordenados por taxa desc", () => {
    const r = rankingMetrica([RECIFE, BETANIA, MICRO], "taxa");
    expect(r.map((c) => c.ibge)).toEqual(["B", "R"]);
  });
});

describe("corDaEscala", () => {
  it("não colorível (ou teto 0) → cor neutra", () => {
    expect(corDaEscala(0.5, false, 0.1)).toBe(COR_NEUTRA);
    expect(corDaEscala(0.05, true, 0)).toBe(COR_NEUTRA);
  });
  it("valor == teto → tom mais intenso", () => {
    expect(corDaEscala(0.1, true, 0.1)).toBe("#dc2626");
  });
  it("valor maior (colorível) nunca clareia em relação a um menor", () => {
    const menor = corDaEscala(0.02, true, 0.1);
    const maior = corDaEscala(0.08, true, 0.1);
    expect(menor).not.toBe(COR_NEUTRA);
    expect(maior).not.toBe(COR_NEUTRA);
    expect(menor).not.toBe(maior);
  });
});

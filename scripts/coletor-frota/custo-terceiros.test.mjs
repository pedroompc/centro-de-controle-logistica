import { describe, it, expect } from "vitest";
import { grupoDoLancamento } from "../../src/domain/custo-grupos.ts";
import { linhasCustoTerceiros, mesesDesde, LINHA_AGREGADOS, LINHA_CHAPA, LINHA_DESCARREGO } from "./custo-terceiros.mjs";

describe("linhasCustoTerceiros", () => {
  it("soma por mês e linha, em centavos", () => {
    const m = linhasCustoTerceiros(
      [
        { MES: "2026-07-01", LINHA: "agregados", VALOR: 1000.004 },
        { MES: "2026-07-01", LINHA: "agregados", VALOR: 500 },
        { MES: "2026-07-01", LINHA: "chapa", VALOR: 120.5 },
        { MES: "2026-07-01", LINHA: "descarrego", VALOR: 300 },
      ],
      ["2026-07-01"],
    );
    expect(m.get("2026-07-01")).toEqual([
      { nome: LINHA_AGREGADOS, tipo: "variavel", valor: 1500 },
      { nome: LINHA_CHAPA, tipo: "variavel", valor: 120.5 },
      { nome: LINHA_DESCARREGO, tipo: "variavel", valor: 300 },
    ]);
  });

  it("mês sem lançamento sai com zero (a linha antiga é zerada, não fica velha)", () => {
    const m = linhasCustoTerceiros([], ["2026-08-01"]);
    expect(m.get("2026-08-01").map((l) => l.valor)).toEqual([0, 0, 0]);
  });

  it("estorno abate", () => {
    const m = linhasCustoTerceiros(
      [
        { MES: "2026-07-01", LINHA: "agregados", VALOR: 20150 },
        { MES: "2026-07-01", LINHA: "agregados", VALOR: -20150 },
      ],
      ["2026-07-01"],
    );
    expect(m.get("2026-07-01")[0].valor).toBe(0);
  });

  it("as três linhas caem no grupo Entrega do relatório", () => {
    expect(grupoDoLancamento(LINHA_AGREGADOS)).toBe("entrega");
    expect(grupoDoLancamento(LINHA_CHAPA)).toBe("entrega");
    expect(grupoDoLancamento(LINHA_DESCARREGO)).toBe("entrega");
  });
});

describe("mesesDesde", () => {
  it("vai do início até o mês de hoje (Recife)", () => {
    expect(mesesDesde("2026-07-01", new Date("2026-11-25T12:00:00Z"))).toEqual([
      "2026-07-01", "2026-08-01", "2026-09-01", "2026-10-01", "2026-11-01",
    ]);
  });
});

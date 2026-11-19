import { describe, it, expect } from "vitest";
import { marcarRetira, resumirRetira, type DevolucaoRetira } from "./devolucoes-retira";

const d = (over: Partial<DevolucaoRetira>): DevolucaoRetira => ({
  numTransEnt: 1, nfDevolucao: 100, dataDevolucao: "2026-11-07", numTransVenda: 10, nfOrigem: 2551172,
  dataVenda: "2026-11-05", valorNfOrigem: 133358.4, codcli: 40856, cliente: "FRUTART", motivo: "D- NAO FEZ O PEDIDO",
  setor: "Comercial", rca: "HELIO", balcao: false, valor: 133358.4, ...over,
});

describe("marcarRetira", () => {
  it("marca a NF de origem devolvida duas vezes acima do valor da nota", () => {
    const l = marcarRetira([d({}), d({ numTransEnt: 2, nfDevolucao: 32893 }), d({ numTransEnt: 3, numTransVenda: 11, codcli: 1 })]);
    expect(l.map((x) => x.duplicada)).toEqual([true, true, false]);
    expect(l[0].devolucoesDaOrigem).toBe(2);
    const r = resumirRetira(l);
    expect(r.excessoDuplicado).toBeCloseTo(133358.4, 2);
    expect(r.notas).toBe(3);
    expect(r.clientes).toBe(2);
  });

  it("duas devoluções parciais que somam até o valor da nota não são duplicidade", () => {
    const l = marcarRetira([d({ valor: 60000 }), d({ numTransEnt: 2, valor: 70000 })]);
    expect(l.every((x) => !x.duplicada)).toBe(true);
    expect(resumirRetira(l).excessoDuplicado).toBe(0);
  });
});

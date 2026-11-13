import { describe, expect, it } from "vitest";
import {
  situacao, obsoleto, estoqueIdeal, perdaRuptura, precoVenda, resumoEstoque, linhasTabela, tabelaParaCsv, compradores,
  type ProdutoEstoque,
} from "./estoque";

const HOJE = "2026-11-13";

// vendido3m 90 = 1 por dia → ideal 60
const p = (over: Partial<ProdutoEstoque> = {}): ProdutoEstoque => ({
  codprod: 1, produto: "ARROZ", embalagem: "UN", codfornec: 10, fornecedor: "FORN A", codcomprador: 5, comprador: "HELIO",
  estoque: 45, reservado: 2, bloqueado: 1, vendido3m: 90, custo: 10,
  ultimaSaida: "2026-11-12", ultimaEntrada: "2026-11-01", qtVendida90: 90, venda90: 1080, custo90: 900, ...over,
});

describe("situação pela cobertura", () => {
  it("faixas do Flask, sem buraco entre 30 e 31 dias", () => {
    expect(situacao(p({ estoque: 0 }))).toBe("ruptura");
    expect(situacao(p({ estoque: -3 }))).toBe("ruptura");
    expect(situacao(p({ estoque: 9 }))).toBe("iminente");
    expect(situacao(p({ estoque: 10 }))).toBe("comprar");
    expect(situacao(p({ estoque: 30.5 }))).toBe("ideal");
    expect(situacao(p({ estoque: 60 }))).toBe("ideal");
    expect(situacao(p({ estoque: 61 }))).toBe("excesso");
    expect(situacao(p({ vendido3m: 0 }))).toBe("excesso"); // tem estoque e não vende
  });
  it("ideal = 60 dias do giro", () => {
    expect(estoqueIdeal(p())).toBe(60);
  });
});

describe("obsoleto", () => {
  it("sem venda há mais de 45 dias e sem entrada há mais de 30", () => {
    expect(obsoleto(p({ ultimaSaida: "2026-09-20", ultimaEntrada: "2026-10-01" }), HOJE)).toBe(true);
    expect(obsoleto(p({ ultimaSaida: null, ultimaEntrada: null }), HOJE)).toBe(true);
    expect(obsoleto(p({ ultimaSaida: "2026-09-20", ultimaEntrada: "2026-11-01" }), HOJE)).toBe(false); // entrou há pouco
    expect(obsoleto(p({ ultimaSaida: "2026-10-20", ultimaEntrada: null }), HOJE)).toBe(false); // vendeu há 24 dias
    expect(obsoleto(p({ estoque: 0, ultimaSaida: null }), HOJE)).toBe(false);
  });
});

describe("preço praticado e ruptura", () => {
  it("preço = venda ÷ quantidade dos 90 dias; perda = média mensal × preço", () => {
    expect(precoVenda(p())).toBe(12);
    expect(precoVenda(p({ qtVendida90: 0 }))).toBeNull();
    expect(perdaRuptura(p({ estoque: 0 }))).toBe(30 * 12);
    expect(perdaRuptura(p())).toBe(0);
  });
});

describe("resumoEstoque", () => {
  const ps = [
    p({ codprod: 1, estoque: 100 }), // excesso 40 un × 10
    p({ codprod: 2, estoque: 0, codfornec: 11, fornecedor: "FORN B" }), // ruptura: falta 60 × 10, perda 360
    p({ codprod: 3, estoque: 20, qtVendida90: 0, venda90: 0, custo90: 0, ultimaSaida: "2026-09-01", ultimaEntrada: "2026-09-01" }), // obsoleto, sem preço
  ];
  const r = resumoEstoque(ps, HOJE, 500);

  it("ativos, ideal, excesso e falta a custo", () => {
    expect(r.skus).toBe(3);
    expect(r.ativoCusto).toBe(1200);
    expect(r.ativoVenda).toBe(1200); // só o produto 1 tem preço: 100 × 12
    expect(r.semPreco).toBe(1);
    expect(r.limiteIdeal).toBe(1800);
    expect(r.excesso).toBe(400);
    expect(r.falta).toBe(600 + 400); // produto 2 (60) + produto 3 (40)
    expect(r.oportunidades).toBe(2);
    expect(r.custoFinanceiro).toBeCloseTo(6);
  });

  it("ruptura, obsoletos, índices e capital livre", () => {
    expect(r.rupturas).toBe(1);
    expect(r.perdaRuptura).toBe(360);
    expect(r.obsoletos).toBe(1);
    expect(r.valorObsoletos).toBe(200);
    expect(r.quebraSkus).toBeCloseTo(1 / 3);
    expect(r.quebraValor).toBeCloseTo(1000 / 1800);
    expect(r.estoqueLiquidoPago).toBe(700);
    expect(r.markup).toBeCloseTo(0.2);
    expect(r.vendaMensal).toBe(720);
  });

  it("rankings e situações", () => {
    expect(r.porSituacao.find((s) => s.id === "ruptura")?.skus).toBe(1);
    expect(r.fornecedoresFalta.map((f) => [f.rotulo, f.valor])).toEqual([["11 · FORN B", 600], ["10 · FORN A", 400]]);
    expect(r.produtosRuptura[0]).toMatchObject({ chave: "2", valor: 360 });
    expect(r.produtosObsoletos[0]).toMatchObject({ chave: "3", valor: 73 });
    expect(r.porComprador[0]).toMatchObject({ rotulo: "HELIO", excesso: 400 });
  });

  it("sem contas a pagar, o capital livre fica em branco", () => {
    expect(resumoEstoque(ps, HOJE, null).estoqueLiquidoPago).toBeNull();
  });
});

describe("tabelas e planilhas", () => {
  const ps = [p({ codprod: 1, estoque: 100 }), p({ codprod: 2, estoque: 0 }), p({ codprod: 3, estoque: 5 })];

  it("excesso só traz quem passa do ideal; ruptura ordena pela situação", () => {
    expect(linhasTabela(ps, "excesso", HOJE).map((l) => l.codprod)).toEqual([1]);
    expect(linhasTabela(ps, "ruptura", HOJE).map((l) => l.situacao)).toEqual(["ruptura", "iminente", "excesso"]);
  });

  it("CSV com BOM, ';' e vírgula decimal", () => {
    const csv = tabelaParaCsv(linhasTabela(ps, "excesso", HOJE), "excesso");
    expect(csv.startsWith("﻿Comprador;Fornecedor;Produto")).toBe(true);
    expect(csv).toContain('"HELIO";"10 · FORN A";"1 · ARROZ";100;60;40;400');
  });

  it("compradores para o filtro", () => {
    expect(compradores([p(), p({ codcomprador: null })])).toEqual([{ chave: "5", rotulo: "HELIO" }]);
  });
});

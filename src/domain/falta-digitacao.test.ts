import { describe, it, expect } from "vitest";
import { filtrarFaltas, resumoFaltas, faltasParaCsv, type LinhaFalta } from "./falta-digitacao";

const linha = (over: Partial<LinhaFalta>): LinhaFalta => ({
  dia: "2026-11-05", numped: 1, codprod: 100, produto: "AZEITE", codfornec: 5, fornecedor: "FORN A", comprador: "JOAO",
  codcli: 7, cliente: "MERCADO X", codusur: 30, rca: "VENDEDOR A", qt: 2, valor: 50, temPedido: true, ...over,
});

describe("resumoFaltas", () => {
  const ls = [
    linha({}),
    linha({ numped: 2, codcli: 8, dia: "2026-11-07", qt: 3, valor: 90 }),
    linha({ numped: 2, codprod: 200, produto: "SUCO", codfornec: 6, fornecedor: "FORN B", comprador: null, codcli: 8, codusur: 31, rca: "VENDEDOR B", qt: 1, valor: 200 }),
  ];
  const r = resumoFaltas(ls);

  it("soma valor e quantidade e conta pedidos, SKUs, clientes e RCAs distintos", () => {
    expect(r).toMatchObject({ valor: 340, qt: 6, itens: 3, pedidos: 2, skus: 2, clientes: 2, rcas: 2 });
  });
  it("rankings por valor, com comprador vazio agrupado como 'Sem comprador'", () => {
    expect(r.porProduto.map((g) => [g.chave, g.valor])).toEqual([["200", 200], ["100", 140]]);
    expect(r.porComprador.map((g) => g.rotulo)).toEqual(["Sem comprador", "JOAO"]);
    expect(r.porRca[0]).toMatchObject({ chave: "31", rotulo: "31 · VENDEDOR B", pedidos: 1 });
  });
  it("tabela por produto com pedidos, clientes e último dia", () => {
    expect(r.produtos[1]).toMatchObject({ codprod: 100, qt: 5, itens: 2, pedidos: 2, clientes: 2, valor: 140, ultimoDia: "2026-11-07" });
  });
  it("vazio dá zeros", () => {
    expect(resumoFaltas([])).toMatchObject({ valor: 0, itens: 0, pedidos: 0, skus: 0, produtos: [] });
  });
});

describe("filtrarFaltas", () => {
  const ls = [linha({}), linha({ codprod: 200, comprador: null, codfornec: null, codcli: null })];
  it("usa as mesmas chaves dos filtros de corte", () => {
    expect(filtrarFaltas(ls, { produto: "200" })).toHaveLength(1);
    expect(filtrarFaltas(ls, { comprador: "Sem comprador" })[0].codprod).toBe(200);
    expect(filtrarFaltas(ls, { fornecedor: "0" })[0].codprod).toBe(200);
    expect(filtrarFaltas(ls, { cliente: "7" })[0].codprod).toBe(100);
  });
  it("ignora filtros que só existem nos cortes (motivo, área…)", () => {
    expect(filtrarFaltas(ls, { motivo: "Falta de mercadoria", origem: "Winthor" })).toHaveLength(2);
  });
});

describe("faltasParaCsv", () => {
  it("BOM, ';', vírgula decimal, ordem por data e depois valor", () => {
    const csv = faltasParaCsv([
      linha({ dia: "2026-11-07", valor: 10 }),
      linha({ dia: "2026-11-05", valor: 5.5, produto: 'AZEITE "EXTRA"', temPedido: false }),
    ]);
    expect(csv.startsWith("﻿Data;Pedido;")).toBe(true);
    const [, l1, l2] = csv.split("\n");
    expect(l1).toBe('05/11/2026;1;Não;100;"AZEITE ""EXTRA""";5;"FORN A";"JOAO";7;"MERCADO X";30;"VENDEDOR A";2;5,5');
    expect(l2.startsWith("07/11/2026;")).toBe(true);
  });
});

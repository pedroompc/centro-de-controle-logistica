import { describe, it, expect } from "vitest";
import { lerMotivo, resumoCortes, taxaCorte, filtrarCortes, rotuloFiltro, cortesParaCsv, variacaoCorte, variacaoTaxaCorte, serieDiaria, serieHoraria, porProdutoDetalhado, type LinhaCorte } from "./cortes";

describe("lerMotivo", () => {
  it("separa motivo e usuário do texto do Harpia", () => {
    expect(lerMotivo("1.HARPIA - FALTA DE MERCADORIA - Usuário: 27-CONF EDIVALDO")).toEqual({
      origem: "Separação (Harpia)",
      motivo: "Falta de mercadoria",
      usuario: "CONF EDIVALDO",
    });
  });
  it("Harpia sem motivo vira 'Sem justificativa'", () => {
    expect(lerMotivo("2.HARPIA -  - Usuário: 33-FAT RUBEN")).toEqual({ origem: "Separação (Harpia)", motivo: "Sem justificativa", usuario: "FAT RUBEN" });
  });
  it("texto digitado no Winthor fica como motivo, sem usuário", () => {
    expect(lerMotivo("ERRO DE DIGITACAO")).toEqual({ origem: "Winthor", motivo: "Erro de digitacao", usuario: null });
    expect(lerMotivo("falta de mercadoria").motivo).toBe("Falta de mercadoria");
    expect(lerMotivo(null)).toEqual({ origem: "Winthor", motivo: "Sem justificativa", usuario: null });
  });
});

const linha = (over: Partial<LinhaCorte>): LinhaCorte => ({
  dia: "2026-10-05", numped: 1, numcar: 10, codprod: 100, produto: "ARROZ", codfornec: 5, fornecedor: "FORN A",
  comprador: "JOAO", codcli: 7, cliente: "MERCADO X", qt: 2, valor: 50, kg: 10,
  motivo: "1.HARPIA - FALTA DE MERCADORIA - Usuário: 3-ADM GABRIEL", temPedido: true, hora: 22, ...over,
});

describe("resumoCortes", () => {
  const ls = [
    linha({}),
    linha({ numped: 2, codprod: 200, produto: "FEIJAO", valor: 30, motivo: "1.HARPIA - AVARIA - Usuário: 3-ADM GABRIEL" }),
    linha({ numped: 2, codprod: 100, valor: 20, dia: "2026-10-06", motivo: "ERRO DE DIGITACAO", codcli: 8, cliente: "LOJA Y" }),
  ];

  it("totais e agrupamentos ordenados pelo valor", () => {
    const r = resumoCortes(ls);
    expect(r).toMatchObject({ valor: 100, itens: 3, pedidos: 2, skus: 2, clientes: 2, kg: 30, harpia: 80 });
    expect(r.porMotivo.map((g) => [g.rotulo, g.valor])).toEqual([["Falta de mercadoria", 50], ["Avaria", 30], ["Erro de digitacao", 20]]);
    expect(r.porProduto[0]).toMatchObject({ rotulo: "100 · ARROZ", valor: 70, itens: 2, pedidos: 2 });
    expect(r.porUsuario).toEqual([expect.objectContaining({ rotulo: "ADM GABRIEL", valor: 80 })]);
    expect(r.porOrigem.map((g) => g.rotulo)).toEqual(["Separação (Harpia)", "Winthor"]);
  });

  it("recorte de um dia; o calendário continua com o mês todo", () => {
    const r = resumoCortes(ls, "2026-10-06");
    expect(r.valor).toBe(20);
    expect(r.porDia.get("2026-10-05")).toBe(80);
  });
});

describe("taxaCorte", () => {
  it("corte ÷ (corte + venda líquida)", () => {
    expect(taxaCorte(50, 950)).toBeCloseTo(0.05);
    expect(taxaCorte(10, null)).toBeNull();
    expect(taxaCorte(0, 0)).toBeNull();
  });
});

describe("filtrarCortes", () => {
  const ls = [
    linha({}),
    linha({ numped: 2, codprod: 200, produto: "FEIJAO", valor: 30, motivo: "1.HARPIA - AVARIA - Usuário: 3-ADM GABRIEL" }),
    linha({ numped: 3, valor: 20, motivo: "ERRO DE DIGITACAO", codfornec: 9, fornecedor: "FORN B" }),
  ];

  it("usa a mesma chave do agrupamento e combina filtros", () => {
    expect(filtrarCortes(ls, {}).length).toBe(3);
    expect(filtrarCortes(ls, { usuario: "ADM GABRIEL" }).map((l) => l.numped)).toEqual([1, 2]);
    expect(filtrarCortes(ls, { usuario: "ADM GABRIEL", motivo: "Avaria" }).map((l) => l.numped)).toEqual([2]);
    expect(filtrarCortes(ls, { fornecedor: "9" }).map((l) => l.numped)).toEqual([3]);
    expect(filtrarCortes(ls, { produto: "100" }).length).toBe(2);
  });

  it("rótulo do filtro vem do dado", () => {
    expect(rotuloFiltro(ls, "fornecedor", "9")).toBe("FORN B");
    expect(rotuloFiltro(ls, "produto", "200")).toBe("200 · FEIJAO");
    expect(rotuloFiltro(ls, "cliente", "999")).toBe("999");
  });
});

describe("cortesParaCsv", () => {
  const csv = cortesParaCsv([
    linha({ dia: "2026-10-06", valor: 12.5, produto: 'BISCOITO "RECHEADO"' }),
    linha({ dia: "2026-10-05", valor: 1234.567, cliente: null, codcli: null }),
  ]);
  const [cab, l1, l2] = csv.replace("﻿", "").split("\n");

  it("abre com BOM e cabeçalho separado por ;", () => {
    expect(csv.startsWith("﻿")).toBe(true);
    expect(cab.split(";")).toHaveLength(17);
  });

  it("ordena por data, formata data/decimais e lê motivo e usuário", () => {
    expect(l1.startsWith("05/10/2026;22h;1;10;100;")).toBe(true);
    expect(l1).toContain(";1234,57;");
    expect(l1).toContain(';"Falta de mercadoria";"ADM GABRIEL"');
    expect(l2).toContain('"BISCOITO ""RECHEADO"""');
  });
});

describe("comparação com o mês anterior", () => {
  it("variação relativa: subir piora, cair não", () => {
    expect(variacaoCorte(50650, 92382, "set")).toEqual({ texto: "−45% vs set", piorou: false });
    expect(variacaoCorte(120, 100, "set")).toEqual({ texto: "+20% vs set", piorou: true });
    expect(variacaoCorte(100, 100, "set")).toEqual({ texto: "0% vs set", piorou: false });
    expect(variacaoCorte(10, 0, "set")).toBeNull();
  });

  it("taxa compara em pontos percentuais, não em %", () => {
    expect(variacaoTaxaCorte(0.0009, 0.002, "set")).toEqual({ texto: "−0,11 p.p. vs set", piorou: false });
    expect(variacaoTaxaCorte(0.003, 0.002, "set")).toEqual({ texto: "+0,10 p.p. vs set", piorou: true });
    expect(variacaoTaxaCorte(null, 0.002, "set")).toBeNull();
  });
});

describe("serieDiaria", () => {
  it("preenche os dias sem corte com zero, inclusive a virada de mês", () => {
    const s = serieDiaria(new Map([["2026-10-31", 5]]), "2026-10-30", "2026-11-01");
    expect(s).toEqual([
      { dia: "2026-10-30", valor: 0 },
      { dia: "2026-10-31", valor: 5 },
      { dia: "2026-11-01", valor: 0 },
    ]);
  });
});

describe("filtro de origem", () => {
  it("separa o que veio do Harpia do que foi digitado no Winthor", () => {
    const ls = [linha({}), linha({ numped: 9, motivo: "ERRO DE DIGITACAO", valor: 7 })];
    expect(filtrarCortes(ls, { origem: "Winthor" }).map((l) => l.numped)).toEqual([9]);
  });
});

describe("por hora", () => {
  it("filtra pela hora do corte e a série começa às 7h", () => {
    const ls = [linha({}), linha({ numped: 2, hora: 3, valor: 5 }), linha({ numped: 3, hora: null })];
    expect(filtrarCortes(ls, { hora: "03" }).map((l) => l.numped)).toEqual([2]);
    const s = serieHoraria(resumoCortes(ls).porHora);
    expect(s).toHaveLength(24);
    expect(s[0]).toEqual({ chave: "07", hora: 7, valor: 0 });
    expect(s.find((h) => h.hora === 22)?.valor).toBe(50);
    expect(s.find((h) => h.hora === 3)?.valor).toBe(5);
  });
});

describe("porProdutoDetalhado", () => {
  it("junta por produto com cargas, pedidos, clientes, último dia e motivo de maior valor", () => {
    const ls = [
      linha({}),
      linha({ numped: 2, numcar: 11, codcli: 8, dia: "2026-10-09", valor: 30, motivo: "ERRO DE DIGITACAO" }),
      linha({ numped: 2, numcar: 11, codprod: 200, produto: "FEIJAO", valor: 5 }),
    ];
    const [arroz, feijao] = porProdutoDetalhado(ls);
    expect(arroz).toMatchObject({ codprod: 100, valor: 80, itens: 2, pedidos: 2, clientes: 2, cargas: 2, ultimoDia: "2026-10-09", motivo: "Falta de mercadoria" });
    expect(feijao).toMatchObject({ codprod: 200, valor: 5, pedidos: 1 });
  });
});

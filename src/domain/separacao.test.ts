import { describe, it, expect } from "vitest";
import { ehSetorSeparacao, mesmoSetor, papelSeparacao, serieCustoSetor } from "./separacao";

describe("separação", () => {
  it("reconhece o setor e compara nomes sem acento", () => {
    expect(ehSetorSeparacao("SEPARAÇÃO")).toBe(true);
    expect(ehSetorSeparacao("Recebimento")).toBe(false);
    expect(mesmoSetor("SEPARAÇÃO", "Separacao ")).toBe(true);
  });
  it("função pelo cargo", () => {
    expect(papelSeparacao("SEPARADOR")).toBe("separador");
    expect(papelSeparacao("AJUDANTE DE CARGA E DESCARGA")).toBe("separador");
    expect(papelSeparacao("CONFERENTE")).toBe("conferente");
    expect(papelSeparacao("Operador de empilhadeira")).toBe("maquina");
    expect(papelSeparacao("LÍDER DE SEPARAÇÃO")).toBe("lider");
    expect(papelSeparacao("Motorista")).toBe("outros");
  });
  it("série: foto nos meses passados, cadastro no corrente, vazio sem foto", () => {
    const s = serieCustoSetor(
      ["2026-08-01", "2026-09-01", "2026-10-01"],
      [{ mes: "2026-09-01", ativos: 10, custoAtivos: 40_000 }],
      "2026-10-01",
      { pessoas: 11, folha: 44_000 },
    );
    expect(s).toEqual([
      { mes: "2026-08-01", pessoas: null, folha: null },
      { mes: "2026-09-01", pessoas: 10, folha: 40_000 },
      { mes: "2026-10-01", pessoas: 11, folha: 44_000 },
    ]);
  });
});

import { resumoProducao, porConferente, errosPorMilItens } from "./separacao";

describe("produção pela conferência (Harpia)", () => {
  const dias = [
    { dia: "2026-10-01", caixas: 100, unidades: 1200, itens: 50, pedidos: 10, clientes: 8, mapas: 3 },
    { dia: "2026-10-02", caixas: 0, unidades: 0, itens: 0, pedidos: 0, clientes: 0, mapas: 0 },
    { dia: "2026-10-03", caixas: 60, unidades: 700, itens: 30, pedidos: 6, clientes: 5, mapas: 2 },
  ];
  it("soma os dias e conta só os dias com movimento", () => {
    expect(resumoProducao(dias)).toEqual({ caixas: 160, unidades: 1900, itens: 80, pedidos: 16, clientes: 13, mapas: 5, dias: 2 });
  });
  it("por conferente: soma, ordena por itens e só calcula itens/h com 1h+", () => {
    const l = [
      { dia: "2026-10-01", usuario: 24, caixas: 80, unidades: 900, itens: 40, pedidos: 8, horas: 4 },
      { dia: "2026-10-03", usuario: 24, caixas: 40, unidades: 500, itens: 20, pedidos: 4, horas: 2 },
      { dia: "2026-10-01", usuario: 65, caixas: 20, unidades: 300, itens: 10, pedidos: 2, horas: 0.5 },
    ];
    const r = porConferente(l);
    expect(r.map((x) => x.usuario)).toEqual([24, 65]);
    expect(r[0]).toMatchObject({ caixas: 120, itens: 60, dias: 2, horas: 6, itensPorHora: 10 });
    expect(r[1].itensPorHora).toBeNull();
    // dia curto (0,5h) não entra na taxa, mas entra no total
    const misto = porConferente([...l, { dia: "2026-10-03", usuario: 65, caixas: 50, unidades: 0, itens: 50, pedidos: 0, horas: 5 }]);
    expect(misto.find((x) => x.usuario === 65)).toMatchObject({ caixas: 70, itensPorHora: 10 });
    expect(porConferente(l, "2026-10-03")).toHaveLength(1);
  });
  it("erros por mil itens", () => {
    expect(errosPorMilItens(3, 1500)).toBe(2);
    expect(errosPorMilItens(3, 0)).toBeNull();
  });
});

import { resumoPedidos } from "./separacao";

describe("produção pelos pedidos (Winthor)", () => {
  it("soma e tira as médias", () => {
    const r = resumoPedidos([
      { dia: "2026-10-01", pedidos: 100, kg: 50_000, valor: 200_000, carregamentos: 8, clientes: 90, skus: 1200 },
      { dia: "2026-10-02", pedidos: 0, kg: 0, valor: 0, carregamentos: 0, clientes: 0, skus: 0 },
      { dia: "2026-10-03", pedidos: 50, kg: 25_000, valor: 100_000, carregamentos: 4, clientes: 45, skus: 600 },
    ]);
    expect(r).toMatchObject({ pedidos: 150, kg: 75_000, carregamentos: 12, skus: 1800, dias: 2, skuPorPedido: 12, kgPorPedido: 500, pedidosPorDia: 75 });
    expect(resumoPedidos([]).skuPorPedido).toBeNull();
  });
});

import { rendimentoMensal, capacidadeSeparacao, mediaPorHora } from "./separacao";

describe("visão do gestor", () => {
  it("rendimento por pessoa por dia, mês a mês", () => {
    const r = rendimentoMensal(
      [
        { mes: "2026-09-01", pedidos: 20_000, kg: 1_000_000, skus: 200_000, dias: 25 },
        { mes: "2026-10-01", pedidos: 4_000, kg: 200_000, skus: 40_000, dias: 5 },
      ],
      new Map([["2026-09-01", 10], ["2026-10-01", null]]),
    );
    expect(r[0]).toMatchObject({ pedidosPorPessoaDia: 80, kgPorPessoaDia: 4000, skusPorPessoaDia: 800, pedidosPorDia: 800 });
    expect(r[1]).toMatchObject({ pedidosPorPessoaDia: null, pedidosPorDia: 800 });
  });
  it("capacidade: ritmo do pico, ideal para o dia forte e cenários", () => {
    const c = capacidadeSeparacao([800, 900, 1000, 700, 0, 950], 10)!;
    expect(c.pico).toBe(1000);
    expect(c.porSeparador).toBe(100);
    expect(c.ideal).toBe(Math.ceil(c.p90 / 100));
    const menos1 = c.cenarios.find((x) => x.separadores === 9)!;
    expect(menos1.capacidade).toBe(900);
    expect(menos1.diasAcima).toBe(2); // 1000 e 950
    expect(capacidadeSeparacao([], 10)).toBeNull();
  });
  it("média por hora preenche as horas vazias do turno", () => {
    expect(mediaPorHora([{ hora: 8, pedidos: 100 }, { hora: 10, pedidos: 50 }], 5)).toEqual([
      { hora: 8, media: 20 },
      { hora: 9, media: 0 },
      { hora: 10, media: 10 },
    ]);
  });
});

import { chaveMapa, rankingSeparadores } from "./separacao";

describe("quem separou o mapa", () => {
  it("normaliza o nº do mapa", () => {
    expect(chaveMapa(" 0001155 ")).toBe("1155");
    expect(chaveMapa("a12")).toBe("A12");
  });
  it("divide mapa com 2 separadores e mede cobertura", () => {
    const mapas = [
      { mapa: "1", dia: "2026-10-01", itens: 100, pedidos: 10, unidades: 1000, erros: 2 },
      { mapa: "2", dia: "2026-10-01", itens: 60, pedidos: 6, unidades: 600, erros: 0 },
      { mapa: "3", dia: "2026-10-02", itens: 40, pedidos: 4, unidades: 400, erros: 1 },
    ];
    const r = rankingSeparadores(
      [
        { mapa: "001", funcionarioId: "ana" },
        { mapa: "2", funcionarioId: "ana" },
        { mapa: "2", funcionarioId: "bia" },
        { mapa: "99", funcionarioId: "bia" },
      ],
      mapas,
    );
    const ana = r.ranking.find((x) => x.funcionarioId === "ana")!;
    expect(ana).toMatchObject({ mapas: 2, itens: 130, erros: 2, dias: 1 });
    expect(ana.errosPorMil).toBeCloseTo((2 / 130) * 1000);
    expect(r.ranking.find((x) => x.funcionarioId === "bia")).toMatchObject({ mapas: 2, itens: 30 });
    expect(r).toMatchObject({ mapasNoHarpia: 3, mapasComSeparador: 2, informadosSemHarpia: 1 });
    expect(r.cobertura).toBeCloseTo(2 / 3);
  });
});

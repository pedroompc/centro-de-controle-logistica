import { describe, expect, it } from "vitest";
import { montarEvolucaoCasa, montarPlacar } from "./bi-geral-graficos";
import type { IndicadorGeral } from "./bi-geral";

const fech = (mes: string, vendaLiquida: number, atendimentos: number) => ({ mes, vendaLiquida, atendimentos });

describe("montarEvolucaoCasa", () => {
  const base = {
    qtd: 12,
    fechados: [fech("2026-06-01", 40e6, 9000), fech("2026-09-01", 45e6, 10000), fech("2026-10-01", 50e6, 11000)],
    folhaPorMes: new Map([["2026-09-01", 1e6], ["2026-10-01", 1.1e6]]),
    custosPorMes: new Map([["2026-09-01", { fixos: 200e3, variaveis: 300e3 }], ["2026-10-01", { fixos: 200e3, variaveis: 200e3 }]]),
    hojeMes: "2026-11-01",
  };

  it("meses fechados: faturamento e clientes da foto, custo = folha do mês + fixos + variáveis", () => {
    const r = montarEvolucaoCasa({ ...base, ateMes: "2026-10-01", atual: null });
    expect(r.map((p) => p.mes)).toEqual(["2026-06-01", "2026-09-01", "2026-10-01"]);
    expect(r[1]).toMatchObject({ faturamento: 45e6, clientes: 10000, custo: 1.5e6, parcial: false });
    expect(r[1].custoSobreFat).toBeCloseTo(1.5e6 / 45e6);
  });

  it("antes do histórico de custos (jul/2026): custo e custo÷faturamento sem dado, nunca 0", () => {
    const r = montarEvolucaoCasa({ ...base, ateMes: "2026-10-01", atual: null });
    expect(r[0]).toMatchObject({ mes: "2026-06-01", custo: null, custoSobreFat: null, faturamento: 40e6 });
  });

  it("o mês escolhido usa os números dos cartões (os mesmos da tela) e o mês corrente sai como parcial", () => {
    const atual = { mes: "2026-11-01", faturamento: 27e6, custo: 1.4e6, clientes: 6000 };
    const r = montarEvolucaoCasa({ ...base, ateMes: "2026-11-01", atual });
    expect(r[r.length - 1]).toMatchObject({ mes: "2026-11-01", faturamento: 27e6, custo: 1.4e6, clientes: 6000, parcial: true });
    expect(r[r.length - 1].custoSobreFat).toBeCloseTo(1.4e6 / 27e6);
  });

  it("o cartão do mês fechado escolhido substitui a foto daquele mês", () => {
    const atual = { mes: "2026-10-01", faturamento: 51e6, custo: 1.6e6, clientes: 11500 };
    const r = montarEvolucaoCasa({ ...base, ateMes: "2026-10-01", atual });
    expect(r.filter((p) => p.mes === "2026-10-01")).toEqual([
      expect.objectContaining({ faturamento: 51e6, custo: 1.6e6, clientes: 11500, parcial: false }),
    ]);
  });

  it("foto com clientes ou faturamento zerado (mês anterior à métrica existir) = sem dado, não 0", () => {
    const r = montarEvolucaoCasa({ ...base, fechados: [fech("2026-05-01", 38e6, 0), fech("2026-04-01", 0, 0)], ateMes: "2026-05-01", atual: null });
    expect(r).toEqual([expect.objectContaining({ mes: "2026-05-01", faturamento: 38e6, clientes: null })]);
  });

  it("janela de `qtd` meses terminando no mês escolhido; nada depois dele", () => {
    const r = montarEvolucaoCasa({ ...base, qtd: 2, ateMes: "2026-09-01", atual: null });
    expect(r.map((p) => p.mes)).toEqual(["2026-09-01"]);
  });
});

const ind = (chave: string, valor: number | null, formato: IndicadorGeral["formato"] = "int", maiorEhBom = true): IndicadorGeral => ({
  chave, rotulo: chave, valor, formato, maiorEhBom,
});

describe("montarPlacar", () => {
  it("variação relativa por indicador, na ordem dos setores; ruim marcado pela direção", () => {
    const linhas = montarPlacar([
      { setor: "separacao", atuais: [ind("pedidos", 110), ind("custoPorCaixa", 0.8, "brlPorCx", false)], base: [ind("pedidos", 100), ind("custoPorCaixa", 1, "brlPorCx", false)] },
    ]);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toMatchObject({ setor: "separacao", chave: "pedidos", pct: expect.closeTo(10), positivo: true });
    expect(linhas[1]).toMatchObject({ chave: "custoPorCaixa", pct: expect.closeTo(-20), positivo: true });
  });

  it("fora do placar: taxas (p.p. não cabe no mesmo eixo de %), lado sem dado, base zero e setor sem base", () => {
    const linhas = montarPlacar([
      { setor: "motoristas", atuais: [ind("devolucao", 0.03, "pct", false), ind("entregas", null), ind("km", 5, "km", false)], base: [ind("devolucao", 0.02, "pct", false), ind("entregas", 10), ind("km", 0, "km", false)] },
      { setor: "abastecimento", atuais: [ind("movimentacoes", 10)], base: null },
    ]);
    expect(linhas).toEqual([]);
  });
});

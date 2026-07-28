import { describe, it, expect } from "vitest";
import {
  toneladas, calcularReceita, arredonda2, receitaTotal, toneladasTotal,
  valorMedioPorTonelada, receitaPorFornecedor, receitaPorTipo, quantidadePorTipo, custoLiquido,
  calcularValorDiversa, valorTotalDiversas, resumoReceitas, resolverValorDiversa,
  receitaPorDia, calcularReceitaVolume,
} from "./receitas-metrics";
import type { Receita, ReceitaDiversa, TotalDiarioDescarregamento } from "./types";

const r = (over: Partial<Receita>): Receita => ({
  id: "x", data: "2026-07-10", fornecedorId: "f1", fornecedorNome: "Forn 1",
  pesoKg: 1000, tipo: "batido", precoPorTonelada: 20, receita: 20,
  minimoAplicado: 0, observacao: null, quantidade: null, precoPorUnidade: null, ...over,
});

const td = (over: Partial<TotalDiarioDescarregamento>): TotalDiarioDescarregamento => ({
  id: "t1", data: "2026-07-10", descarregos: 8, porTipo: null, pesoKg: 20000, receita: 500,
  observacao: null, ...over,
});

describe("receitas-metrics", () => {
  it("converte kg para toneladas", () => {
    expect(toneladas(12500)).toBe(12.5);
  });

  it("calcula receita = toneladas × preço, 2 casas (exemplo do spec)", () => {
    expect(calcularReceita(12500, 20)).toBe(250);
  });

  it("arredonda a receita a centavos", () => {
    // 1234 kg = 1,234 t × 33,33 = 41,12922 → 41,13
    expect(calcularReceita(1234, 33.33)).toBe(41.13);
    expect(arredonda2(41.129)).toBe(41.13);
  });

  it("eleva a receita ao mínimo quando o cálculo fica abaixo dele", () => {
    // 500 kg = 0,5 t × 30 = R$ 15,00 → cobra o mínimo de R$ 25,00
    expect(calcularReceita(500, 30, 25)).toBe(25);
  });

  it("não usa o mínimo como teto: cálculo maior prevalece", () => {
    expect(calcularReceita(12500, 20, 25)).toBe(250);
  });

  it("cálculo exatamente igual ao mínimo devolve o mínimo", () => {
    // 1000 kg = 1 t × 25 = R$ 25,00
    expect(calcularReceita(1000, 25, 25)).toBe(25);
  });

  it("sem mínimo informado, mantém o cálculo puro", () => {
    expect(calcularReceita(500, 30)).toBe(15);
  });

  it("arredonda o mínimo para 2 casas quando é retornado como resultado final", () => {
    // Mínimo com ruído float (3+ casas) deve ser arredondado: 25.555 → 25.56
    // 500 kg = 0,5 t × 30 = 15,00 < 25.555 (mínimo), logo retorna 25.555 arredondado
    expect(calcularReceita(500, 30, 25.555)).toBe(25.56);
  });

  it("soma receita total e toneladas totais", () => {
    const rs = [r({ receita: 250, pesoKg: 12500 }), r({ receita: 100, pesoKg: 5000 })];
    expect(receitaTotal(rs)).toBe(350);
    expect(toneladasTotal(rs)).toBe(17.5);
  });

  it("valor médio por tonelada = receita total / toneladas totais", () => {
    const rs = [r({ receita: 250, pesoKg: 12500 }), r({ receita: 100, pesoKg: 5000 })];
    expect(valorMedioPorTonelada(rs)).toBe(20);
    expect(valorMedioPorTonelada([])).toBe(0);
  });

  it("agrupa receita por fornecedor, desc", () => {
    const rs = [
      r({ fornecedorId: "a", fornecedorNome: "A", receita: 100 }),
      r({ fornecedorId: "b", fornecedorNome: "B", receita: 300 }),
      r({ fornecedorId: "a", fornecedorNome: "A", receita: 50 }),
    ];
    expect(receitaPorFornecedor(rs)).toEqual([
      { fornecedorId: "b", nome: "B", valor: 300 },
      { fornecedorId: "a", nome: "A", valor: 150 },
    ]);
  });

  it("agrupa receita por tipo, incluindo pal_rem", () => {
    const rs = [
      r({ tipo: "batido", receita: 100 }),
      r({ tipo: "paletizado", receita: 40 }),
      r({ tipo: "batido", receita: 10 }),
      r({ tipo: "pal_rem", receita: 25 }),
    ];
    expect(receitaPorTipo(rs)).toEqual({ batido: 110, paletizado: 40, pal_rem: 25, volume: 0 });
  });

  it("zera os tipos sem lançamento em vez de omiti-los", () => {
    expect(receitaPorTipo([])).toEqual({ batido: 0, paletizado: 0, pal_rem: 0, volume: 0 });
  });

  it("quantidadePorTipo: 1 linha detalhada = 1 carro, somado à quebra do total do dia", () => {
    const rs = [r({ tipo: "batido" }), r({ tipo: "batido" }), r({ tipo: "volume" })];
    const totais = [
      td({ porTipo: { batido: 2, paletizado: 3, pal_rem: 1, volume: 0 } }),
      td({ porTipo: null }), // registro antigo: não entra na quebra
    ];
    expect(quantidadePorTipo(rs, totais)).toEqual({ batido: 4, paletizado: 3, pal_rem: 1, volume: 1 });
  });

  it("quantidadePorTipo sem totais: conta só as linhas detalhadas", () => {
    expect(quantidadePorTipo([r({ tipo: "pal_rem" })])).toEqual({ batido: 0, paletizado: 0, pal_rem: 1, volume: 0 });
  });

  it("custo líquido = brutos − receitas", () => {
    expect(custoLiquido(50000, 8000)).toBe(42000);
  });

  const d = (over: Partial<ReceitaDiversa>): ReceitaDiversa => ({
    id: "d1", data: "2026-07-10", categoria: "reciclagem",
    material: "Plástico stretch", quantidade: 100, unidade: "kg",
    precoUnitario: 1.2, valor: 120, observacao: null, ...over,
  });

  it("calcula o valor sugerido de uma receita diversa", () => {
    expect(calcularValorDiversa(100, 1.2)).toBe(120);
  });

  it("arredonda o valor sugerido a centavos", () => {
    // 33,3 kg × 1,17 = 38,961 → 38,96
    expect(calcularValorDiversa(33.3, 1.17)).toBe(38.96);
  });

  it("não aplica piso mínimo em receita diversa (regra é de descarregamento)", () => {
    expect(calcularValorDiversa(1, 0.5)).toBe(0.5);
  });

  it("soma o valor GRAVADO, não o recalculado de quantidade × preço", () => {
    // Valor negociado (110) difere do produto (120): manda o negociado.
    const negociado = d({ quantidade: 100, precoUnitario: 1.2, valor: 110 });
    expect(valorTotalDiversas([negociado])).toBe(110);
  });

  it("soma várias diversas de forma estável", () => {
    expect(valorTotalDiversas([d({ valor: 10.1 }), d({ valor: 20.2 })])).toBe(30.3);
  });

  it("soma as duas origens no total, mas mantém o médio/ton só do descarregamento", () => {
    // A armadilha do módulo: se a receita de reciclagem vazar para o numerador
    // do médio/ton, ele vira 31,00 — dinheiro que não veio de tonelada nenhuma.
    const resumo = resumoReceitas(
      [r({ pesoKg: 10000, receita: 200 })],
      [d({ valor: 110 })],
    );
    expect(resumo.total).toBe(310);
    expect(resumo.totalDescarregamento).toBe(200);
    expect(resumo.totalDiversas).toBe(110);
    expect(resumo.medioPorTonelada).toBe(20); // 200 / 10 t — NÃO 310 / 10
  });

  it("não divide por zero quando não há descarregamento no período", () => {
    const resumo = resumoReceitas([], [d({ valor: 50 })]);
    expect(resumo.total).toBe(50);
    expect(resumo.medioPorTonelada).toBe(0);
  });

  it("soma os totais diários no descarregamento (card, peso e médio/ton)", () => {
    const resumo = resumoReceitas(
      [r({ pesoKg: 10000, receita: 200 })],
      [],
      [td({ pesoKg: 10000, receita: 300 })],
    );
    expect(resumo.totalDescarregamento).toBe(500); // 200 detalhado + 300 total do dia
    expect(resumo.toneladas).toBe(20);             // 10 t + 10 t
    expect(resumo.medioPorTonelada).toBe(25);      // 500 / 20 t
    expect(resumo.total).toBe(500);
  });

  it("Volume: soma no card e no peso total, mas fica fora do R$/ton", () => {
    const resumo = resumoReceitas(
      [
        r({ tipo: "batido", pesoKg: 10000, receita: 200 }),
        r({ tipo: "volume", pesoKg: 5000, receita: 300, quantidade: 100, precoPorUnidade: 3, precoPorTonelada: 0 }),
      ],
      [],
    );
    expect(resumo.totalDescarregamento).toBe(500); // 200 + 300 (inclui Volume)
    expect(resumo.toneladas).toBe(15);             // 10 t + 5 t (inclui Volume)
    expect(resumo.medioPorTonelada).toBe(20);      // 200 / 10 t — Volume fora
  });
});

describe("calcularReceitaVolume", () => {
  it("receita de volume = caixas × preço/caixa", () => {
    expect(calcularReceitaVolume(100, 3)).toBe(300);
  });
  it("aplica o mínimo quando caixas × preço fica abaixo", () => {
    expect(calcularReceitaVolume(2, 5, 25)).toBe(25); // 10 < 25
  });
  it("sem mínimo informado, mantém o produto puro", () => {
    expect(calcularReceitaVolume(3, 1.15)).toBe(3.45);
  });
});

describe("resolverValorDiversa", () => {
  // Regra central da feature: o valor negociado com o comprador manda sobre o
  // produto quantidade × preço. Só cai no cálculo quando o valor bruto do
  // formulário não é um número válido e positivo.

  it("mantém o valor informado mesmo divergente do produto (desconto negociado)", () => {
    // Produto seria 100 × 1,2 = 120, mas o negociado foi 110.
    expect(resolverValorDiversa("110", 100, 1.2)).toBe(110);
  });

  it("cai no produto quando o valor bruto é null", () => {
    expect(resolverValorDiversa(null, 100, 1.2)).toBe(120);
  });

  it("cai no produto quando o valor bruto é string vazia", () => {
    expect(resolverValorDiversa("", 100, 1.2)).toBe(120);
  });

  it('cai no produto quando o valor bruto é "0"', () => {
    expect(resolverValorDiversa("0", 100, 1.2)).toBe(120);
  });

  it("cai no produto quando o valor bruto é negativo", () => {
    expect(resolverValorDiversa("-5", 100, 1.2)).toBe(120);
  });

  it("cai no produto quando o valor bruto não é numérico", () => {
    expect(resolverValorDiversa("abc", 100, 1.2)).toBe(120);
  });
});

describe("receitaPorDia", () => {
  it("agrupa lançamentos do mesmo dia somando contagem, peso e receita", () => {
    const dias = receitaPorDia([
      r({ id: "a", data: "2026-07-10", pesoKg: 1000, receita: 20 }),
      r({ id: "b", data: "2026-07-10", pesoKg: 2500, receita: 62.5 }),
    ]);
    expect(dias).toEqual([
      { data: "2026-07-10", descarregos: 2, pesoKg: 3500, receita: 82.5, origem: "detalhado" },
    ]);
  });

  it("inclui os totais diários como linhas de origem 'total', com id", () => {
    const dias = receitaPorDia([], [td({ id: "t9", data: "2026-07-15", descarregos: 12, pesoKg: 34000, receita: 900 })]);
    expect(dias).toEqual([
      { data: "2026-07-15", descarregos: 12, pesoKg: 34000, receita: 900, origem: "total", id: "t9" },
    ]);
  });

  it("no dia misto, mantém detalhado e total como linhas separadas", () => {
    const dias = receitaPorDia(
      [r({ id: "a", data: "2026-07-10", pesoKg: 1000, receita: 20 })],
      [td({ id: "t1", data: "2026-07-10", descarregos: 5, pesoKg: 9000, receita: 250 })],
    );
    expect(dias).toHaveLength(2);
    expect(dias.filter((d) => d.origem === "detalhado")).toHaveLength(1);
    expect(dias.filter((d) => d.origem === "total")).toHaveLength(1);
  });

  it("ordena detalhado e total juntos por data desc", () => {
    const dias = receitaPorDia(
      [r({ id: "a", data: "2026-07-03" })],
      [td({ id: "t1", data: "2026-07-21" }), td({ id: "t2", data: "2026-07-12" })],
    );
    expect(dias.map((d) => d.data)).toEqual(["2026-07-21", "2026-07-12", "2026-07-03"]);
  });

  it("ordena do dia mais recente para o mais antigo", () => {
    const dias = receitaPorDia([
      r({ id: "a", data: "2026-07-03" }),
      r({ id: "b", data: "2026-07-21" }),
      r({ id: "c", data: "2026-07-12" }),
    ]);
    expect(dias.map((d) => d.data)).toEqual(["2026-07-21", "2026-07-12", "2026-07-03"]);
  });

  it("devolve lista vazia sem lançamentos", () => {
    expect(receitaPorDia([])).toEqual([]);
  });

  it("a soma das receitas por dia bate com receitaTotal", () => {
    // Invariante do módulo: a direção lê o total do rodapé da vista simples e a
    // operação lê o card do topo. Os dois vêm de caminhos diferentes de soma —
    // se divergirem por centavo de arredondamento, ninguém sabe qual acreditar.
    const rs = [
      r({ id: "a", data: "2026-07-10", pesoKg: 1234, receita: 24.68 }),
      r({ id: "b", data: "2026-07-10", pesoKg: 777, receita: 15.54 }),
      r({ id: "c", data: "2026-07-11", pesoKg: 3333, receita: 66.67 }),
      r({ id: "d", data: "2026-07-12", pesoKg: 91, receita: 1.83 }),
    ];
    const somaDosDias = arredonda2(
      receitaPorDia(rs).reduce((t, d) => t + d.receita, 0),
    );
    expect(somaDosDias).toBe(receitaTotal(rs));
  });
});

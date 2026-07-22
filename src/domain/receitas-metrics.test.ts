import { describe, it, expect } from "vitest";
import {
  toneladas, calcularReceita, arredonda2, receitaTotal, toneladasTotal,
  valorMedioPorTonelada, receitaPorFornecedor, receitaPorTipo, custoLiquido,
  calcularValorDiversa, valorTotalDiversas,
} from "./receitas-metrics";
import type { Receita, ReceitaDiversa } from "./types";

const r = (over: Partial<Receita>): Receita => ({
  id: "x", data: "2026-07-10", fornecedorId: "f1", fornecedorNome: "Forn 1",
  pesoKg: 1000, tipo: "batido", precoPorTonelada: 20, receita: 20,
  minimoAplicado: 0, observacao: null, ...over,
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
    expect(receitaPorTipo(rs)).toEqual({ batido: 110, paletizado: 40, pal_rem: 25 });
  });

  it("zera os tipos sem lançamento em vez de omiti-los", () => {
    expect(receitaPorTipo([])).toEqual({ batido: 0, paletizado: 0, pal_rem: 0 });
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

  it("receita diversa NÃO contamina os indicadores de descarregamento", () => {
    // A armadilha central da spec: valor médio/tonelada tem que ignorar
    // receita que não veio de tonelada nenhuma.
    const descarregamentos = [r({ pesoKg: 10000, receita: 200 })];
    expect(valorMedioPorTonelada(descarregamentos)).toBe(20);
    expect(toneladasTotal(descarregamentos)).toBe(10);
    expect(receitaTotal(descarregamentos)).toBe(200);
  });
});

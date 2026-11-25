import { describe, it, expect } from "vitest";
import {
  casarMatriculas,
  cpfDoFornecedor,
  diferencaVsCasa,
  indicadores,
  montarAgregados,
  nomeDoFornecedor,
  totaisCasa,
  type OperacaoPessoa,
} from "./agregados";

const op = (o: Partial<OperacaoPessoa>): OperacaoPessoa => ({
  matricula: 1, papel: "motorista", nome: "X", cpf: null,
  dias: 10, viagens: 10, notas: 100, entregas: 50, kg: 1000, faturado: 100_000, notasDevolvidas: 5, devolvido: 4_000,
  ...o,
});

describe("nome e CPF do fornecedor", () => {
  it("tira a raiz do CNPJ da frente e o CPF do fim", () => {
    expect(nomeDoFornecedor("57.790.731 LEONARDO DE LIMA LOPES")).toBe("LEONARDO DE LIMA LOPES");
    expect(nomeDoFornecedor("JOSE ORLANDO DA SILVA 62053035404")).toBe("JOSE ORLANDO DA SILVA");
  });
  it("CPF vem do fim do nome ou do CGC quando é CPF", () => {
    expect(cpfDoFornecedor("JOSE ORLANDO DA SILVA 62053035404", "39.922.568/0001-03")).toBe("62053035404");
    expect(cpfDoFornecedor("JOSE GERALDO", "446.191.034-20")).toBe("44619103420");
    expect(cpfDoFornecedor("57.790.731 LEONARDO", "57.790.731/0001-03")).toBeNull();
  });
});

describe("casarMatriculas", () => {
  const pessoas = [
    { matricula: 10, nome: "EUGENIO CORREA DE MESQUITA", cpf: "111" },
    { matricula: 20, nome: "LEONARDO DE LIMA LOPES", cpf: null },
    { matricula: 30, nome: "JOSE ORLANDO DA SILVA", cpf: "62053035404" },
    { matricula: 40, nome: "JOSE FERNANDO VIEIRA DA SILVA", cpf: null },
  ];
  it("CPF vence", () => expect(casarMatriculas("QUALQUER", "62053035404", pessoas)).toEqual([30]));
  it("nome igual", () => expect(casarMatriculas("LEONARDO DE LIMA LOPES", null, pessoas)).toEqual([20]));
  it("palavra a palavra (Correia × Correa de)", () => expect(casarMatriculas("EUGENIO CORREIA MESQUITA", null, pessoas)).toEqual([10]));
  it("só o primeiro nome não casa", () => expect(casarMatriculas("JOSE", null, pessoas)).toEqual([]));
  it("dois candidatos não casa", () => expect(casarMatriculas("JOSE DA SILVA", null, pessoas)).toEqual([]));
});

describe("montarAgregados", () => {
  it("dois CNPJs da mesma pessoa viram uma linha; papel = onde mais rodou", () => {
    const linhas = montarAgregados(
      [
        { codFornec: 1, nome: "60.505.103 CRISTIANO NUNES DA SILVA NETO", cgc: null, custo: 1000, lotes: 1, ultimo: "2026-10-07" },
        { codFornec: 2, nome: "69.229.147 CRISTIANO NUNES DA SILVA NETO", cgc: null, custo: 3000, lotes: 3, ultimo: "2026-10-28" },
      ],
      [
        op({ matricula: 7, nome: "CRISTIANO NUNES DA SILVA NETO", papel: "motorista", dias: 18 }),
        op({ matricula: 7, nome: "CRISTIANO NUNES DA SILVA NETO", papel: "ajudante", dias: 2 }),
      ],
    );
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ custo: 4000, lotes: 4, papel: "motorista", dias: 18, matriculas: [7], ultimoPagamento: "2026-10-28" });
  });
  it("pago sem carga no período fica com papel null", () => {
    const [l] = montarAgregados([{ codFornec: 1, nome: "MARIA VALKIRIA DOS SANTOS MESQUITA", cgc: null, custo: 5400, lotes: 1, ultimo: null }], []);
    expect(l.papel).toBeNull();
    expect(l.dias).toBe(0);
  });
});

describe("indicadores e comparação com a casa", () => {
  it("custo ÷ faturado líquido e devolução por valor", () => {
    const i = indicadores({ ...op({}), custo: 4_800 });
    expect(i.custoPorDia).toBe(480);
    expect(i.devolucao).toBeCloseTo(0.04);
    expect(i.custoSobreFaturado).toBeCloseTo(4_800 / 96_000);
  });
  it("vs casa = custo − custo/dia da casa × dias dele", () => {
    const casa = totaisCasa("motorista", [op({ matricula: 9, dias: 20 })], new Set([9]), 6_000); // R$ 300/dia
    const [a] = montarAgregados(
      [{ codFornec: 1, nome: "LEONARDO DE LIMA LOPES", cgc: null, custo: 4_000, lotes: 1, ultimo: null }],
      [op({ matricula: 20, nome: "LEONARDO DE LIMA LOPES", dias: 10 })],
    );
    expect(diferencaVsCasa(a, casa)).toBe(1_000); // 4.000 − 300 × 10
  });
  it("casa só conta as matrículas dela e o papel pedido", () => {
    const c = totaisCasa("motorista", [op({ matricula: 1 }), op({ matricula: 2 }), op({ matricula: 1, papel: "ajudante" })], new Set([1]), 0);
    expect(c).toMatchObject({ pessoas: 1, dias: 10 });
  });
});

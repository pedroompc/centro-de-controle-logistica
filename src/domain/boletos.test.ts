import { describe, expect, it } from "vitest";
import { contaComDigito, montarBoleto, type ParcelaBoleto } from "./boletos";

// Parcela real (NF 2560144, pedido 2500001920), Itaú.
const parcela = (over: Partial<ParcelaBoleto> = {}): ParcelaBoleto => ({
  duplicata: 2560144, prestacao: "1", numnota: 2560144, valor: 3300.5, taxaBoleto: 3, somaTaxa: true,
  vencimento: "27/11/2026", emissao: "12/11/2026", nossoNumero: "01738613-4",
  linhaDigitavel: "34191.09016  73861.346317  84145.100008  2  16430000330350",
  codigoBarras: "34192164300003303501090173861346318414510000",
  vendedor: 718, pagoEm: "", txJuros: 12, percMulta: 2, agencia: "6318", conta: "414510",
  beneficiario: { nome: "DIA- DIST E IMPORTACAO  AFOGADOS LTDA", cnpj: "1", endereco: "R", bairro: "B", uf: "PE" },
  pagador: { codcli: 1, nome: "C", cnpj: "2", endereco: "E", numero: "10", bairro: "B", cidade: "RECIFE", uf: "PE", cep: "50000000" },
  ...over,
});

const hoje = new Date(2026, 10, 13);

describe("montarBoleto", () => {
  it("Itaú: banco, carteira, valor do código de barras e conta com dígito", () => {
    const b = montarBoleto(parcela(), hoje);
    expect(b.banco).toBe("341");
    expect(b.bancoDv).toBe("7");
    expect(b.carteira).toBe("109");
    expect(b.valorDocumento).toBe(3303.5); // inclui a taxa de R$ 3
    expect(b.taxaBoleto).toBe(3);
    expect(b.conta).toBe("41451-0");
    expect(b.numeroDocumento).toBe("2560144-1");
    expect(b.dataProcessamento).toBe("13/11/2026");
    expect(b.linhaDigitavel).toBe("34191.09016 73861.346317 84145.100008 2 16430000330350");
    expect(b.beneficiario.nome).toBe("DIA- DIST E IMPORTACAO AFOGADOS LTDA");
  });

  it("mora diária = valor × juros ao mês ÷ 30 (NF 2545688: 1.102,80 × 12% ÷ 30 = 4,41)", () => {
    expect(montarBoleto(parcela({ valor: 1102.8 }), hoje).moraDiaria).toBe(4.41);
  });

  it("Bradesco: carteira no campo livre e local de pagamento próprio", () => {
    // agência 1234, carteira 09, nosso número 11 dígitos, conta 7 dígitos, 0
    const barra = "2379" + "1" + "1643" + "0000014650" + "1234" + "09" + "12345678901" + "0012345" + "0";
    const b = montarBoleto(parcela({ codigoBarras: barra }), hoje);
    expect(barra).toHaveLength(44);
    expect(b.banco).toBe("237");
    expect(b.bancoDv).toBe("2");
    expect(b.carteira).toBe("09");
    expect(b.valorDocumento).toBe(146.5);
    expect(b.localPagamento).toContain("Bradesco");
  });

  it("sem taxa somada, a taxa não aparece", () => {
    expect(montarBoleto(parcela({ somaTaxa: false }), hoje).taxaBoleto).toBe(0);
  });
});

describe("contaComDigito", () => {
  it("põe o traço antes do último dígito e respeita o que já tem traço", () => {
    expect(contaComDigito("414510")).toBe("41451-0");
    expect(contaComDigito("41451-0")).toBe("41451-0");
    expect(contaComDigito("")).toBe("");
  });
});

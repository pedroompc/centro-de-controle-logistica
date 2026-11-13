import { describe, expect, it } from "vitest";
import { renderBoletosHtml } from "./html";
import { montarBoleto, type ParcelaBoleto } from "@/domain/boletos";

const parcela = (over: Partial<ParcelaBoleto> = {}): ParcelaBoleto => ({
  duplicata: 2560144, prestacao: "1", numnota: 2560144, valor: 3300.5, taxaBoleto: 3, somaTaxa: true,
  vencimento: "27/11/2026", emissao: "12/11/2026", nossoNumero: "01738613-4",
  linhaDigitavel: "34191.09016 73861.346317 84145.100008 2 16430000330350",
  codigoBarras: "34192164300003303501090173861346318414510000",
  vendedor: 718, pagoEm: "", txJuros: 12, percMulta: 2, agencia: "6318", conta: "414510",
  beneficiario: { nome: "DIA DIST", cnpj: "1", endereco: "R", bairro: "B", uf: "PE" },
  pagador: { codcli: 1, nome: "MERCADO <X> & CIA", cnpj: "2", endereco: "E", numero: "10", bairro: "B", cidade: "RECIFE", uf: "PE", cep: "50000000" },
  ...over,
});

const hoje = new Date(2026, 10, 13);

describe("renderBoletosHtml", () => {
  const html = renderBoletosHtml([
    montarBoleto(parcela(), hoje),
    montarBoleto(parcela({ prestacao: "2", pagoEm: "20/11/2026" }), hoje),
  ]);

  it("página completa, uma folha por parcela", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>Boletos-NF-2560144</title>");
    expect(html.match(/class="bol"/g)).toHaveLength(2);
    expect(html).toContain("2 parcelas");
  });

  it("traz valor, mora, conta e o código de barras ITF", () => {
    expect(html).toContain("3.303,50");
    expect(html).toContain("MORA DIÁRIA DE R$ 13,20");
    expect(html).toContain("6318 / 41451-0");
    expect(html).toContain("109 / 01738613-4");
    expect(html).toContain('<svg preserveAspectRatio="none"');
    expect(html).toContain("INCLUSO TAXA BANCÁRIA");
  });

  it("marca parcela paga e escapa texto do banco", () => {
    expect(html).toContain("PAGO EM 20/11/2026");
    expect(html).toContain("MERCADO &lt;X&gt; &amp; CIA");
    expect(html).not.toContain("MERCADO <X>");
  });
});

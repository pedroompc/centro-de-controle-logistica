// Boletos da NF de um pedido, no layout que o Winthor imprime (Itaú 341 e
// Bradesco 237). Regras portadas do app Flask do colega
// (app_cortes/Backend/app.py → api_pedidos_consulta_boletos).

/** Uma parcela do PCPREST com boleto, já com os campos do banco/cliente/filial. */
export interface ParcelaBoleto {
  duplicata: number | null;
  prestacao: string;
  numnota: number | null;
  valor: number;
  taxaBoleto: number; // PCPREST.VLTXBOLETO
  somaTaxa: boolean; // PCPREST.SOMATXBOLETO = 'S'
  vencimento: string; // dd/mm/aaaa
  emissao: string; // dd/mm/aaaa
  nossoNumero: string;
  linhaDigitavel: string;
  codigoBarras: string; // 44 dígitos
  vendedor: number | null; // CODUSUR
  pagoEm: string; // dd/mm/aaaa ou ""
  txJuros: number; // PCCOB.TXJUROS, % ao mês
  percMulta: number; // PCCOB.PERCMULTA
  agencia: string;
  conta: string; // PCBANCO.CONTA, sem traço no Itaú
  beneficiario: { nome: string; cnpj: string; endereco: string; bairro: string; uf: string };
  pagador: {
    codcli: number | null; nome: string; cnpj: string; endereco: string; numero: string;
    bairro: string; cidade: string; uf: string; cep: string;
  };
}

export interface Boleto {
  banco: string; // "341" | "237"
  bancoDv: string;
  nomeBanco: string;
  localPagamento: string;
  numeroDocumento: string; // "DUPLIC-PREST"
  numNf: number | null;
  vencimento: string;
  dataDocumento: string;
  dataProcessamento: string;
  valorDocumento: number;
  taxaBoleto: number;
  moraDiaria: number;
  percMulta: number;
  carteira: string;
  nossoNumero: string;
  agencia: string;
  conta: string;
  linhaDigitavel: string;
  codigoBarras: string;
  vendedor: number | null;
  pagoEm: string;
  beneficiario: ParcelaBoleto["beneficiario"];
  pagador: ParcelaBoleto["pagador"];
}

const r2 = (n: number): number => Math.round(n * 100) / 100;

/** PCBANCO grava a conta do Itaú sem traço ("414510"); o boleto imprime "41451-0". */
export function contaComDigito(conta: string): string {
  const c = conta.trim();
  if (!c || c.includes("-")) return c;
  return `${c.slice(0, -1)}-${c.slice(-1)}`;
}

/** dd/mm/aaaa da data local. */
export function dataBR(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/**
 * Monta o boleto de uma parcela. O banco, a carteira e o valor do documento
 * saem do próprio código de barras:
 * - posições 1–3: banco; 10–19: valor (já inclui a taxa do boleto);
 * - Itaú, campo livre = carteira(3) nosso número(8) DAC agência(4) conta(5) DAC 000;
 * - Bradesco, campo livre = agência(4) carteira(2) nosso número(11) conta(7) 0.
 * Mora diária = VALOR × TXJUROS (% ao mês) ÷ 30, como o Winthor imprime.
 */
export function montarBoleto(p: ParcelaBoleto, hoje: Date): Boleto {
  const barra = p.codigoBarras;
  const banco = barra.slice(0, 3);
  const itau = banco === "341";
  const taxa = p.somaTaxa ? p.taxaBoleto : 0;
  const valorBarra = Number(barra.slice(9, 19)) / 100;
  return {
    banco,
    bancoDv: itau ? "7" : "2",
    nomeBanco: itau ? "Banco Itaú S.A." : "Banco Bradesco S.A.",
    localPagamento: itau
      ? "Até o vencimento, preferencialmente no Itaú e Após o vencimento, somente no Itaú"
      : "Pagável preferencialmente na Rede Bradesco ou Bradesco Expresso",
    numeroDocumento: `${p.duplicata ?? ""}-${p.prestacao}`,
    numNf: p.duplicata ?? p.numnota,
    vencimento: p.vencimento,
    dataDocumento: p.emissao,
    dataProcessamento: dataBR(hoje),
    valorDocumento: r2(valorBarra || p.valor + taxa),
    taxaBoleto: r2(taxa),
    moraDiaria: r2((p.valor * p.txJuros) / 100 / 30),
    percMulta: p.percMulta,
    carteira: itau ? barra.slice(19, 22) : barra.slice(23, 25),
    nossoNumero: p.nossoNumero,
    agencia: p.agencia.trim(),
    conta: contaComDigito(p.conta),
    linhaDigitavel: p.linhaDigitavel.split(/\s+/).filter(Boolean).join(" "),
    codigoBarras: barra,
    vendedor: p.vendedor,
    pagoEm: p.pagoEm,
    beneficiario: { ...p.beneficiario, nome: p.beneficiario.nome.split(/\s+/).filter(Boolean).join(" ") },
    pagador: p.pagador,
  };
}

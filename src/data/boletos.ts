import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import type { ParcelaBoleto } from "@/domain/boletos";

// Boletos da NF do pedido: parcelas do PCPREST cuja cobrança gera boleto
// (PCCOB.BOLETO = 'S' — fica de fora o que já virou DEVT/DEVP/CANC/DESD/ESTR) e
// têm código de barras. Agência/conta do beneficiário vêm do PCBANCO do banco do
// código de barras (341 Itaú, 237 Bradesco). Datas saem como texto para não
// sofrer conversão de fuso no driver.
// Consulta portada do app Flask (app_cortes/Backend/sql_queries.py → QUERY_PEDIDO_BOLETOS).
const sql = `SELECT p.DUPLIC, p.PREST, p.VALOR, NVL(p.VLTXBOLETO, 0) AS VLTXBOLETO, p.SOMATXBOLETO,
       TO_CHAR(p.DTVENC, 'DD/MM/YYYY') AS DTVENC, TO_CHAR(p.DTEMISSAO, 'DD/MM/YYYY') AS DTEMISSAO,
       TO_CHAR(p.DTPAG, 'DD/MM/YYYY') AS DTPAG,
       p.NOSSONUMBCO, p.LINHADIG, p.CODBARRA, p.CODUSUR,
       NVL(cb.TXJUROS, 0) AS TXJUROS, NVL(cb.PERCMULTA, 0) AS PERCMULTA,
       b.AGENCIA, b.CONTA,
       s.NUMNOTA, s.CODCLI,
       cli.CLIENTE, cli.CGCENT,
       NVL(cli.ENDERCOB, cli.ENDERENT) AS ENDERECO_CLI, NVL(cli.NUMEROCOB, cli.NUMEROENT) AS NUMERO_CLI,
       NVL(cli.BAIRROCOB, cli.BAIRROENT) AS BAIRRO_CLI, NVL(cli.MUNICCOB, cli.MUNICENT) AS CIDADE_CLI,
       NVL(cli.ESTCOB, cli.ESTENT) AS UF_CLI, NVL(cli.CEPCOB, cli.CEPENT) AS CEP_CLI,
       f.RAZAOSOCIAL, f.CGC AS CNPJ_FILIAL, f.ENDERECO AS ENDERECO_FILIAL, f.BAIRRO AS BAIRRO_FILIAL, f.UF AS UF_FILIAL
FROM PCNFSAID s
JOIN PCPREST p ON p.NUMTRANSVENDA = s.NUMTRANSVENDA
JOIN PCCOB cb ON cb.CODCOB = p.CODCOB AND cb.BOLETO = 'S'
LEFT JOIN PCBANCO b ON b.CODBANCO = TO_NUMBER(SUBSTR(p.CODBARRA, 1, 3))
LEFT JOIN PCCLIENT cli ON cli.CODCLI = s.CODCLI
LEFT JOIN PCFILIAL f ON f.CODIGO = p.CODFILIAL
WHERE ${filialIn("s.CODFILIAL")} AND s.NUMPED = :numped AND s.DTCANCEL IS NULL
  AND p.CODBARRA IS NOT NULL AND LENGTH(p.CODBARRA) = 44
ORDER BY s.NUMNOTA, p.PREST`;

interface Row {
  DUPLIC: number | null; PREST: string | number | null; VALOR: number | null;
  VLTXBOLETO: number | null; SOMATXBOLETO: string | null;
  DTVENC: string | null; DTEMISSAO: string | null; DTPAG: string | null;
  NOSSONUMBCO: string | null; LINHADIG: string | null; CODBARRA: string; CODUSUR: number | null;
  TXJUROS: number | null; PERCMULTA: number | null;
  AGENCIA: string | number | null; CONTA: string | number | null;
  NUMNOTA: number | null; CODCLI: number | null;
  CLIENTE: string | null; CGCENT: string | null;
  ENDERECO_CLI: string | null; NUMERO_CLI: string | null; BAIRRO_CLI: string | null;
  CIDADE_CLI: string | null; UF_CLI: string | null; CEP_CLI: string | null;
  RAZAOSOCIAL: string | null; CNPJ_FILIAL: string | null; ENDERECO_FILIAL: string | null;
  BAIRRO_FILIAL: string | null; UF_FILIAL: string | null;
}

const txt = (v: unknown): string => (v == null ? "" : String(v).trim());
const numOuNull = (v: unknown): number | null => (v == null ? null : Number(v));

/** Parcelas com boleto da NF do pedido (filiais 1 e 11). `[]` se não houver. */
export async function getParcelasBoleto(numped: number): Promise<ParcelaBoleto[]> {
  const rows = await queryWinthor<Row>(sql, { numped });
  return rows.map((r) => ({
    duplicata: numOuNull(r.DUPLIC),
    prestacao: txt(r.PREST),
    numnota: numOuNull(r.NUMNOTA),
    valor: Number(r.VALOR) || 0,
    taxaBoleto: Number(r.VLTXBOLETO) || 0,
    somaTaxa: txt(r.SOMATXBOLETO) === "S",
    vencimento: txt(r.DTVENC),
    emissao: txt(r.DTEMISSAO),
    nossoNumero: txt(r.NOSSONUMBCO),
    linhaDigitavel: txt(r.LINHADIG),
    codigoBarras: txt(r.CODBARRA),
    vendedor: numOuNull(r.CODUSUR),
    pagoEm: txt(r.DTPAG),
    txJuros: Number(r.TXJUROS) || 0,
    percMulta: Number(r.PERCMULTA) || 0,
    agencia: txt(r.AGENCIA),
    conta: txt(r.CONTA),
    beneficiario: {
      nome: txt(r.RAZAOSOCIAL), cnpj: txt(r.CNPJ_FILIAL), endereco: txt(r.ENDERECO_FILIAL),
      bairro: txt(r.BAIRRO_FILIAL), uf: txt(r.UF_FILIAL),
    },
    pagador: {
      codcli: numOuNull(r.CODCLI), nome: txt(r.CLIENTE), cnpj: txt(r.CGCENT),
      endereco: txt(r.ENDERECO_CLI), numero: txt(r.NUMERO_CLI), bairro: txt(r.BAIRRO_CLI),
      cidade: txt(r.CIDADE_CLI), uf: txt(r.UF_CLI), cep: txt(r.CEP_CLI),
    },
  }));
}

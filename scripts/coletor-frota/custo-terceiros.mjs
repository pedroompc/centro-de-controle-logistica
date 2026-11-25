// Custo dos terceirizados no custo logístico: linhas automáticas por mês em
// custos_mensais, lidas do contas a pagar do Winthor (PCLANC), pela DATA DO
// LANÇAMENTO (decisão do Pedro, 25/11/2026):
//
//   Terceiros · Agregados           conta 13 (PRESTAÇÃO DE SERVIÇO) de todo
//                                   fornecedor que já recebeu como agregado. O
//                                   pagamento é semanal (rotina 749) e nem todo
//                                   lote diz "agregado" no histórico (ex.:
//                                   "TRANSPORTE DE MERCADORIAS"), por isso vai
//                                   pelo fornecedor e não pelo texto.
//   Terceiros · Chapa e descarrego  qualquer lançamento com "chapa"/"descarrego"/
//                                   "descarga" no histórico (despesa da carga,
//                                   rotina 631; serviço de descarga da T&A),
//                                   menos a conta 402008, que é a RECEITA de
//                                   descarga cobrada do fornecedor.
//
// Filiais 1 e 11. Lançamento cancelado fica fora; estorno (valor negativo) abate.
// Todo ciclo recalcula desde julho/2026: lançamento atrasado no Winthor corrige
// o mês dele sozinho.

export const PREFIXO_TERCEIROS = "Terceiros · ";
export const LINHA_AGREGADOS = `${PREFIXO_TERCEIROS}Agregados`;
export const LINHA_CHAPA = `${PREFIXO_TERCEIROS}Chapa e descarrego`;

const FILIAIS = "('1', '11')";
const TEXTO_CHAPA = `(UPPER(l.HISTORICO) LIKE '%CHAPA%' OR UPPER(l.HISTORICO) LIKE '%DESCARREG%' OR UPPER(l.HISTORICO) LIKE '%DESCARGA%')`;

export const SQL_TERCEIROS = `
WITH agregados AS (
  SELECT DISTINCT a.CODFORNEC FROM PCLANC a
  WHERE a.CODFILIAL IN ${FILIAIS} AND a.CODCONTA = 13 AND a.DTCANCEL IS NULL
    AND a.DTLANC >= DATE '2025-01-01' AND UPPER(a.HISTORICO) LIKE '%AGREG%'
),
base AS (
  SELECT l.DTLANC, l.VALOR,
         CASE WHEN l.CODCONTA = 13 AND ag.CODFORNEC IS NOT NULL THEN 'agregados'
              WHEN ${TEXTO_CHAPA} THEN 'chapa' END LINHA
  FROM PCLANC l
  LEFT JOIN agregados ag ON ag.CODFORNEC = l.CODFORNEC
  WHERE l.CODFILIAL IN ${FILIAIS} AND l.DTCANCEL IS NULL
    AND l.DTLANC >= TO_DATE(:desde, 'YYYY-MM-DD')
    AND l.CODCONTA != 402008
    AND ((l.CODCONTA = 13 AND ag.CODFORNEC IS NOT NULL) OR ${TEXTO_CHAPA})
)
SELECT TO_CHAR(TRUNC(DTLANC, 'MM'), 'YYYY-MM-DD') MES, LINHA, SUM(VALOR) VALOR
FROM base GROUP BY TRUNC(DTLANC, 'MM'), LINHA ORDER BY 1, 2`;

const centavos = (v) => Math.round(v * 100) / 100;

/**
 * Linhas por mês a partir do resultado do SQL. Todo mês de `meses` sai com as
 * duas linhas (zero quando não teve lançamento), para a linha antiga sumir se o
 * lançamento for cancelado no Winthor.
 * @returns Map mes → [{nome, tipo, valor}]
 */
export function linhasCustoTerceiros(rows, meses) {
  const soma = new Map();
  for (const r of rows) {
    const k = `${String(r.MES).slice(0, 10)}|${r.LINHA}`;
    soma.set(k, (soma.get(k) ?? 0) + Number(r.VALOR || 0));
  }
  return new Map(
    meses.map((mes) => [
      mes,
      [
        { nome: LINHA_AGREGADOS, tipo: "variavel", valor: centavos(soma.get(`${mes}|agregados`) ?? 0) },
        { nome: LINHA_CHAPA, tipo: "variavel", valor: centavos(soma.get(`${mes}|chapa`) ?? 0) },
      ],
    ]),
  );
}

/** Meses "aaaa-mm-01" de `desde` até o mês de `hoje` (fuso de Recife). */
export function mesesDesde(desde, hoje) {
  const [aH, mH] = hoje.toLocaleDateString("sv-SE", { timeZone: "America/Recife" }).split("-").map(Number);
  let [a, m] = desde.split("-").map(Number);
  const out = [];
  while (a * 12 + m <= aH * 12 + mH) {
    out.push(`${a}-${String(m).padStart(2, "0")}-01`);
    if (++m > 12) { m = 1; a++; }
  }
  return out;
}

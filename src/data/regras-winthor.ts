// Regras de negócio do Winthor usadas em mais de uma consulta — um lugar só,
// para dois números que deveriam bater nunca divergirem por uma cópia esquecida.
//
// Duas noções de "nota" convivem DE PROPÓSITO (medido em out/2026, filiais 1 e 11):
// - nota de VENDA (TIPOVENDA VP/VV): o faturamento, o que bate com a rotina 111;
// - nota EXPEDIDA (CONDVENDA fora de bonificação/brinde/transferência): o
//   trabalho do caminhão — inclui as SR (simples remessa, 71 notas em carga no
//   mês) que a entrega leva mas não são venda. Devolução por motorista e BI
//   Motoristas usam esta.

/** Condições de venda que não são entrega de venda (bonificação, brinde, transferência…). */
export const CONDVENDA_FORA_DA_ENTREGA = [4, 8, 10, 13, 20, 98, 99] as const;

/** Pseudo-motorista DIALOG (balcão): não é viagem de entrega. */
export const MOTORISTA_DIALOG = 9996;

/** Nota de VENDA não cancelada (base do faturamento / 111). `a` = alias de PCNFSAID. */
export const notaDeVenda = (a: string) => `${a}.TIPOVENDA IN ('VP', 'VV') AND ${a}.DTCANCEL IS NULL`;

/** Nota EXPEDIDA não cancelada (base das entregas e da devolução por motorista). `a` = alias de PCNFSAID. */
export const notaExpedida = (a: string) =>
  `NVL(${a}.CONDVENDA, 0) NOT IN (${CONDVENDA_FORA_DA_ENTREGA.join(",")}) AND ${a}.DTCANCEL IS NULL`;

/** Motorista de verdade na carga: preenchido e não o DIALOG. `col` = coluna do código do motorista. */
export const motoristaDeEntrega = (col: string) => `NVL(${col}, 0) NOT IN (0, ${MOTORISTA_DIALOG})`;

// Dia de ENTREGA da nota (BI Motoristas; regra do Pedro, 25/11/2026): o que é
// faturado das 19:00 às 08:30 do dia seguinte sai para entrega nesse dia
// seguinte. Ex.: faturada quarta 19:30 ou quinta 07:00 → entrega de quinta.
// Antes das 19:00 a nota é entrega do próprio dia. Hora = HORALANC/MINUTOLANC
// (lançamento da nota no Winthor, 100% preenchido; DTSAIDA só tem a data).
export const CORTE_ENTREGA_HHMM = 1900;

const hhmm = (a: string) =>
  `CASE WHEN REGEXP_LIKE(${a}.HORALANC, '^[0-9]+$') THEN TO_NUMBER(${a}.HORALANC) * 100 ELSE 0 END` +
  ` + CASE WHEN REGEXP_LIKE(${a}.MINUTOLANC, '^[0-9]+$') THEN TO_NUMBER(${a}.MINUTOLANC) ELSE 0 END`;

/** Dia de entrega (DATE) da nota. `a` = alias de PCNFSAID. */
export const diaEntrega = (a: string) => `(TRUNC(${a}.DTSAIDA) + CASE WHEN ${hhmm(a)} >= ${CORTE_ENTREGA_HHMM} THEN 1 ELSE 0 END)`;

/** Notas cujo dia de ENTREGA cai em [:ini, :fim] (pega a noite da véspera de :ini). */
export const faixaEntrega = (a: string) =>
  `${a}.DTSAIDA >= TO_DATE(:ini, 'YYYY-MM-DD') - 1 AND ${a}.DTSAIDA < TO_DATE(:fim, 'YYYY-MM-DD') + 1` +
  ` AND ${diaEntrega(a)} BETWEEN TO_DATE(:ini, 'YYYY-MM-DD') AND TO_DATE(:fim, 'YYYY-MM-DD')`;

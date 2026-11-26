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

// Dia de ENTREGA da nota (BI Motoristas): o que é faturado a partir das 16:00
// sai para entrega no dia seguinte. Ex.: faturada quarta 18:00 ou quinta 05:00
// → entrega de quinta. Antes das 16:00 a nota é entrega do próprio dia.
// Hora = HORALANC/MINUTOLANC (lançamento da nota no Winthor, 100% preenchido;
// DTSAIDA só tem a data). Corte era 19:00 (Pedro, 25/11/2026); foi para 16:00 em
// 26/11 por conferência cega com a planilha de montagem (ENT = clientes
// distintos por caminhão): o faturamento da montagem do dia seguinte começa por
// volta das 18h, e o vão entre um dia e outro fica entre 15h e 16h (out–nov/2026).
// Em 25/11 as 4 placas onde 16h e 19h discordavam bateram com o corte das 16h.
export const CORTE_ENTREGA_HHMM = 1600;

const hhmm = (a: string) =>
  `CASE WHEN REGEXP_LIKE(${a}.HORALANC, '^[0-9]+$') THEN TO_NUMBER(${a}.HORALANC) * 100 ELSE 0 END` +
  ` + CASE WHEN REGEXP_LIKE(${a}.MINUTOLANC, '^[0-9]+$') THEN TO_NUMBER(${a}.MINUTOLANC) ELSE 0 END`;

/** Dia de entrega (DATE) da nota. `a` = alias de PCNFSAID. */
export const diaEntrega = (a: string) => `(TRUNC(${a}.DTSAIDA) + CASE WHEN ${hhmm(a)} >= ${CORTE_ENTREGA_HHMM} THEN 1 ELSE 0 END)`;

/** Notas cujo dia de ENTREGA cai em [:ini, :fim] (pega a noite da véspera de :ini). */
export const faixaEntrega = (a: string) =>
  `${a}.DTSAIDA >= TO_DATE(:ini, 'YYYY-MM-DD') - 1 AND ${a}.DTSAIDA < TO_DATE(:fim, 'YYYY-MM-DD') + 1` +
  ` AND ${diaEntrega(a)} BETWEEN TO_DATE(:ini, 'YYYY-MM-DD') AND TO_DATE(:fim, 'YYYY-MM-DD')`;

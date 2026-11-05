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

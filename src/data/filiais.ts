// Escopo de filiais do dashboard. A rotina 111 do diretor consolida as filiais
// 1 e 11 numa única visão — todas as queries do Winthor e o snapshot mensal
// usam esta lista como fonte única.
export const FILIAIS = ["1", "11"] as const;

// Rótulo usado como chave do snapshot mensal (coluna `filial` de
// faturamento_mensal). Distingue as fotos consolidadas (1+11) das antigas,
// gravadas só com a filial "1".
export const FILIAL_LABEL = FILIAIS.join("+"); // "1+11"

// Fragmento SQL `col IN ('1', '11')`. FILIAIS é constante do sistema (nunca vem
// do usuário), então inlinar é seguro e evita um bind por filial.
export const filialIn = (col: string): string =>
  `${col} IN (${FILIAIS.map((f) => `'${f}'`).join(", ")})`;

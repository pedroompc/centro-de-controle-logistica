import type { ReceitaCategoria } from "./types";

/** Ordem canônica das categorias — usada em selects e quebras. */
export const CATEGORIAS_RECEITA = [
  "reciclagem",
] as const satisfies readonly ReceitaCategoria[];

/**
 * Rótulos de exibição. `Record` sobre o union: ao adicionar uma categoria nova,
 * o TypeScript aponta este objeto e todos os outros que mapeiam o union completo.
 */
export const ROTULO_CATEGORIA: Record<ReceitaCategoria, string> = {
  reciclagem: "Reciclagem",
};

/** Sugestões do datalist de material. Não é cadastro — só atalho de digitação. */
export const MATERIAIS_SUGERIDOS = [
  "Plástico stretch",
  "Papelão",
  "Pallet quebrado",
];

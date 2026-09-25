import type { DescarregamentoTipo } from "./types";

/** Ordem canônica dos tipos — usada em selects, barras e na tabela de preços. */
export const TIPOS_DESCARREGAMENTO = [
  "batido",
  "paletizado",
  "pal_rem",
  "volume",
] as const satisfies readonly DescarregamentoTipo[];

/**
 * Tipos que são CARRO (veículo/viagem): batido, paletizado e pal-rem.
 * "volume" NÃO entra aqui — ele é contado em CAIXAS, não em carros. Somar volume
 * ao total de carros inflava a contagem (uma descarga por volume pode ter
 * milhares de caixas). Nas análises, carros = soma destes três; volume vai à
 * parte como caixas.
 */
export const TIPOS_CARRO = [
  "batido",
  "paletizado",
  "pal_rem",
] as const satisfies readonly DescarregamentoTipo[];

/**
 * Rótulos de exibição. `Record` sobre o union: ao adicionar um tipo novo, o
 * TypeScript aponta este objeto e todos os outros que mapeiam o union completo.
 */
export const ROTULO_TIPO: Record<DescarregamentoTipo, string> = {
  batido: "Batido",
  paletizado: "Paletizado",
  pal_rem: "Pal/Rem",
  volume: "Volume",
};

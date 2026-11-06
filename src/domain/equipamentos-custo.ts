import type { Equipamento } from "./types";

/** Prefixo que marca, em custos_mensais, as linhas que saem do cadastro de equipamentos. */
export const PREFIXO_EQUIPAMENTO = "Equipamento · ";

export const ehLinhaDeEquipamento = (nome: string) => nome.startsWith(PREFIXO_EQUIPAMENTO);

/**
 * Fixos de equipamento de um mês: uma linha por equipamento do cadastro
 * (quantidade × custo unitário), com o setor no nome. Fonte única — os mesmos
 * valores que os BIs e a tela de Setores usam.
 */
export function linhasDeEquipamento(equipamentos: Equipamento[]): { nome: string; valor: number }[] {
  return equipamentos
    .filter((e) => e.quantidade > 0 && e.custoUnitario > 0)
    .map((e) => ({
      nome: `${PREFIXO_EQUIPAMENTO}${e.nome} (${e.setor}${e.quantidade > 1 ? ` · ${e.quantidade} un` : ""})`,
      valor: Math.round(e.quantidade * e.custoUnitario * 100) / 100,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

import type { Equipamento } from "./types";

/** Prefixo que marca, em custos_mensais, as linhas que saem do cadastro de equipamentos. */
export const PREFIXO_EQUIPAMENTO = "Equipamento · ";

export const ehLinhaDeEquipamento = (nome: string) => nome.startsWith(PREFIXO_EQUIPAMENTO);

/**
 * Fixos de equipamento de um mês: UMA linha por equipamento com a quantidade
 * geral da empresa (soma dos setores) — onde cada um está fica só no cadastro,
 * que é o que os BIs e a tela de Setores usam para o custo de cada setor.
 */
export function linhasDeEquipamento(equipamentos: Equipamento[]): { nome: string; valor: number }[] {
  const porNome = new Map<string, { quantidade: number; valor: number }>();
  for (const e of equipamentos) {
    if (e.quantidade <= 0 || e.custoUnitario <= 0) continue;
    const t = porNome.get(e.nome) ?? { quantidade: 0, valor: 0 };
    t.quantidade += e.quantidade;
    t.valor += e.quantidade * e.custoUnitario;
    porNome.set(e.nome, t);
  }
  return [...porNome.entries()]
    .map(([nome, t]) => ({
      nome: `${PREFIXO_EQUIPAMENTO}${nome}${t.quantidade > 1 ? ` (${t.quantidade} un)` : ""}`,
      valor: Math.round(t.valor * 100) / 100,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

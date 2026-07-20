import type { Receita, DescarregamentoTipo } from "./types";
import { TIPOS_DESCARREGAMENTO } from "./descarregamento";

/** Arredonda a 2 casas (centavos), estável para somas de dinheiro. */
export function arredonda2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toneladas(pesoKg: number): number {
  return pesoKg / 1000;
}

/**
 * Receita de um descarregamento = toneladas × preço/ton, respeitando o valor
 * mínimo cobrado por descarrego. O mínimo é piso, nunca teto; ambos os ramos
 * (cálculo ou mínimo) são arredondados a 2 casas (centavos).
 * Default `0` preserva o cálculo puro para quem não passa o mínimo (prévias e testes).
 */
export function calcularReceita(
  pesoKg: number,
  precoPorTonelada: number,
  valorMinimo = 0,
): number {
  return arredonda2(Math.max(arredonda2(toneladas(pesoKg) * precoPorTonelada), valorMinimo));
}

export function receitaTotal(rs: Receita[]): number {
  return arredonda2(rs.reduce((t, r) => t + r.receita, 0));
}

export function toneladasTotal(rs: Receita[]): number {
  return arredonda2(rs.reduce((t, r) => t + toneladas(r.pesoKg), 0));
}

export function valorMedioPorTonelada(rs: Receita[]): number {
  const tons = toneladasTotal(rs);
  return tons === 0 ? 0 : arredonda2(receitaTotal(rs) / tons);
}

export function receitaPorFornecedor(rs: Receita[]): { fornecedorId: string; nome: string; valor: number }[] {
  const mapa = new Map<string, { fornecedorId: string; nome: string; valor: number }>();
  for (const r of rs) {
    const atual = mapa.get(r.fornecedorId) ?? { fornecedorId: r.fornecedorId, nome: r.fornecedorNome, valor: 0 };
    atual.valor = arredonda2(atual.valor + r.receita);
    mapa.set(r.fornecedorId, atual);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

export function receitaPorTipo(rs: Receita[]): Record<DescarregamentoTipo, number> {
  const acc = Object.fromEntries(
    TIPOS_DESCARREGAMENTO.map((t) => [t, 0]),
  ) as Record<DescarregamentoTipo, number>;
  for (const r of rs) acc[r.tipo] = arredonda2(acc[r.tipo] + r.receita);
  return acc;
}

/** Custo logístico líquido = custos brutos − receitas (só demonstração; não altera custos). */
export function custoLiquido(custosBrutos: number, receitas: number): number {
  return arredonda2(custosBrutos - receitas);
}

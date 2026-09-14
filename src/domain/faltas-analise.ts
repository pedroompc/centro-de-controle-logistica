import type { Funcionario, Falta, TipoFalta } from "./types";

/**
 * Tipos que contam como AUSÊNCIA de verdade num ranking de faltas.
 *
 * `folga` e `ferias` são ausências PLANEJADAS — não penalizam o funcionário e,
 * se entrassem na conta, quem tirou férias lideraria o ranking. Ficam de fora
 * do `total`, mas continuam visíveis no detalhe do mês (para explicar o número
 * do card, que hoje soma tudo) e no `porTipo` de cada linha do ranking.
 */
export const TIPOS_AUSENCIA_REAL: readonly TipoFalta[] = [
  "injustificada",
  "justificada",
  "atestado",
];

const ZERO_POR_TIPO = (): Record<TipoFalta, number> => ({
  justificada: 0,
  injustificada: 0,
  atestado: 0,
  folga: 0,
  ferias: 0,
});

export interface FaltaDetalhe {
  id: string;
  funcionarioId: string;
  funcionarioNome: string;
  setorId: string;
  data: string;
  tipo: TipoFalta;
  observacao: string | null;
}

/**
 * Faltas de um período com o funcionário resolvido, mais recentes primeiro.
 * Inclui TODOS os tipos — é o que explica o "Faltas no mês" do dashboard.
 * Faltas de funcionários que não existem mais são descartadas.
 */
export function detalharFaltasDoPeriodo(
  faltas: Falta[],
  funcionarios: Funcionario[],
  inicio: string,
  fim: string,
): FaltaDetalhe[] {
  const porId = new Map(funcionarios.map((f) => [f.id, f]));
  return faltas
    .filter((falta) => porId.has(falta.funcionarioId) && falta.data >= inicio && falta.data <= fim)
    .map((falta) => {
      const func = porId.get(falta.funcionarioId)!;
      return {
        id: falta.id,
        funcionarioId: falta.funcionarioId,
        funcionarioNome: func.nome,
        setorId: func.setorId,
        data: falta.data,
        tipo: falta.tipo,
        observacao: falta.observacao,
      };
    })
    .sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.funcionarioNome.localeCompare(b.funcionarioNome)));
}

export interface RankingFaltaItem {
  funcionarioId: string;
  nome: string;
  setorId: string;
  /** Ausências reais (injustificada + justificada + atestado). Métrica do ranking. */
  total: number;
  /** Contagem por tipo, incluindo folga/férias, para exibir o detalhamento. */
  porTipo: Record<TipoFalta, number>;
}

/**
 * Ranking de faltas de TODOS os períodos, por funcionário. Ordena por ausências
 * reais (desc); empate desfeito por mais injustificadas e depois nome (asc).
 * Funcionários sem nenhuma ausência real ficam de fora.
 */
export function rankingFaltas(
  faltas: Falta[],
  funcionarios: Funcionario[],
): RankingFaltaItem[] {
  const porId = new Map(funcionarios.map((f) => [f.id, f]));
  const acc = new Map<string, RankingFaltaItem>();

  for (const falta of faltas) {
    const func = porId.get(falta.funcionarioId);
    if (!func) continue;
    let item = acc.get(func.id);
    if (!item) {
      item = { funcionarioId: func.id, nome: func.nome, setorId: func.setorId, total: 0, porTipo: ZERO_POR_TIPO() };
      acc.set(func.id, item);
    }
    item.porTipo[falta.tipo] += 1;
    if (TIPOS_AUSENCIA_REAL.includes(falta.tipo)) item.total += 1;
  }

  return [...acc.values()]
    .filter((i) => i.total > 0)
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.porTipo.injustificada - a.porTipo.injustificada ||
        a.nome.localeCompare(b.nome),
    );
}

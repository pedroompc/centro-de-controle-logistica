// Conferência cruzada: pares de números que DEVEM bater entre duas telas (ou
// entre a foto e o ao vivo). Se divergirem, alguma regra ou foto ficou para trás.
// Só entram pares que batem por construção — medido no Oracle antes de entrar.

export type UnidadeConferencia = "R$" | "notas";

export interface ParConferencia {
  chave: string; // estável, p/ rastrear no tempo: "devolucao-view·2026-10-01"
  nome: string;
  mes: string; // "yyyy-mm-01"
  unidade: UnidadeConferencia;
  tolerancia: number; // diferença absoluta aceita
  a: { fonte: string; valor: number | null };
  b: { fonte: string; valor: number | null };
}

export interface ResultadoPar extends ParConferencia {
  diferenca: number | null; // a − b; null = um dos lados não respondeu
  ok: boolean | null; // null = não deu para conferir
}

export interface Conferencia {
  em: string; // ISO do fim da rodada
  ok: boolean; // nenhum par divergente (par não conferido não reprova)
  pares: ResultadoPar[];
}

export function avaliarPar(p: ParConferencia): ResultadoPar {
  if (p.a.valor === null || p.b.valor === null) return { ...p, diferenca: null, ok: null };
  const diferenca = Math.round((p.a.valor - p.b.valor) * 100) / 100;
  return { ...p, diferenca, ok: Math.abs(diferenca) <= p.tolerancia };
}

export function fecharConferencia(pares: ParConferencia[], em: Date = new Date()): Conferencia {
  const res = pares.map(avaliarPar);
  return { em: em.toISOString(), ok: res.every((r) => r.ok !== false), pares: res };
}

/**
 * Versão para a rota pública (/api/saude): só QUAIS pares divergiram e quantos
 * não deu para conferir — nenhum valor em R$.
 */
export function resumoPublico(c: Conferencia | null) {
  if (!c) return null;
  return {
    em: c.em,
    ok: c.ok,
    pares: c.pares.length,
    divergentes: c.pares.filter((p) => p.ok === false).map((p) => p.chave),
    naoConferidos: c.pares.filter((p) => p.ok === null).length,
  };
}

/** Próxima rodada diária às `hora` (horário de Recife, UTC−3, sem horário de verão). */
export function proximaRodada(agora: Date, hora = 6): Date {
  const RECIFE = -3 * 60;
  const local = new Date(agora.getTime() + RECIFE * 60_000);
  const alvo = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hora) - RECIFE * 60_000;
  return new Date(alvo > agora.getTime() ? alvo : alvo + 24 * 3_600_000);
}

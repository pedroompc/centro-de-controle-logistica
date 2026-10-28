import { primeiroDiaDoMes } from "@/domain/periodo";

// Cache em memória do processo (o app roda num servidor só, 24/7). Usado só
// nas leituras pesadas dos BIs dos setores — Dashboard e Painel TV ficam ao vivo.
type Entrada = { expira: number; promessa: Promise<unknown> };
const g = globalThis as { __cacheMemoria?: Map<string, Entrada> };
const mapa = () => (g.__cacheMemoria ??= new Map());

const MIN = 60_000;

/**
 * Devolve o resultado de `f` guardado por `ttlMs`. Chamadas simultâneas com a
 * mesma chave esperam a mesma busca; erro não fica guardado.
 */
export function lembrar<T>(chave: string, ttlMs: number, f: () => Promise<T>): Promise<T> {
  const agora = Date.now();
  const atual = mapa().get(chave);
  if (atual && atual.expira > agora) return atual.promessa as Promise<T>;

  const promessa = f();
  const entrada = { expira: agora + ttlMs, promessa };
  mapa().set(chave, entrada);
  promessa.catch(() => {
    if (mapa().get(chave) === entrada) mapa().delete(chave);
  });
  return promessa;
}

/** Mês corrente muda o tempo todo (5 min); mês fechado quase nunca (60 min). */
export function ttlDoMes(mes: string, agora: Date = new Date()): number {
  return mes >= primeiroDiaDoMes(agora) ? 5 * MIN : 60 * MIN;
}

export function limparCache(): void {
  mapa().clear();
}

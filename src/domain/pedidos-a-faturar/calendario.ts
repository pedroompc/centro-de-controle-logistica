import type { IndiceCalendario, Rota } from "./tipos";

/** Tira acento, sobe caixa e colapsa espaços — espelha _normalizar do Python. */
export function normalizarCidade(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove marcas de acento (combining diacriticals)
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

/** Monta um índice O(1) por nome normalizado (cidade + aliases). */
export function criarIndiceCalendario(rotas: Rota[]): IndiceCalendario {
  const mapa = new Map<string, Rota>();
  for (const r of rotas) {
    mapa.set(normalizarCidade(r.cidade), r);
    for (const alias of r.aliases) {
      const chave = normalizarCidade(alias);
      if (!mapa.has(chave)) mapa.set(chave, r);
    }
  }
  return {
    buscar(cidade: string | null): Rota | null {
      if (!cidade || !cidade.trim()) return null;
      return mapa.get(normalizarCidade(cidade)) ?? null;
    },
  };
}

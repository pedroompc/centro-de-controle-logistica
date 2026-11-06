// Parâmetros de período na URL (mes / de / ate) — compartilhado por servidor e
// cliente (menu lateral, barra mobile, seletor).

export const CHAVES_PERIODO = ["mes", "de", "ate"] as const;

/** Telas que entendem o período. Ao navegar entre elas o período é preservado. */
export const COM_PERIODO = new Set(["/", "/custos", "/receitas", "/devolucoes", "/cortes", "/faltas", "/fechamento", "/tendencias"]);

type Fonte = URLSearchParams | Record<string, string | undefined | null>;

// Duck typing: o ReadonlyURLSearchParams do Next nem sempre passa no instanceof.
const ehParams = (sp: Fonte): sp is URLSearchParams => typeof (sp as URLSearchParams).get === "function";
const ler = (sp: Fonte, k: string) => (ehParams(sp) ? sp.get(k) : sp[k]) ?? null;

/** Só os parâmetros de período da fonte (de/ate vence mes). */
export function paramsPeriodoDe(sp: Fonte): Record<string, string> {
  const de = ler(sp, "de");
  if (de) {
    const ate = ler(sp, "ate");
    return ate ? { de, ate } : { de };
  }
  const mes = ler(sp, "mes");
  return mes ? { mes } : {};
}

/** Link de menu preservando o período quando a tela de destino entende. */
export function comPeriodo(href: string, sp: Fonte): string {
  if (!COM_PERIODO.has(href)) return href;
  const qs = new URLSearchParams(paramsPeriodoDe(sp)).toString();
  return qs ? `${href}?${qs}` : href;
}

/**
 * Troca o período de uma query string: remove mes/de/ate (e as chaves de
 * `limpar`, ex.: um dia selecionado) e aplica `novo`.
 */
export function trocarPeriodo(atual: Fonte, novo: Record<string, string>, limpar: readonly string[] = []): URLSearchParams {
  const p = ehParams(atual) ? new URLSearchParams(atual.toString()) : new URLSearchParams(
    Object.entries(atual).filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""),
  );
  for (const k of [...CHAVES_PERIODO, ...limpar]) p.delete(k);
  for (const [k, v] of Object.entries(novo)) p.set(k, v);
  return p;
}

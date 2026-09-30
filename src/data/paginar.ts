/**
 * O Supabase devolve no máximo 1000 linhas por consulta (max-rows do PostgREST)
 * e corta o resto SEM erro. Uma soma sobre o resultado cortado sai menor do que
 * a real sem ninguém perceber. Para consultas que podem passar disso, busca
 * página por página até vir uma página incompleta.
 *
 * A consulta passada precisa ter ordem estável (ex.: `.order("id")`), senão
 * linhas podem se repetir ou sumir entre páginas.
 */
export const TAMANHO_PAGINA = 1000;

export async function buscarTodas<T>(
  pagina: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const todas: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await pagina(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    const linhas = data ?? [];
    todas.push(...linhas);
    if (linhas.length < TAMANHO_PAGINA) return todas;
  }
}

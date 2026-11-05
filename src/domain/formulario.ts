/**
 * Valor de formulário que só pode ser um de `opcoes` (enum do banco). Vazio →
 * `padrao`; qualquer outra coisa é erro — o banco recusaria do mesmo jeito, só
 * que com uma mensagem pior.
 */
export function umDe<T extends string>(valor: FormDataEntryValue | null | undefined, opcoes: readonly T[], padrao: T): T {
  const v = typeof valor === "string" ? valor.trim() : "";
  if (!v) return padrao;
  if ((opcoes as readonly string[]).includes(v)) return v as T;
  throw new Error(`Valor inválido: "${v}" (esperado: ${opcoes.join(", ")}).`);
}

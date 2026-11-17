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

/**
 * Valor digitado no padrão brasileiro: vírgula decimal e ponto de milhar
 * ("1.234,56"). Sem vírgula, ponto só é milhar em grupos de 3 ("400.000");
 * senão é decimal ("7.05", formato antigo do campo). Vazio, negativo ou lixo
 * = null (a ação não grava).
 */
export function valorBR(valor: FormDataEntryValue | null | undefined): number | null {
  let s = (typeof valor === "string" ? valor : "").replace(/R\$|\s/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : null;
}

/** Valor salvo → texto do campo ("1234,50"), para editar já com vírgula. */
export const paraCampoBR = (valor: number, casas = 2): string => valor.toFixed(casas).replace(".", ",");

/**
 * Atributos do campo de valor em reais: texto com teclado numérico (aceita
 * vírgula em qualquer navegador — o type="number" só aceita o separador do
 * idioma do navegador).
 */
export const CAMPO_VALOR = {
  type: "text",
  inputMode: "decimal",
  pattern: "[0-9]+([.,][0-9]+)?|[0-9]{1,3}([.][0-9]{3})+(,[0-9]+)?",
  title: "Use vírgula nos centavos (ex.: 1.234,56)",
  autoComplete: "off",
} as const;

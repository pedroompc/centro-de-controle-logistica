// Telefone do cadastro do Winthor → conversa no WhatsApp (wa.me). O cadastro do
// RCA (PCUSUARI.TELEFONE1/2) vem em formatos variados: "81 983355048",
// "87 99811-7656", "9 9215-3291" (sem DDD), "819 9257-2788", "81 9925.92744".

/** DDD da operação (Recife): vale para número cadastrado sem DDD. */
export const DDD_PADRAO = "81";

/**
 * Só os dígitos, com DDD, sem o 55 do país: 10 (fixo) ou 11 (celular) dígitos.
 * `null` quando não dá para montar um número válido.
 */
export function normalizarFoneBR(fone: string | null | undefined): string | null {
  let d = String(fone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) d = d.slice(2);
  if (d.length === 8 || d.length === 9) d = DDD_PADRAO + d;
  if (d.length !== 10 && d.length !== 11) return null;
  if (d.length === 11 && d[2] !== "9") return null; // celular com 11 dígitos começa com 9
  return d;
}

/** "(81) 98335-5048" / "(81) 3333-4444". */
export function formatarFoneBR(digitos: string): string {
  const ddd = digitos.slice(0, 2);
  const n = digitos.slice(2);
  return `(${ddd}) ${n.slice(0, n.length - 4)}-${n.slice(-4)}`;
}

/** Primeiro telefone válido entre os cadastrados (TELEFONE1, depois TELEFONE2). */
export function primeiroFoneValido(...fones: (string | null | undefined)[]): string | null {
  for (const f of fones) {
    const d = normalizarFoneBR(f);
    if (d) return d;
  }
  return null;
}

/** Link da conversa no WhatsApp, já com a mensagem inicial. */
export function linkWhatsApp(digitos: string, mensagem?: string): string {
  const base = `https://wa.me/55${digitos}`;
  return mensagem ? `${base}?text=${encodeURIComponent(mensagem)}` : base;
}

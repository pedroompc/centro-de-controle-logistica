const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(valor: number): string {
  // Intl usa espaço não-quebrável (U+00A0) entre "R$" e o número; normalizamos para espaço comum.
  return brl.format(valor).replace(/ /g, " ");
}

export function formatDataBR(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

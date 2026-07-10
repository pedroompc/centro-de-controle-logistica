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

const kg = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });

/** Peso em quilos, sem casas decimais: 94871.23 → "94.871 kg". */
export function formatKg(valor: number): string {
  return `${kg.format(valor)} kg`;
}

/** Fração (0..1) como percentual pt-BR: 0.0718 → "7,2%". */
export function formatPercent(fracao: number, casas = 1): string {
  const pct = (fracao * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  return `${pct}%`;
}

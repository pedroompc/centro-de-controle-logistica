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

/**
 * Peso em quilos: 94871.23 → "94.871 kg" (sem casas, default histórico).
 *
 * `casas` existe porque nem todo "kg" do sistema tem a mesma granularidade.
 * Descarregamento pesa na balança do pátio, casa dos milhares — 0 casas é
 * ilustrativo. Reciclagem é `numeric(14,3)` com passo de grama no formulário:
 * arredondar pra inteiro esconde a quantidade real (0,4 kg vira "0 kg") e
 * quem confere o valor contra quantidade × preço vê uma divergência que não
 * existe. Passe `casas` só onde a fração importa; o default 0 continua
 * servindo os outros 8 usos (faturamento, tendências, descarregamento).
 */
export function formatKg(valor: number, casas = 0): string {
  const fmt = casas === 0 ? kg : new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  return `${fmt.format(valor)} kg`;
}

/** Fração (0..1) como percentual pt-BR: 0.0718 → "7,2%". */
export function formatPercent(fracao: number, casas = 1): string {
  const pct = (fracao * 100).toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
  return `${pct}%`;
}

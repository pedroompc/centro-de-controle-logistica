// Custo da frota no custo logístico: três linhas automáticas por mês em
// custos_mensais, como as de equipamento ("Equipamento · …"):
//   Frota · Diesel (estimado)  variável  km do hodômetro ÷ km/L do modelo × preço do litro
//   Frota · Desgaste           fixo      valor mensal de Custos › Frota
//   Frota · Manutenção         fixo      valor mensal de Custos › Frota
// Mesmas fórmulas de src/domain/frota-custo.ts. Diferença: aqui entra todo km da
// frota ativa (o coletor não lê o Winthor), não só o dos dias com carga.
import { normalizarPlaca } from "./resumo.mjs";

export const PREFIXO_FROTA = "Frota · ";

/** Mesmo teto de src/domain/frota.ts (o teste garante que não divergem). */
export const KM_MAX_DIA = 1500;

/** km do dia: hodômetro (se plausível) → senão GPS → senão null. Espelho de `kmDoDia` do app. */
export function kmDoDia(l) {
  if (l.hodometro_min_m !== null && l.hodometro_max_m !== null) {
    const km = (l.hodometro_max_m - l.hodometro_min_m) / 1000;
    return km < 0 || km > KM_MAX_DIA ? null : km;
  }
  return l.km_gps !== null && l.km_gps >= 0 && l.km_gps <= KM_MAX_DIA ? l.km_gps : null;
}

const centavos = (v) => Math.round(v * 100) / 100;

/**
 * Linhas do mês a partir do hodômetro diário (frota_hodometro_diario) e do
 * cadastro. Placa fora da frota ativa ou sem km/L não entra no diesel.
 * @param cadastro {precoDiesel, desgasteMensal, manutencaoMensal, kmPorLitro: Map modelo→km/L, modeloDaPlaca: Map placa→modelo}
 */
export function linhasCustoFrota(hodometro, cadastro) {
  let litros = 0;
  for (const l of hodometro) {
    const modelo = cadastro.modeloDaPlaca.get(normalizarPlaca(l.placa));
    const kmL = modelo ? cadastro.kmPorLitro.get(modelo) : undefined;
    const km = kmDoDia(l);
    if (!kmL || kmL <= 0 || km === null) continue;
    litros += km / kmL;
  }
  return [
    { nome: `${PREFIXO_FROTA}Diesel (estimado)`, tipo: "variavel", valor: centavos(litros * cadastro.precoDiesel) },
    { nome: `${PREFIXO_FROTA}Desgaste`, tipo: "fixo", valor: centavos(cadastro.desgasteMensal) },
    { nome: `${PREFIXO_FROTA}Manutenção`, tipo: "fixo", valor: centavos(cadastro.manutencaoMensal) },
  ];
}

const DIAS_DE_FOLGA = 3; // o km do último dia do mês ainda chega nos primeiros dias do seguinte

/**
 * Meses ("aaaa-mm-01") a (re)gravar: os que ainda não têm as linhas e os ainda
 * abertos (corrente, e o anterior até o dia 3). Mês fechado já gravado fica
 * intacto — mudar o preço do diesel hoje não reescreve o passado.
 */
export function mesesParaAtualizar(desde, hoje, jaGravados) {
  const meses = [];
  const [aH, mH, dH] = hoje.toLocaleDateString("sv-SE", { timeZone: "America/Recife" }).split("-").map(Number);
  let [a, m] = desde.split("-").map(Number);
  while (a * 12 + m <= aH * 12 + mH) {
    const mes = `${a}-${String(m).padStart(2, "0")}-01`;
    const corrente = a === aH && m === mH;
    const anteriorNaFolga = a * 12 + m === aH * 12 + mH - 1 && dH <= DIAS_DE_FOLGA;
    if (!jaGravados.has(mes) || corrente || anteriorNaFolga) meses.push(mes);
    if (++m > 12) { m = 1; a++; }
  }
  return meses;
}

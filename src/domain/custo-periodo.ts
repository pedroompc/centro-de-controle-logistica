// Custos são mensais (lançamentos de custos_mensais e a foto mensal do
// efetivo). Num período qualquer, somam os meses que ele toca — sem rateio
// por dia. Mês sem nenhum dado fica de fora; período sem nada = null ("sem dado").

export interface CustoDoMes {
  fixos: number;
  variaveis: number;
}

/** Soma dos meses pedidos que existem no mapa; `null` se nenhum existe. */
export function somaNosMeses(porMes: Map<string, number>, meses: string[]): number | null {
  let achou = false;
  let total = 0;
  for (const m of meses) {
    const v = porMes.get(m);
    if (v === undefined) continue;
    achou = true;
    total += v;
  }
  return achou ? total : null;
}

/** Custo bruto (folha + fixos + variáveis) dos meses do período. */
export function custoBrutoDoPeriodo(
  meses: string[],
  folhaPorMes: Map<string, number>,
  custosPorMes: Map<string, CustoDoMes>,
): number | null {
  let achou = false;
  let total = 0;
  for (const m of meses) {
    const folha = folhaPorMes.get(m);
    const c = custosPorMes.get(m);
    if (folha === undefined && !c) continue;
    achou = true;
    total += (folha ?? 0) + (c?.fixos ?? 0) + (c?.variaveis ?? 0);
  }
  return achou ? total : null;
}

/**
 * Quantos "meses de custo" o período representa até hoje: soma, por mês
 * tocado, da fração de dias cobertos e já decorridos. Mês fechado inteiro = 1.
 * Usado para custos fixos mensais (frota) num período qualquer.
 */
export function mesesEquivalentes(p: { de: string; ate: string }, hoje: Date = new Date()): number {
  const h = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-${String(hoje.getDate()).padStart(2, "0")}`;
  const ate = p.ate < h ? p.ate : h;
  if (ate < p.de) return 0;
  let total = 0;
  let [a, m] = p.de.split("-").map(Number);
  const [aF, mF] = ate.split("-").map(Number);
  while (a * 12 + m <= aF * 12 + mF) {
    const ini = `${a}-${String(m).padStart(2, "0")}-01`;
    const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const fim = `${a}-${String(m).padStart(2, "0")}-${String(dias).padStart(2, "0")}`;
    const de = p.de > ini ? p.de : ini;
    const at = ate < fim ? ate : fim;
    total += (Number(at.slice(8)) - Number(de.slice(8)) + 1) / dias;
    if (++m > 12) { m = 1; a++; }
  }
  return total;
}

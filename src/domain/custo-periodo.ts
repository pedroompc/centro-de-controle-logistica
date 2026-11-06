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

export interface CustoRecorte {
  /** Σ custo do mês × fração do mês dentro do período (até hoje); null = nenhum mês com custo. */
  total: number | null;
  /** Meses equivalentes do período inteiro (até hoje). */
  fracao: number;
  /** Todos os meses tocados têm custo (senão o total cobre só parte do período). */
  completo: boolean;
}

/**
 * Custo mensal (folha da foto do mês + equipamentos) levado a um período
 * qualquer: cada mês entra na proporção dos seus dias dentro do período, já
 * decorridos. Mês sem custo fica de fora e marca o recorte como incompleto.
 */
export function custoDoRecorte(
  p: { de: string; ate: string },
  custoPorMes: Map<string, number | null>,
  hoje: Date = new Date(),
): CustoRecorte {
  let total = 0;
  let fracao = 0;
  let achou = false;
  let completo = true;
  let [a, m] = p.de.split("-").map(Number);
  const [aF, mF] = p.ate.split("-").map(Number);
  while (a * 12 + m <= aF * 12 + mF) {
    const mes = `${a}-${String(m).padStart(2, "0")}-01`;
    const dias = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const fimMes = `${mes.slice(0, 8)}${String(dias).padStart(2, "0")}`;
    const fr = mesesEquivalentes({ de: p.de > mes ? p.de : mes, ate: p.ate < fimMes ? p.ate : fimMes }, hoje);
    if (fr > 0) {
      fracao += fr;
      const c = custoPorMes.get(mes);
      if (c == null) completo = false;
      else {
        achou = true;
        total += c * fr;
      }
    }
    if (++m > 12) { m = 1; a++; }
  }
  return { total: achou ? total : null, fracao, completo: achou && completo };
}

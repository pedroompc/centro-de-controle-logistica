import { lerPeriodo, mesAnterior, periodoDoMes, primeiroDiaDoMes, type Periodo } from "@/domain/periodo";

/**
 * Sem período na URL abre no mês FECHADO: o agregado recebe na semana seguinte,
 * então o mês corrente sempre aparece com custo a menos.
 */
export function periodoDoPadrao(sp: { mes?: string; de?: string; ate?: string }): Periodo {
  return sp.mes || sp.de ? lerPeriodo(sp) : periodoDoMes(mesAnterior(primeiroDiaDoMes()));
}

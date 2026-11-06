import { isAdmin } from "./auth";
import { lerViagensPeriodo } from "./winthor-entregas";
import { lerHodometroPeriodo } from "./frota-km";
import { lerCadastroFrota } from "./frota-custos";
import { mapaKmDia, resumoKm, type ResumoKm } from "@/domain/frota";
import { custoFrota } from "@/domain/frota-custo";
import { totaisEntregas } from "@/domain/motoristas";
import { mesesEquivalentes } from "@/domain/custo-periodo";
import type { Periodo } from "@/domain/periodo";
import type { ResumoFrotaTV } from "@/app/(app)/painel/painel-actions";

async function kmDoPeriodo(p: Periodo): Promise<{ r: ResumoKm; entregas: number } | null> {
  const [vs, hod] = await Promise.all([lerViagensPeriodo(p.de, p.ate), lerHodometroPeriodo(p.de, p.ate)]);
  if (!hod) return null;
  return { r: resumoKm(vs, mapaKmDia(hod), null), entregas: totaisEntregas(vs).entregas };
}

function porVeiculoDia(r: ResumoKm): number | null {
  const dias = r.porVeiculo.reduce((s, v) => s + (v.km !== null ? v.diasRodados : 0), 0);
  return dias > 0 ? r.km / dias : null;
}

/**
 * KM real da frota num período qualquer, vs o período `comparar` (o anterior).
 * Mesmo formato do slide da TV; custo fixo mensal proporcional aos meses
 * equivalentes do período. `null` = sem telemetria.
 */
export async function carregarFrotaPeriodo(p: Periodo, comparar: Periodo | null): Promise<ResumoFrotaTV | null> {
  const [atual, ant, admin] = await Promise.all([
    kmDoPeriodo(p),
    comparar ? kmDoPeriodo(comparar).catch(() => null) : null,
    isAdmin(),
  ]);
  if (!atual || atual.r.rastreados === 0) return null;
  const { r, entregas } = atual;
  const cadastro = admin ? await lerCadastroFrota().catch(() => null) : null;
  const c = cadastro ? custoFrota(r, cadastro, mesesEquivalentes(p)) : null;
  return {
    km: r.km,
    kmPorEntrega: r.kmPorEntrega,
    rastreados: r.rastreados,
    veiculos: r.veiculos,
    kmPorVeiculoDia: porVeiculoDia(r),
    porDia: [...r.porDia.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([data, km]) => ({ data, km })),
    top: r.porVeiculo
      .filter((v) => v.km !== null)
      .slice(0, 8)
      .map((v) => ({ placa: v.placa, descricao: v.descricao, km: v.km!, diasRodados: v.diasRodados, kmPorEntrega: v.kmPorEntrega })),
    anterior: ant && ant.r.rastreados > 0 ? { km: ant.r.km, kmPorEntrega: ant.r.kmPorEntrega, kmPorVeiculoDia: porVeiculoDia(ant.r) } : null,
    custo: c ? { total: c.total, diesel: c.diesel, porKm: c.custoPorKm, porEntrega: entregas > 0 ? c.total / entregas : null } : null,
  };
}

// Indicadores do recorte dos Motoristas — a MESMA conta alimenta o BI do setor
// e o resumo do BI Geral. Sem "use client": roda no servidor e no cliente.
import { custoDoPeriodo, custoSobreFaturamento } from "@/domain/separacao";
import { totaisEntregas, type ViagemEntrega } from "@/domain/motoristas";
import type { DadosBIMotoristas } from "./motoristas-dados";

export const comViagens = (e: DadosBIMotoristas["entregas"]): e is { viagens: ViagemEntrega[] } => "viagens" in e;

/** Indicadores do recorte (mês ou 1 dia) — a MESMA conta alimenta cards e gráficos. */
export function indicadoresMotoristas(d: DadosBIMotoristas, dia: string | null) {
  const vs = comViagens(d.entregas) ? d.entregas.viagens : null;
  const h = d.ref;
  const totMes = vs ? totaisEntregas(vs) : null;
  const tot = vs ? totaisEntregas(vs, dia) : null;
  // Mês/período: custo cheio (fixo). 1 dia: custo do que já correu ÷ dias com viagem.
  const fr = dia ? d.fracaoDecorrida : d.fracaoMes;
  const custo = custoDoPeriodo(h?.custo ?? null, fr, totMes?.dias ?? 0, !!dia);
  const por = (q: number | undefined) => (custo === null || !q ? null : custo / q);
  return {
    vs,
    h,
    tot,
    custo,
    /** parte do custo mensal que cabe ao recorte (mesma regra do custo da equipe) */
    fracaoCusto: custoDoPeriodo(1, fr, totMes?.dias ?? 0, !!dia) ?? 0,
    porEntrega: por(tot?.entregas),
    porViagem: por(tot?.viagens),
    porTonelada: tot && tot.kg > 0 && custo !== null ? custo / (tot.kg / 1000) : null,
    sobreFat: custoSobreFaturamento(h?.custoPeriodo ?? null, d.faturamentoLiquido),
  };
}

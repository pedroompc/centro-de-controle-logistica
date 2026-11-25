import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { primeiroDiaDoMes, mesAnterior, mesesDoPeriodo, INICIO_HISTORICO } from "@/domain/periodo";
import { hojeISO } from "@/domain/fechamento";
import { efetivoSetorNoMes, totaisEfetivoPorMes, type LinhaEfetivoSetor, type TotalEfetivoMes } from "@/domain/efetivo";

export interface FotoEfetivoSetorMes extends LinhaEfetivoSetor {
  mes: string; // "yyyy-mm-01"
}

/** Início da janela: qtdMeses atrás (incluindo o corrente), preso ao histórico. */
function inicioJanela(qtdMeses: number): string {
  let m = primeiroDiaDoMes();
  for (let i = 1; i < qtdMeses; i++) m = mesAnterior(m);
  return m < INICIO_HISTORICO ? INICIO_HISTORICO : m;
}

/**
 * Efetivo por setor dos últimos `qtdMeses` meses (mais antigo → mais novo),
 * reconstruído pelas datas de admissão/desligamento do cadastro — ver
 * `efetivoSetorNoMes`. Corrigir uma data no cadastro corrige todos os meses.
 */
export async function serieEfetivoSetorMensal(qtdMeses = 12): Promise<FotoEfetivoSetorMes[]> {
  try {
    const [funcionarios, setores] = await Promise.all([listarFuncionarios(), listarSetores()]);
    const hoje = hojeISO();
    return mesesDoPeriodo({ de: inicioJanela(qtdMeses), ate: hoje }).flatMap((mes) =>
      efetivoSetorNoMes(funcionarios, setores, mes, hoje).map((l) => ({ mes, ...l })),
    );
  } catch (e) {
    // Supabase fora: sem histórico, a página segue.
    console.error("[efetivo-mensal-setor] indisponível:", e instanceof Error ? e.message : e);
    return [];
  }
}

/** Totais por mês (soma dos setores) — usado pela aba Efetivos. */
export async function serieEfetivoMensal(qtdMeses = 12): Promise<TotalEfetivoMes[]> {
  return totaisEfetivoPorMes(await serieEfetivoSetorMensal(qtdMeses));
}

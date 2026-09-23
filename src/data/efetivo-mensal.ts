import { createClient } from "@/lib/supabase/server";
import { primeiroDiaDoMes, mesAnterior, INICIO_HISTORICO } from "@/domain/periodo";
import { totaisEfetivoPorMes, type LinhaEfetivoSetor, type TotalEfetivoMes } from "@/domain/efetivo";

const FILIAL = "1";

export interface FotoEfetivoSetorMes extends LinhaEfetivoSetor {
  mes: string; // "yyyy-mm-01"
}

/** Início da janela: qtdMeses atrás (incluindo o corrente), preso ao histórico. */
function inicioJanela(qtdMeses: number): string {
  let m = primeiroDiaDoMes();
  for (let i = 1; i < qtdMeses; i++) m = mesAnterior(m);
  return m < INICIO_HISTORICO ? INICIO_HISTORICO : m;
}

/** Fotos por setor dos últimos `qtdMeses` meses (mais antigo → mais novo). */
export async function serieEfetivoSetorMensal(qtdMeses = 12): Promise<FotoEfetivoSetorMes[]> {
  const inicio = inicioJanela(qtdMeses);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("efetivo_mensal_setor")
    .select("mes, setor, ativos, afastados, desligados, custo_ativos")
    .eq("filial", FILIAL)
    .gte("mes", inicio)
    .order("mes", { ascending: true });
  if (error) {
    // Tabela ainda não migrada / Supabase fora: sem histórico, a página segue.
    console.error("[efetivo-mensal-setor] indisponível:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    mes: primeiroDiaDoMes(String(r.mes)),
    setor: String(r.setor),
    ativos: Number(r.ativos) || 0,
    afastados: Number(r.afastados) || 0,
    desligados: Number(r.desligados) || 0,
    custoAtivos: Number(r.custo_ativos) || 0,
  }));
}

/** Totais por mês (soma dos setores) — usado pela aba Efetivos. */
export async function serieEfetivoMensal(qtdMeses = 12): Promise<TotalEfetivoMes[]> {
  return totaisEfetivoPorMes(await serieEfetivoSetorMensal(qtdMeses));
}

/**
 * Grava/atualiza a foto do MÊS CORRENTE por setor (upsert). Best-effort: qualquer
 * falha (tabela ausente, RLS, offline) é engolida — nunca quebra o render.
 */
export async function registrarFotoEfetivoSetor(linhas: LinhaEfetivoSetor[]): Promise<void> {
  if (linhas.length === 0) return;
  try {
    const supabase = await createClient();
    const mes = primeiroDiaDoMes();
    const now = new Date().toISOString();
    const rows = linhas.map((l) => ({
      mes,
      filial: FILIAL,
      setor: l.setor,
      ativos: l.ativos,
      afastados: l.afastados,
      desligados: l.desligados,
      custo_ativos: l.custoAtivos,
      atualizado_em: now,
    }));
    const { error } = await supabase
      .from("efetivo_mensal_setor")
      .upsert(rows, { onConflict: "mes,filial,setor" });
    if (error) console.error("[efetivo-mensal-setor] falha ao registrar foto:", error.message);
  } catch (e) {
    console.error("[efetivo-mensal-setor] falha ao registrar foto:", e);
  }
}

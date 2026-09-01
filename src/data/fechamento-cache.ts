import { createClient } from "@/lib/supabase/server";
import { primeiroDiaDoMes } from "@/domain/periodo";

// Invalidação da foto de fechamento mensal. Módulo separado (sem importar o
// serviço nem as origens de dados) para não criar ciclo de imports: as server
// actions de custos/receitas/faltas importam daqui, e o serviço
// `fechamento-mensal.ts` importa daquelas.

/**
 * Apaga a foto de um mês para forçar o recálculo no próximo acesso. No-op se o
 * mês for o corrente ou futuro (esses nunca são congelados). Best-effort: um
 * erro aqui não deve derrubar a mutação que já gravou o dado de negócio.
 */
export async function invalidarFechamentoDoMes(mes: string): Promise<void> {
  if (mes >= primeiroDiaDoMes()) return; // só mês fechado tem foto
  const supabase = await createClient();
  const { error } = await supabase.from("fechamento_mensal").delete().eq("mes", mes);
  if (error) console.error("[fechamento-cache] falha ao invalidar", mes, error.message);
}

/** Como `invalidarFechamentoDoMes`, mas a partir de uma data (`YYYY-MM-DD`). */
export async function invalidarFechamentoDoMesDe(data: string | null | undefined): Promise<void> {
  if (!data) return;
  await invalidarFechamentoDoMes(primeiroDiaDoMes(data));
}

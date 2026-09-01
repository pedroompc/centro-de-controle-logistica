"use server";

import { createClient } from "@/lib/supabase/server";
import { mapFalta } from "./mappers";
import { revalidarEfetivo } from "./revalidate";
import { assertAdmin } from "./auth";
import { invalidarFechamentoDoMesDe } from "./fechamento-cache";
import { inicioFimDoMes } from "@/domain/periodo";
import type { Falta } from "@/domain/types";

const COLUNAS = "id, funcionario_id, data, tipo, observacao";

export async function listarFaltas(): Promise<Falta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("faltas").select(COLUNAS);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFalta);
}

/**
 * Nº de faltas num mês. A FK `funcionario_id` é ON DELETE CASCADE, então não há
 * falta órfã — contar por período equivale a filtrar pelos funcionários. Usado
 * pelo snapshot de fechamento.
 */
export async function contarFaltasDoMes(mes: string): Promise<number> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("faltas")
    .select("*", { count: "exact", head: true })
    .gte("data", inicio)
    .lte("data", fim);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function faltasDoFuncionario(funcionarioId: string): Promise<Falta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("faltas")
    .select(COLUNAS)
    .eq("funcionario_id", funcionarioId)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFalta);
}

export async function registrarFalta(formData: FormData): Promise<void> {
  await assertAdmin();
  const registro = {
    funcionario_id: String(formData.get("funcionario_id") ?? ""),
    data: String(formData.get("data") ?? ""),
    tipo: String(formData.get("tipo") ?? "injustificada"),
    observacao: String(formData.get("observacao") ?? "").trim() || null,
  };
  const supabase = await createClient();
  const { error } = await supabase.from("faltas").insert(registro);
  if (error) throw new Error(error.message);
  await invalidarFechamentoDoMesDe(registro.data);
  revalidarEfetivo();
}

export async function excluirFalta(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: antigo } = await supabase.from("faltas").select("data").eq("id", id).maybeSingle();
  const { error } = await supabase.from("faltas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await invalidarFechamentoDoMesDe(antigo?.data ? String(antigo.data) : null);
  revalidarEfetivo();
}

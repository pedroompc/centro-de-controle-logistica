"use server";

import { createClient } from "@/lib/supabase/server";
import { mapFalta } from "./mappers";
import { revalidarEfetivo } from "./revalidate";
import type { Falta } from "@/domain/types";

const COLUNAS = "id, funcionario_id, data, tipo, observacao";

export async function listarFaltas(): Promise<Falta[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("faltas").select(COLUNAS);
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFalta);
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
  const registro = {
    funcionario_id: String(formData.get("funcionario_id") ?? ""),
    data: String(formData.get("data") ?? ""),
    tipo: String(formData.get("tipo") ?? "injustificada"),
    observacao: String(formData.get("observacao") ?? "").trim() || null,
  };
  const supabase = await createClient();
  const { error } = await supabase.from("faltas").insert(registro);
  if (error) throw new Error(error.message);
  revalidarEfetivo();
}

export async function excluirFalta(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("faltas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidarEfetivo();
}

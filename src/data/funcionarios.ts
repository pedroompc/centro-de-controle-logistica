"use server";

import { createClient } from "@/lib/supabase/server";
import { mapFuncionario } from "./mappers";
import { revalidarEfetivo } from "./revalidate";
import type { Funcionario } from "@/domain/types";

const COLUNAS = "id, nome, cargo, setor_id, custo_mensal, data_admissao, status";

export async function listarFuncionarios(): Promise<Funcionario[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("funcionarios").select(COLUNAS).order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFuncionario);
}

export async function buscarFuncionario(id: string): Promise<Funcionario | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("funcionarios")
    .select(COLUNAS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapFuncionario(data) : null;
}

export async function salvarFuncionario(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "").trim();
  const registro = {
    nome: String(formData.get("nome") ?? "").trim(),
    cargo: String(formData.get("cargo") ?? "").trim(),
    setor_id: String(formData.get("setor_id") ?? ""),
    custo_mensal: Number(formData.get("custo_mensal") ?? 0),
    data_admissao: String(formData.get("data_admissao") ?? ""),
    status: String(formData.get("status") ?? "ativo"),
  };
  const supabase = await createClient();
  const query = id
    ? supabase.from("funcionarios").update(registro).eq("id", id)
    : supabase.from("funcionarios").insert(registro);
  const { error } = await query;
  if (error) throw new Error(error.message);
  revalidarEfetivo();
}

export async function excluirFuncionario(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("funcionarios").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidarEfetivo();
}

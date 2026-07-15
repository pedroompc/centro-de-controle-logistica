"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapFornecedor } from "./mappers";
import { assertAdmin } from "./auth";
import type { Fornecedor } from "@/domain/types";

export async function listarFornecedores(): Promise<Fornecedor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fornecedores")
    .select("id, nome, ativo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapFornecedor);
}

export async function criarFornecedor(formData: FormData): Promise<void> {
  await assertAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").insert({ nome });
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/fornecedores");
  revalidatePath("/receitas");
}

export async function editarFornecedor(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update({ nome }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/fornecedores");
  revalidatePath("/receitas");
}

export async function encerrarFornecedor(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("fornecedores").update({ ativo: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/fornecedores");
  revalidatePath("/receitas");
}

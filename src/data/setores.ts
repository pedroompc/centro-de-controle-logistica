"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapSetor } from "./mappers";
import type { Setor } from "@/domain/types";

export async function listarSetores(): Promise<Setor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("setores")
    .select("id, nome")
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapSetor);
}

export async function criarSetor(formData: FormData): Promise<void> {
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("setores").insert({ nome });
  if (error) throw new Error(error.message);
  revalidatePath("/setores");
}

export async function excluirSetor(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("setores").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/setores");
}

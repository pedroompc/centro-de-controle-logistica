"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapCustoFixo } from "./mappers";
import type { CustoFixo } from "@/domain/types";

export async function listarCustosFixos(): Promise<CustoFixo[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custos_fixos")
    .select("id, nome, valor, ativo")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCustoFixo);
}

export async function criarCustoFixo(formData: FormData): Promise<void> {
  const nome = String(formData.get("nome") ?? "").trim();
  const valor = Number(formData.get("valor") ?? 0);
  if (!nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("custos_fixos").insert({ nome, valor });
  if (error) throw new Error(error.message);
  revalidatePath("/custos/fixos");
}

export async function editarValorCustoFixo(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const raw = formData.get("valor");
  if (raw === null || String(raw).trim() === "") return;
  const valor = Number(raw);
  if (Number.isNaN(valor)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("custos_fixos").update({ valor }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/custos/fixos");
}

export async function encerrarCustoFixo(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("custos_fixos").update({ ativo: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/custos/fixos");
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "./auth";
import type { Equipamento } from "@/domain/types";

/**
 * Equipamentos ativos do recebimento. `null` = tabela ainda não migrada (0023)
 * — quem chama usa o valor padrão antigo em vez de zerar o custo.
 */
export async function listarEquipamentos(): Promise<Equipamento[] | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamentos")
    .select("id, nome, quantidade, custo_unitario")
    .eq("ativo", true)
    .order("nome");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    console.error("[equipamentos] indisponível:", error.message);
    return null;
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    nome: String(r.nome),
    quantidade: Number(r.quantidade) || 0,
    custoUnitario: Number(r.custo_unitario) || 0,
  }));
}

function lerForm(formData: FormData) {
  return {
    nome: String(formData.get("nome") ?? "").trim(),
    quantidade: Math.max(0, Math.round(Number(formData.get("quantidade") ?? 0))),
    custo_unitario: Math.max(0, Number(formData.get("custo_unitario") ?? 0)),
  };
}

function revalidar() {
  revalidatePath("/custos/equipamentos");
  revalidatePath("/painel");
  revalidatePath("/setores", "layout");
}

export async function criarEquipamento(formData: FormData): Promise<void> {
  await assertAdmin();
  const row = lerForm(formData);
  if (!row.nome || Number.isNaN(row.custo_unitario)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("equipamentos").insert(row);
  if (error) throw new Error(error.message);
  revalidar();
}

export async function editarEquipamento(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const { quantidade, custo_unitario } = lerForm(formData);
  if (!id || Number.isNaN(custo_unitario)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("equipamentos").update({ quantidade, custo_unitario }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}

export async function encerrarEquipamento(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("equipamentos").update({ ativo: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}

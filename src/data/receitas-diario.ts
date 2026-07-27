"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapTotalDiario } from "./mappers";
import { assertAdmin } from "./auth";
import { inicioFimDoMes } from "@/domain/periodo";
import type { TotalDiarioDescarregamento } from "@/domain/types";

const COLS = "id, data, descarregos, peso_kg, receita, observacao";

export async function listarTotaisDiariosDoMes(mes: string): Promise<TotalDiarioDescarregamento[]> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receitas_descarregamento_diario")
    .select(COLS)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapTotalDiario(row as Parameters<typeof mapTotalDiario>[0]));
}

function parseForm(formData: FormData) {
  const data = String(formData.get("data") ?? "").trim();
  const descarregos = Number(formData.get("descarregos") ?? 0);
  const pesoKg = Number(formData.get("peso_kg") ?? 0);
  const receita = Number(formData.get("receita") ?? 0);
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  return { data, descarregos, pesoKg, receita, observacao };
}

/** Campos gravados no banco, compartilhados por criar e editar. */
function toRow(f: ReturnType<typeof parseForm>) {
  return {
    data: f.data,
    descarregos: f.descarregos,
    peso_kg: f.pesoKg,
    receita: f.receita,
    observacao: f.observacao,
  };
}

function revalidar() {
  revalidatePath("/receitas");
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function criarTotalDiario(formData: FormData): Promise<void> {
  await assertAdmin();
  const f = parseForm(formData);
  // descarregos e receita são o mínimo de um total do dia; peso pode ser 0.
  if (!f.data || !f.descarregos || !f.receita) return;
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento_diario").insert(toRow(f));
  if (error) throw new Error(error.message);
  revalidar();
}

export async function editarTotalDiario(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const f = parseForm(formData);
  if (!id || !f.data || !f.descarregos || !f.receita) return;
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento_diario").update(toRow(f)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}

export async function removerTotalDiario(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento_diario").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}

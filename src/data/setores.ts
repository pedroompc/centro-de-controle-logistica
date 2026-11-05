"use server";

import { createClient } from "@/lib/supabase/server";
import { mapSetor } from "./mappers";
import { revalidarEfetivo } from "./revalidate";
import { assertAdmin } from "./auth";
import type { Setor } from "@/domain/types";

const AREA_DA_PLATAFORMA = "logistico";

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
  await assertAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  if (!nome) return;
  const supabase = await createClient();
  // Todo setor desta plataforma é da área Logística (as outras áreas são do
  // sistema do RH). area_id é obrigatório no banco desde as migrations do RH.
  const { data: area, error: erroArea } = await supabase.from("areas").select("id").eq("slug", AREA_DA_PLATAFORMA).single();
  if (erroArea || !area) throw new Error(`Área "${AREA_DA_PLATAFORMA}" não encontrada: ${erroArea?.message ?? "sem linha"}`);
  const { error } = await supabase.from("setores").insert({ nome, area_id: area.id });
  if (error) throw new Error(error.message);
  revalidarEfetivo();
}

export async function renomearSetor(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const nome = String(formData.get("nome") ?? "").trim();
  if (!id || !nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("setores").update({ nome }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidarEfetivo();
}

export async function excluirSetor(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("setores").delete().eq("id", id);
  if (error) {
    // FK on delete restrict: setor com funcionários não pode ser excluído.
    if (error.code === "23503") {
      throw new Error("Não dá para excluir um setor que ainda tem funcionários.");
    }
    throw new Error(error.message);
  }
  revalidarEfetivo();
}

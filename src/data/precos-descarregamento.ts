"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapPreco } from "./mappers";
import { assertAdmin } from "./auth";
import type { PrecoDescarregamento, DescarregamentoTipo } from "@/domain/types";

export async function listarPrecos(): Promise<PrecoDescarregamento[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("precos_descarregamento")
    .select("tipo, preco_por_tonelada")
    .order("tipo");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapPreco);
}

export async function editarPreco(formData: FormData): Promise<void> {
  await assertAdmin();
  const tipo = String(formData.get("tipo") ?? "") as DescarregamentoTipo;
  const raw = formData.get("preco");
  if (!tipo || raw === null || String(raw).trim() === "") return;
  const preco = Number(raw);
  if (Number.isNaN(preco)) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("precos_descarregamento")
    .update({ preco_por_tonelada: preco, atualizado_em: new Date().toISOString() })
    .eq("tipo", tipo);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/precos");
  revalidatePath("/receitas");
}

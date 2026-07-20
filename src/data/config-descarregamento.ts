"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapConfig } from "./mappers";
import { assertAdmin } from "./auth";
import type { ConfigDescarregamento } from "@/domain/types";

export async function lerConfig(): Promise<ConfigDescarregamento> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("config_descarregamento")
    .select("valor_minimo")
    .single();
  if (error) throw new Error(error.message);
  return mapConfig(data);
}

export async function editarValorMinimo(formData: FormData): Promise<void> {
  await assertAdmin();
  const raw = formData.get("valor_minimo");
  if (raw === null || String(raw).trim() === "") return;
  const valor = Number(raw);
  if (Number.isNaN(valor) || valor < 0) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("config_descarregamento")
    .update({ valor_minimo: valor, atualizado_em: new Date().toISOString() })
    .eq("id", true);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas/precos");
  revalidatePath("/receitas");
}

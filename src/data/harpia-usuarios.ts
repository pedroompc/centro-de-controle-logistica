"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "./auth";

/**
 * Ligação usuário do Harpia → funcionário. `null` = tabela ainda não migrada
 * (0025): o BI segue mostrando "Usuário N".
 */
export async function listarUsuariosHarpia(): Promise<Map<number, string> | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("harpia_usuarios").select("usuario, funcionario_id");
  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") console.error("[harpia-usuarios]", error.message);
    return null;
  }
  const m = new Map<number, string>();
  for (const r of data ?? []) if (r.funcionario_id) m.set(Number(r.usuario), String(r.funcionario_id));
  return m;
}

/** Liga (ou desliga, com `funcionarioId` vazio) um usuário do Harpia a um funcionário. */
export async function ligarUsuarioHarpia(usuario: number, funcionarioId: string | null): Promise<{ erro?: string }> {
  await assertAdmin();
  if (!Number.isInteger(usuario)) return { erro: "Usuário inválido." };
  const supabase = await createClient();
  const { error } = funcionarioId
    ? await supabase.from("harpia_usuarios").upsert({ usuario, funcionario_id: funcionarioId, atualizado_em: new Date().toISOString() })
    : await supabase.from("harpia_usuarios").delete().eq("usuario", usuario);
  if (error) {
    return { erro: error.code === "42P01" || error.code === "PGRST205" ? "Rode a migração 0025_harpia_usuarios.sql no Supabase." : error.message };
  }
  revalidatePath("/setores", "layout");
  return {};
}

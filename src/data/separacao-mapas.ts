"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { inicioFimDoMes } from "@/domain/periodo";
import { chaveMapa } from "@/domain/separacao";

export interface RegistroMapa {
  id: string;
  data: string;
  mapa: string;
  funcionarioId: string;
  criadoEm: string;
}

/** Registros do mês. `null` = tabela 0026 ainda não criada. */
export async function listarMapasSeparados(mes: string): Promise<RegistroMapa[] | null> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("separacao_mapas")
    .select("id, data, mapa, funcionario_id, criado_em")
    .gte("data", inicio)
    .lte("data", fim)
    .order("criado_em", { ascending: false });
  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") console.error("[separacao-mapas]", error.message);
    return null;
  }
  return (data ?? []).map((r) => ({
    id: String(r.id),
    data: String(r.data),
    mapa: String(r.mapa),
    funcionarioId: String(r.funcionario_id),
    criadoEm: String(r.criado_em),
  }));
}

export interface RespostaMapa {
  erro?: string;
  ok?: string;
}

/** Registra "o mapa N foi separado por X" (um ou mais separadores). */
export async function registrarMapa(_anterior: RespostaMapa, formData: FormData): Promise<RespostaMapa> {
  const data = String(formData.get("data") ?? "").trim();
  const mapa = chaveMapa(String(formData.get("mapa") ?? ""));
  const separadores = formData.getAll("funcionario_id").map(String).filter(Boolean);
  if (!data || !mapa) return { erro: "Informe a data e o nº do mapa." };
  if (separadores.length === 0) return { erro: "Escolha quem separou." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("separacao_mapas")
    .upsert(separadores.map((f) => ({ data, mapa, funcionario_id: f })), { onConflict: "mapa,funcionario_id", ignoreDuplicates: true });
  if (error) {
    return { erro: error.code === "42P01" || error.code === "PGRST205" ? "Rode a migração 0026_separacao_mapas.sql no Supabase." : error.message };
  }
  revalidatePath("/setores", "layout");
  return { ok: `Mapa ${mapa} registrado.` };
}

export async function removerMapa(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("separacao_mapas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/setores", "layout");
}

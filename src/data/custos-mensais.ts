"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapCustoMensal } from "./mappers";
import type { CustoMensal } from "@/domain/types";

const COLUNAS = "id, mes, nome, tipo, valor";

export async function listarLancamentosDoMes(mes: string): Promise<CustoMensal[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custos_mensais")
    .select(COLUNAS)
    .eq("mes", mes)
    .order("tipo")
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapCustoMensal);
}

export async function materializarMes(mes: string): Promise<void> {
  const supabase = await createClient();
  const { data: jaTem, error: e1 } = await supabase
    .from("custos_mensais")
    .select("id")
    .eq("mes", mes)
    .eq("tipo", "fixo")
    .limit(1);
  if (e1) throw new Error(e1.message);
  if (jaTem && jaTem.length > 0) return;

  const { data: fixos, error: e2 } = await supabase
    .from("custos_fixos")
    .select("nome, valor")
    .eq("ativo", true);
  if (e2) throw new Error(e2.message);
  if (!fixos || fixos.length === 0) {
    revalidatePath("/custos");
    return;
  }
  const rows = fixos.map((fx) => ({
    mes, nome: fx.nome, tipo: "fixo" as const, valor: fx.valor,
  }));
  const { error: e3 } = await supabase.from("custos_mensais").insert(rows);
  if (e3) throw new Error(e3.message);
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function adicionarLancamento(formData: FormData): Promise<void> {
  const registro = {
    mes: String(formData.get("mes") ?? ""),
    nome: String(formData.get("nome") ?? "").trim(),
    tipo: String(formData.get("tipo") ?? "variavel"),
    valor: Number(formData.get("valor") ?? 0),
  };
  if (!registro.mes || !registro.nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("custos_mensais").insert(registro);
  if (error) throw new Error(error.message);
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function editarLancamento(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const raw = formData.get("valor");
  if (raw === null || String(raw).trim() === "") return;
  const valor = Number(raw);
  if (Number.isNaN(valor)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("custos_mensais").update({ valor }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function removerLancamento(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("custos_mensais").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/custos");
  revalidatePath("/");
}

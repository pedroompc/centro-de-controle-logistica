"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapCustoFixo } from "./mappers";
import { assertAdmin } from "./auth";
import { primeiroDiaDoMes } from "@/domain/periodo";
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
  await assertAdmin();
  const nome = String(formData.get("nome") ?? "").trim();
  const valor = Number(formData.get("valor") ?? 0);
  if (!nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("custos_fixos").insert({ nome, valor });
  if (error) throw new Error(error.message);

  // O catálogo é só o molde; a aba Custos lê os lançamentos materializados de
  // cada mês (custos_mensais). Sem isto, o fixo novo só apareceria nos meses
  // abertos DEPOIS. Então já refletimos o novo fixo em todo mês ABERTO a partir
  // do mês atual (o atual + próximos já abertos). Meses passados ficam intactos;
  // meses futuros ainda não abertos são cobertos pelo materializarMes ao abrir.
  const mesAtual = primeiroDiaDoMes();
  const { data: abertos, error: eSel } = await supabase
    .from("custos_mensais")
    .select("mes")
    .eq("tipo", "fixo")
    .gte("mes", mesAtual);
  if (eSel) throw new Error(eSel.message);
  const meses = [...new Set((abertos ?? []).map((r) => r.mes as string))];
  if (meses.length > 0) {
    const rows = meses.map((mes) => ({ mes, nome, tipo: "fixo" as const, valor }));
    const { error: eIns } = await supabase.from("custos_mensais").insert(rows);
    if (eIns) throw new Error(eIns.message);
  }

  revalidatePath("/custos/fixos");
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function editarValorCustoFixo(formData: FormData): Promise<void> {
  await assertAdmin();
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
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("custos_fixos").update({ ativo: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/custos/fixos");
}

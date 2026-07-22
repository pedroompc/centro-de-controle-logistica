"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapReceitaDiversa } from "./mappers";
import { assertAdmin } from "./auth";
import { calcularValorDiversa } from "@/domain/receitas-metrics";
import { inicioFimDoMes, primeiroDiaDoMes } from "@/domain/periodo";
import type { ReceitaDiversa, ReceitaCategoria } from "@/domain/types";

const COLS =
  "id, data, categoria, material, quantidade, unidade, preco_unitario, valor, observacao";

export async function listarDiversasDoMes(mes: string): Promise<ReceitaDiversa[]> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receitas_diversas")
    .select(COLS)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapReceitaDiversa(row as Parameters<typeof mapReceitaDiversa>[0]));
}

export async function totalDiversasDoMes(mes: string): Promise<number> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receitas_diversas")
    .select("valor")
    .gte("data", inicio)
    .lte("data", fim);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((t, d) => t + Number(d.valor), 0);
}

export async function serieDiversasMensais(): Promise<{ mes: string; valor: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("receitas_diversas").select("data, valor");
  if (error) throw new Error(error.message);
  const porMes = new Map<string, number>();
  for (const d of data ?? []) {
    const mes = primeiroDiaDoMes(String(d.data));
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(d.valor));
  }
  return [...porMes.entries()].map(([mes, valor]) => ({ mes, valor }));
}

function parseForm(formData: FormData) {
  const data = String(formData.get("data") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "reciclagem") as ReceitaCategoria;
  const material = String(formData.get("material") ?? "").trim() || null;
  const quantidade = Number(formData.get("quantidade") ?? 0);
  const precoUnitario = Number(formData.get("preco_unitario") ?? 0);
  const valorBruto = formData.get("valor");
  const observacao = String(formData.get("observacao") ?? "").trim() || null;

  // O valor informado é o negociado e manda sobre o produto. Só cai no cálculo
  // quando não veio nada — nunca sobrescreve um valor válido do usuário.
  const valorInformado = Number(valorBruto ?? NaN);
  const valor = Number.isFinite(valorInformado) && valorInformado > 0
    ? valorInformado
    : calcularValorDiversa(quantidade, precoUnitario);

  return { data, categoria, material, quantidade, precoUnitario, valor, observacao };
}

/** Campos gravados no banco, compartilhados por criar e editar. */
function toRow(f: ReturnType<typeof parseForm>) {
  return {
    data: f.data,
    categoria: f.categoria,
    material: f.material,
    quantidade: f.quantidade || null,
    unidade: "kg",
    preco_unitario: f.precoUnitario || null,
    valor: f.valor,
    observacao: f.observacao,
  };
}

function revalidar() {
  revalidatePath("/receitas");
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function criarDiversa(formData: FormData): Promise<void> {
  await assertAdmin();
  const f = parseForm(formData);
  if (!f.data || !f.valor) return;
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_diversas").insert(toRow(f));
  if (error) throw new Error(error.message);
  revalidar();
}

export async function editarDiversa(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const f = parseForm(formData);
  if (!id || !f.data || !f.valor) return;
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_diversas").update(toRow(f)).eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}

export async function removerDiversa(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_diversas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidar();
}

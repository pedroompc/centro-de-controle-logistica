"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapReceita } from "./mappers";
import { assertAdmin } from "./auth";
import { calcularReceita } from "@/domain/receitas-metrics";
import { inicioFimDoMes, primeiroDiaDoMes } from "@/domain/periodo";
import { lerConfig } from "./config-descarregamento";
import { totalDiversasDoMes, serieDiversasMensais } from "./receitas-diversas";
import type { Receita, DescarregamentoTipo } from "@/domain/types";

const COLS =
  "id, data, fornecedor_id, peso_kg, tipo, preco_por_tonelada, receita, minimo_aplicado, observacao, fornecedores(nome)";

export interface FiltrosReceita {
  fornecedorId?: string;
  tipo?: DescarregamentoTipo;
}

export async function listarReceitasDoMes(mes: string, filtros: FiltrosReceita = {}): Promise<Receita[]> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  let q = supabase
    .from("receitas_descarregamento")
    .select(COLS)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: false });
  if (filtros.fornecedorId) q = q.eq("fornecedor_id", filtros.fornecedorId);
  if (filtros.tipo) q = q.eq("tipo", filtros.tipo);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapReceita(row as Parameters<typeof mapReceita>[0]));
}

/**
 * Receita total do mês: descarregamento + diversas. Alimenta o custo líquido do
 * dashboard, da página de custos e do resultado logístico.
 */
export async function receitaTotalDoMes(mes: string): Promise<number> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const [descarregamento, diversas] = await Promise.all([
    supabase
      .from("receitas_descarregamento")
      .select("receita")
      .gte("data", inicio)
      .lte("data", fim),
    totalDiversasDoMes(mes),
  ]);
  if (descarregamento.error) throw new Error(descarregamento.error.message);
  const somaDesc = (descarregamento.data ?? []).reduce((t, r) => t + Number(r.receita), 0);
  return somaDesc + diversas;
}

/**
 * Série mensal somando as duas origens — precisa bater com o total exibido logo
 * acima do gráfico, senão o usuário vê dois números diferentes para a mesma coisa.
 */
export async function serieReceitasMensais(qtd = 12): Promise<{ mes: string; valor: number }[]> {
  const supabase = await createClient();
  const [desc, diversas] = await Promise.all([
    supabase.from("receitas_descarregamento").select("data, receita"),
    serieDiversasMensais(),
  ]);
  if (desc.error) throw new Error(desc.error.message);
  const porMes = new Map<string, number>();
  for (const r of desc.data ?? []) {
    const mes = primeiroDiaDoMes(String(r.data));
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(r.receita));
  }
  for (const d of diversas) {
    porMes.set(d.mes, (porMes.get(d.mes) ?? 0) + d.valor);
  }
  return [...porMes.entries()]
    .map(([mes, valor]) => ({ mes, valor }))
    .sort((a, b) => a.mes.localeCompare(b.mes))
    .slice(-qtd);
}

function parseForm(formData: FormData) {
  const data = String(formData.get("data") ?? "").trim();
  const fornecedorId = String(formData.get("fornecedor_id") ?? "");
  const pesoKg = Number(formData.get("peso_kg") ?? 0);
  const tipo = String(formData.get("tipo") ?? "batido") as DescarregamentoTipo;
  const precoPorTonelada = Number(formData.get("preco_por_tonelada") ?? 0);
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  return { data, fornecedorId, pesoKg, tipo, precoPorTonelada, observacao };
}

export async function criarReceita(formData: FormData): Promise<void> {
  await assertAdmin();
  const f = parseForm(formData);
  if (!f.data || !f.fornecedorId || !f.pesoKg) return;
  const { valorMinimo } = await lerConfig();
  const receita = calcularReceita(f.pesoKg, f.precoPorTonelada, valorMinimo); // cálculo no backend
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento").insert({
    data: f.data,
    fornecedor_id: f.fornecedorId,
    peso_kg: f.pesoKg,
    tipo: f.tipo,
    preco_por_tonelada: f.precoPorTonelada,
    receita,
    minimo_aplicado: valorMinimo,
    observacao: f.observacao,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/receitas");
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function editarReceita(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const f = parseForm(formData);
  if (!id || !f.data || !f.fornecedorId || !f.pesoKg) return;
  const { valorMinimo } = await lerConfig();
  const receita = calcularReceita(f.pesoKg, f.precoPorTonelada, valorMinimo);
  const supabase = await createClient();
  const { error } = await supabase
    .from("receitas_descarregamento")
    .update({
      data: f.data,
      fornecedor_id: f.fornecedorId,
      peso_kg: f.pesoKg,
      tipo: f.tipo,
      preco_por_tonelada: f.precoPorTonelada,
      receita,
      minimo_aplicado: valorMinimo,
      observacao: f.observacao,
    })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas");
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function removerReceita(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/receitas");
  revalidatePath("/custos");
  revalidatePath("/");
}

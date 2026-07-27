"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapReceita } from "./mappers";
import { assertAdmin } from "./auth";
import { calcularReceita, calcularReceitaVolume } from "@/domain/receitas-metrics";
import { inicioFimDoMes, primeiroDiaDoMes } from "@/domain/periodo";
import { lerConfig } from "./config-descarregamento";
import { totalDiversasDoMes, serieDiversasMensais } from "./receitas-diversas";
import type { Receita, DescarregamentoTipo } from "@/domain/types";

const COLS =
  "id, data, fornecedor_id, peso_kg, tipo, preco_por_tonelada, quantidade, preco_por_unidade, receita, minimo_aplicado, observacao, fornecedores(nome)";

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
 * Receita total do mês: descarregamento + totais diários + diversas. Alimenta o
 * custo líquido do dashboard, da página de custos e do resultado logístico.
 */
export async function receitaTotalDoMes(mes: string): Promise<number> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const supabase = await createClient();
  const [descarregamento, diarios, diversas] = await Promise.all([
    supabase
      .from("receitas_descarregamento")
      .select("receita")
      .gte("data", inicio)
      .lte("data", fim),
    supabase
      .from("receitas_descarregamento_diario")
      .select("receita")
      .gte("data", inicio)
      .lte("data", fim),
    totalDiversasDoMes(mes),
  ]);
  if (descarregamento.error) throw new Error(descarregamento.error.message);
  if (diarios.error) throw new Error(diarios.error.message);
  const somaDesc = (descarregamento.data ?? []).reduce((t, r) => t + Number(r.receita), 0);
  const somaDiarios = (diarios.data ?? []).reduce((t, r) => t + Number(r.receita), 0);
  return somaDesc + somaDiarios + diversas;
}

/**
 * Série mensal somando as três origens — precisa bater com o total exibido logo
 * acima do gráfico, senão o usuário vê dois números diferentes para a mesma coisa.
 */
export async function serieReceitasMensais(qtd = 12): Promise<{ mes: string; valor: number }[]> {
  const supabase = await createClient();
  const [desc, diarios, diversas] = await Promise.all([
    supabase.from("receitas_descarregamento").select("data, receita"),
    supabase.from("receitas_descarregamento_diario").select("data, receita"),
    serieDiversasMensais(),
  ]);
  if (desc.error) throw new Error(desc.error.message);
  if (diarios.error) throw new Error(diarios.error.message);
  const porMes = new Map<string, number>();
  for (const r of desc.data ?? []) {
    const mes = primeiroDiaDoMes(String(r.data));
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(r.receita));
  }
  for (const r of diarios.data ?? []) {
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
  const quantidade = Number(formData.get("quantidade") ?? 0);
  const precoPorUnidade = Number(formData.get("preco_por_unidade") ?? 0);
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  return { data, fornecedorId, pesoKg, tipo, precoPorTonelada, quantidade, precoPorUnidade, observacao };
}

/** Valor e colunas gravadas, ramificando Volume × tipos por peso. */
function calcularEColunas(f: ReturnType<typeof parseForm>, valorMinimo: number) {
  const ehVolume = f.tipo === "volume";
  const receita = ehVolume
    ? calcularReceitaVolume(f.quantidade, f.precoPorUnidade, valorMinimo)
    : calcularReceita(f.pesoKg, f.precoPorTonelada, valorMinimo);
  return {
    data: f.data,
    fornecedor_id: f.fornecedorId,
    peso_kg: f.pesoKg,
    tipo: f.tipo,
    preco_por_tonelada: ehVolume ? 0 : f.precoPorTonelada,
    quantidade: ehVolume ? f.quantidade : null,
    preco_por_unidade: ehVolume ? f.precoPorUnidade : null,
    receita,
    minimo_aplicado: valorMinimo,
    observacao: f.observacao,
  };
}

export async function criarReceita(formData: FormData): Promise<void> {
  await assertAdmin();
  const f = parseForm(formData);
  if (!f.data || !f.fornecedorId || !f.pesoKg) return;
  if (f.tipo === "volume" && !f.quantidade) return; // Volume exige nº de caixas
  const { valorMinimo } = await lerConfig();
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento").insert(calcularEColunas(f, valorMinimo));
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
  if (f.tipo === "volume" && !f.quantidade) return;
  const { valorMinimo } = await lerConfig();
  const supabase = await createClient();
  const { error } = await supabase
    .from("receitas_descarregamento")
    .update(calcularEColunas(f, valorMinimo))
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

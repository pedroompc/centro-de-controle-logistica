"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapReceita } from "./mappers";
import { buscarTodas } from "./paginar";
import { assertAdmin } from "./auth";
import { liderDoCarro, valorDaNota } from "@/domain/receitas-metrics";
import { inicioFimDoMes, primeiroDiaDoMes } from "@/domain/periodo";
import { lerConfig } from "./config-descarregamento";
import { totalDiversasDoMes, serieDiversasMensais } from "./receitas-diversas";
import type { Receita, DescarregamentoTipo } from "@/domain/types";

const COLS =
  "id, data, fornecedor_id, peso_kg, tipo, preco_por_tonelada, quantidade, preco_por_unidade, carros, carro_id, isento, valor_fechado, receita, minimo_aplicado, observacao, fornecedores(nome)";

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
  // Sem filtro de período: passa de 1000 linhas rápido, então pagina.
  const [desc, diarios, diversas] = await Promise.all([
    buscarTodas((de, ate) =>
      supabase.from("receitas_descarregamento").select("data, receita").order("id").range(de, ate),
    ),
    buscarTodas((de, ate) =>
      supabase.from("receitas_descarregamento_diario").select("data, receita").order("id").range(de, ate),
    ),
    serieDiversasMensais(),
  ]);
  const porMes = new Map<string, number>();
  for (const r of desc) {
    const mes = primeiroDiaDoMes(String(r.data));
    porMes.set(mes, (porMes.get(mes) ?? 0) + Number(r.receita));
  }
  for (const r of diarios) {
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
  const fechadoBruto = String(formData.get("valor_fechado") ?? "").trim();
  const valorFechado = fechadoBruto === "" ? null : Number(fechadoBruto);
  const isento = formData.get("isento") === "on";
  const temCarros = formData.has("carros");
  const carrosBruto = String(formData.get("carros") ?? "").trim();
  const carros = carrosBruto === "" ? null : Math.max(0, Math.trunc(Number(carrosBruto)) || 0);
  const observacao = String(formData.get("observacao") ?? "").trim() || null;
  return { data, fornecedorId, pesoKg, tipo, precoPorTonelada, quantidade, precoPorUnidade, valorFechado, isento, temCarros, carros, observacao };
}

type NotaForm = Omit<ReturnType<typeof parseForm>, "temCarros" | "carros">;

/** Valor e colunas de preço/valor gravados, ramificando Volume × tipos por peso. */
function colunasDoValor(f: NotaForm, valorMinimo: number) {
  const ehVolume = f.tipo === "volume";
  const fechado = f.valorFechado !== null && Number.isFinite(f.valorFechado);
  const receita = valorDaNota(
    {
      tipo: f.tipo,
      pesoKg: f.pesoKg,
      precoPorTonelada: f.precoPorTonelada,
      quantidade: f.quantidade,
      precoPorUnidade: f.precoPorUnidade,
      isento: f.isento,
      valorFechado: fechado ? f.valorFechado : null,
    },
    valorMinimo,
  );
  return {
    data: f.data,
    fornecedor_id: f.fornecedorId,
    peso_kg: f.pesoKg,
    tipo: f.tipo,
    preco_por_tonelada: ehVolume ? 0 : f.precoPorTonelada,
    quantidade: ehVolume ? f.quantidade : null,
    preco_por_unidade: ehVolume && !fechado ? f.precoPorUnidade : null,
    valor_fechado: fechado,
    isento: f.isento,
    receita,
    minimo_aplicado: valorMinimo,
    observacao: f.observacao,
  };
}

const notaValida = (f: NotaForm) => !!f.data && !!f.fornecedorId && f.pesoKg > 0 && (f.tipo !== "volume" || f.quantidade > 0);

function revalidarReceitas() {
  revalidatePath("/receitas");
  revalidatePath("/custos");
  revalidatePath("/");
  revalidatePath("/setores", "layout");
}

export interface RespostaCarro {
  erro?: string;
  ok?: number; // nº de notas gravadas
}

/**
 * Lança UM carro com as suas notas. Todas recebem o mesmo `carro_id`; só a nota
 * líder conta o carro (`carros` = 1), as outras 0 — o carro é contado uma vez,
 * a receita e o peso de cada nota continuam por fornecedor.
 */
export async function criarCarro(_anterior: RespostaCarro, formData: FormData): Promise<RespostaCarro> {
  await assertAdmin();
  const data = String(formData.get("data") ?? "").trim();
  let brutas: Record<string, unknown>[];
  try {
    brutas = JSON.parse(String(formData.get("notas") ?? "[]"));
  } catch {
    return { erro: "Não consegui ler as notas. Recarregue a página e tente de novo." };
  }
  if (!data) return { erro: "Informe a data." };
  if (!Array.isArray(brutas) || brutas.length === 0) return { erro: "Adicione ao menos uma nota." };
  const notas: NotaForm[] = brutas.map((b) => {
    const num = (k: string) => Number(b[k] ?? 0) || 0;
    const fechado = b.valorFechado === null || b.valorFechado === undefined || b.valorFechado === "" ? null : Number(b.valorFechado);
    return {
      data,
      fornecedorId: String(b.fornecedorId ?? ""),
      pesoKg: num("pesoKg"),
      tipo: String(b.tipo ?? "batido") as DescarregamentoTipo,
      precoPorTonelada: num("precoPorTonelada"),
      quantidade: Math.trunc(num("quantidade")),
      precoPorUnidade: num("precoPorUnidade"),
      valorFechado: fechado,
      isento: b.isento === true,
      observacao: String(b.observacao ?? "").trim() || null,
    };
  });
  const invalida = notas.findIndex((n) => !notaValida(n));
  if (invalida >= 0) return { erro: `Nota ${invalida + 1}: falta fornecedor, peso${notas[invalida].tipo === "volume" ? " ou caixas" : ""}.` };

  const { valorMinimo } = await lerConfig();
  const carroId = crypto.randomUUID();
  const lider = liderDoCarro(notas);
  const linhas = notas.map((n, i) => ({ ...colunasDoValor(n, valorMinimo), carro_id: carroId, carros: i === lider ? 1 : 0 }));
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento").insert(linhas);
  if (error) return { erro: error.message };
  revalidarReceitas();
  return { ok: linhas.length };
}

/**
 * Edita UMA nota. Não mexe no carro dela (`carro_id`/`carros`), exceto no
 * lançamento antigo sem carro: aí o Volume informa em quantos carros veio e os
 * outros tipos voltam a 1 nota = 1 carro.
 */
export async function editarReceita(formData: FormData): Promise<void> {
  await assertAdmin();
  const id = String(formData.get("id") ?? "");
  const f = parseForm(formData);
  if (!id || !notaValida(f)) return;
  const { valorMinimo } = await lerConfig();
  const colunas: Record<string, unknown> = colunasDoValor(f, valorMinimo);
  if (f.temCarros) colunas.carros = f.tipo === "volume" ? f.carros : null;
  const supabase = await createClient();
  const { error } = await supabase.from("receitas_descarregamento").update(colunas).eq("id", id);
  if (error) throw new Error(error.message);
  revalidarReceitas();
}

/**
 * Remove uma nota. Se era a que contava o carro, passa a contagem para outra
 * nota do mesmo carro — senão o caminhão sumiria da contagem do dia.
 */
export async function removerReceita(id: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { data: nota, error: e1 } = await supabase.from("receitas_descarregamento").select("carro_id, carros").eq("id", id).maybeSingle();
  if (e1) throw new Error(e1.message);
  const { error } = await supabase.from("receitas_descarregamento").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (nota?.carro_id && Number(nota.carros) > 0) {
    const { data: resto, error: e2 } = await supabase
      .from("receitas_descarregamento")
      .select("id, tipo, peso_kg")
      .eq("carro_id", nota.carro_id);
    if (e2) throw new Error(e2.message);
    const outras = (resto ?? []).map((r) => ({ id: String(r.id), tipo: r.tipo as DescarregamentoTipo, pesoKg: Number(r.peso_kg) }));
    const i = liderDoCarro(outras);
    if (i >= 0) {
      const { error: e3 } = await supabase.from("receitas_descarregamento").update({ carros: Number(nota.carros) }).eq("id", outras[i].id);
      if (e3) throw new Error(e3.message);
    }
  }
  revalidarReceitas();
}

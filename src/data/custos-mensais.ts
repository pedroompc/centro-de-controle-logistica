"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { mapCustoMensal } from "./mappers";
import { assertAdmin } from "./auth";
import { primeiroDiaDoMes, mesAnterior, INICIO_HISTORICO } from "@/domain/periodo";
import type { CustoMensal } from "@/domain/types";

const COLUNAS = "id, mes, nome, tipo, valor, data";

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

export interface CustoMesTotais {
  mes: string; // "yyyy-mm-01"
  fixos: number;
  variaveis: number;
}

/**
 * Totais de custo fixo/variável por mês, dos últimos `qtdMeses` meses (mais antigo
 * → mais novo). Só entram meses com lançamento — é o histórico real de
 * `custos_mensais`, base do comparativo mês a mês no Dashboard.
 */
export async function serieCustosMensais(qtdMeses = 12): Promise<CustoMesTotais[]> {
  let inicio = primeiroDiaDoMes();
  for (let i = 1; i < qtdMeses; i++) inicio = mesAnterior(inicio);
  if (inicio < INICIO_HISTORICO) inicio = INICIO_HISTORICO;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custos_mensais")
    .select("mes, tipo, valor")
    .gte("mes", inicio)
    .order("mes", { ascending: true });
  if (error) throw new Error(error.message);

  const porMes = new Map<string, CustoMesTotais>();
  for (const row of data ?? []) {
    const mes = primeiroDiaDoMes(String(row.mes));
    const t = porMes.get(mes) ?? { mes, fixos: 0, variaveis: 0 };
    const valor = Number(row.valor) || 0;
    if (row.tipo === "fixo") t.fixos += valor;
    else t.variaveis += valor;
    porMes.set(mes, t);
  }
  return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

export async function materializarMes(mes: string): Promise<void> {
  await assertAdmin();
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
  await assertAdmin();
  const data = String(formData.get("data") ?? "").trim() || null;
  const registro = {
    // Se houver data (variáveis), o mês vem dela — assim o lançamento cai no
    // mês correto mesmo que a tela esteja em outro. Sem data, usa o mês da tela.
    mes: data ? primeiroDiaDoMes(data) : String(formData.get("mes") ?? ""),
    nome: String(formData.get("nome") ?? "").trim(),
    tipo: String(formData.get("tipo") ?? "variavel"),
    valor: Number(formData.get("valor") ?? 0),
    data,
  };
  if (!registro.mes || !registro.nome) return;
  const supabase = await createClient();
  const { error } = await supabase.from("custos_mensais").insert(registro);
  if (error) throw new Error(error.message);
  revalidatePath("/custos");
  revalidatePath("/");
}

export async function editarLancamento(formData: FormData): Promise<void> {
  await assertAdmin();
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
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("custos_mensais").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/custos");
  revalidatePath("/");
}

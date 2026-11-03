"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "./auth";
import { normalizarPlaca } from "@/domain/frota";
import type { CadastroFrota } from "@/domain/frota-custo";

const ausente = (code?: string) => code === "42P01" || code === "PGRST205";

/**
 * Cadastro do custo estimado da frota (migration 0028). `null` = tabelas ainda não
 * migradas ou parâmetros sem linha — o BI simplesmente não mostra o custo.
 */
export async function lerCadastroFrota(): Promise<CadastroFrota | null> {
  const supabase = await createClient();
  const [p, m, v] = await Promise.all([
    supabase.from("frota_parametros").select("preco_diesel, desgaste_mensal, manutencao_mensal").eq("id", 1).maybeSingle(),
    supabase.from("frota_consumo_modelos").select("modelo, km_por_litro").order("modelo"),
    supabase.from("frota_veiculos").select("placa, modelo, tipo").eq("ativo", true).order("placa"),
  ]);
  const erro = p.error ?? m.error ?? v.error;
  if (erro) {
    if (!ausente(erro.code)) console.error("[frota-custos] indisponível:", erro.message);
    return null;
  }
  if (!p.data) return null;
  return {
    parametros: {
      precoDiesel: Number(p.data.preco_diesel) || 0,
      desgasteMensal: Number(p.data.desgaste_mensal) || 0,
      manutencaoMensal: Number(p.data.manutencao_mensal) || 0,
    },
    modelos: (m.data ?? []).map((r) => ({ modelo: String(r.modelo), kmPorLitro: Number(r.km_por_litro) || 0 })),
    veiculos: (v.data ?? []).map((r) => ({ placa: String(r.placa), modelo: String(r.modelo), tipo: String(r.tipo) })),
  };
}

const num = (f: FormData, k: string) => Number(String(f.get(k) ?? "").replace(",", "."));
const txt = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function revalidar() {
  revalidatePath("/custos/frota");
  revalidatePath("/setores", "layout");
}

async function gravar(p: PromiseLike<{ error: { message: string } | null }>) {
  const { error } = await p;
  if (error) throw new Error(error.message);
  revalidar();
}

export async function salvarParametrosFrota(f: FormData): Promise<void> {
  await assertAdmin();
  const row = { preco_diesel: num(f, "preco_diesel"), desgaste_mensal: num(f, "desgaste_mensal"), manutencao_mensal: num(f, "manutencao_mensal") };
  if (Object.values(row).some((x) => !Number.isFinite(x) || x < 0)) return;
  const supabase = await createClient();
  await gravar(supabase.from("frota_parametros").upsert({ id: 1, ...row, atualizado_em: new Date().toISOString() }));
}

export async function salvarModeloFrota(f: FormData): Promise<void> {
  await assertAdmin();
  const modelo = txt(f, "modelo").toUpperCase();
  const kmPorLitro = num(f, "km_por_litro");
  if (!modelo || !Number.isFinite(kmPorLitro) || kmPorLitro <= 0) return;
  const supabase = await createClient();
  await gravar(supabase.from("frota_consumo_modelos").upsert({ modelo, km_por_litro: kmPorLitro, atualizado_em: new Date().toISOString() }));
}

export async function salvarVeiculoFrota(f: FormData): Promise<void> {
  await assertAdmin();
  const placa = normalizarPlaca(txt(f, "placa"));
  const modelo = txt(f, "modelo");
  const tipo = txt(f, "tipo") || "Três quarto";
  if (!placa || !modelo) return;
  const supabase = await createClient();
  await gravar(supabase.from("frota_veiculos").upsert({ placa, modelo, tipo, ativo: true, atualizado_em: new Date().toISOString() }));
}

export async function removerVeiculoFrota(placa: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  await gravar(supabase.from("frota_veiculos").update({ ativo: false, atualizado_em: new Date().toISOString() }).eq("placa", normalizarPlaca(placa)));
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "./auth";
import type { CarrosDia } from "@/domain/types";

const COLS = "data, qtd_batido, qtd_paletizado, qtd_pal_rem, qtd_volume";

type Linha = {
  data: string;
  qtd_batido: number | string;
  qtd_paletizado: number | string;
  qtd_pal_rem: number | string;
  qtd_volume: number | string;
};

function mapCarrosDia(row: Linha): CarrosDia {
  return {
    data: row.data,
    porTipo: {
      batido: Number(row.qtd_batido),
      paletizado: Number(row.qtd_paletizado),
      pal_rem: Number(row.qtd_pal_rem),
      volume: Number(row.qtd_volume),
    },
  };
}

/** Contagem real de carros dos dias entre `inicio` e `fim` (ISO, inclusivos). */
export async function listarCarrosDia(inicio: string, fim: string): Promise<CarrosDia[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("descarregos_carros_dia")
    .select(COLS)
    .gte("data", inicio)
    .lte("data", fim);
  // Tabela ainda não criada (migration 0020 não rodada): segue contando notas em
  // vez de derrubar Receitas, Painel e Tendências.
  if (error && (error.code === "42P01" || error.code === "PGRST205")) return [];
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapCarrosDia(row as Linha));
}

function revalidar() {
  revalidatePath("/receitas");
  revalidatePath("/painel");
  revalidatePath("/tendencias/descarrego");
}

/** Grava (ou substitui) a contagem de carros do dia. Valor e peso não mudam. */
export async function salvarCarrosDia(formData: FormData): Promise<void> {
  await assertAdmin();
  const data = String(formData.get("data") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return;
  const qtd = (campo: string) => {
    const n = Math.trunc(Number(formData.get(campo) ?? 0));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const supabase = await createClient();
  const { error } = await supabase.from("descarregos_carros_dia").upsert({
    data,
    qtd_batido: qtd("qtd_batido"),
    qtd_paletizado: qtd("qtd_paletizado"),
    qtd_pal_rem: qtd("qtd_pal_rem"),
    qtd_volume: qtd("qtd_volume"),
    atualizado_em: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidar();
}

/** Apaga a contagem do dia: o app volta a contar 1 lançamento como 1 carro. */
export async function removerCarrosDia(data: string): Promise<void> {
  await assertAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("descarregos_carros_dia").delete().eq("data", data);
  if (error) throw new Error(error.message);
  revalidar();
}

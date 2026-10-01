import { createClient } from "@/lib/supabase/server";
import { primeiroDiaDoMes, INICIO_HISTORICO } from "@/domain/periodo";
import type { GrupoCargo, LinhaEquipeCargo } from "@/domain/recebimento";

const FILIAL = "1";

export interface FotoEquipeCargoMes {
  mes: string; // "yyyy-mm-01"
  setor: string;
  linhas: LinhaEquipeCargo[];
}

/** Fotos por cargo do recebimento desde o início do histórico, por mês. */
export async function listarFotosEquipeCargo(): Promise<FotoEquipeCargoMes[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("efetivo_mensal_cargo")
    .select("mes, setor, grupo, ativos, custo_ativos")
    .eq("filial", FILIAL)
    .gte("mes", INICIO_HISTORICO)
    .order("mes", { ascending: true });
  if (error) {
    // Tabela ainda não migrada / Supabase fora: o painel usa a equipe de hoje.
    console.error("[efetivo-mensal-cargo] indisponível:", error.message);
    return [];
  }
  const porMes = new Map<string, FotoEquipeCargoMes>();
  for (const r of data ?? []) {
    const mes = primeiroDiaDoMes(String(r.mes));
    const foto = porMes.get(mes) ?? { mes, setor: String(r.setor), linhas: [] };
    foto.linhas.push({
      grupo: String(r.grupo) as GrupoCargo,
      ativos: Number(r.ativos) || 0,
      custoAtivos: Number(r.custo_ativos) || 0,
    });
    porMes.set(mes, foto);
  }
  return [...porMes.values()];
}

/**
 * Grava/atualiza a foto do MÊS CORRENTE (upsert). Best-effort: qualquer falha
 * (tabela ausente, offline) é engolida — nunca quebra o painel.
 */
export async function registrarFotoEquipeCargo(setor: string, linhas: LinhaEquipeCargo[]): Promise<void> {
  if (linhas.length === 0) return;
  try {
    const supabase = await createClient();
    const mes = primeiroDiaDoMes();
    const now = new Date().toISOString();
    const { error } = await supabase.from("efetivo_mensal_cargo").upsert(
      linhas.map((l) => ({
        mes,
        filial: FILIAL,
        setor,
        grupo: l.grupo,
        ativos: l.ativos,
        custo_ativos: l.custoAtivos,
        atualizado_em: now,
      })),
      { onConflict: "mes,filial,setor,grupo" },
    );
    if (error) console.error("[efetivo-mensal-cargo] falha ao registrar foto:", error.message);
  } catch (e) {
    console.error("[efetivo-mensal-cargo] falha ao registrar foto:", e);
  }
}

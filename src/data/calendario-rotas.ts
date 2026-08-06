import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Rota } from "@/domain/pedidos-a-faturar/tipos";

const COLUNAS =
  "cidade, uf, regiao_operacional, rota, grupo_rota, dia_saida_rota, dia_limite_pedido, janela_entrega, aliases, observacao";

const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

export function mapRowToRota(row: Record<string, unknown>): Rota {
  return {
    cidade: String(row.cidade),
    uf: (row.uf as string) ?? null,
    regiaoOperacional: (row.regiao_operacional as string) ?? null,
    rota: (row.rota as string) ?? null,
    grupoRota: (row.grupo_rota as string) ?? null,
    diaSaidaRota: arr(row.dia_saida_rota),
    diaLimitePedido: (row.dia_limite_pedido as string) ?? null,
    janelaEntrega: arr(row.janela_entrega),
    aliases: arr(row.aliases),
    observacao: (row.observacao as string) ?? null,
  };
}

/** Lê o calendário inteiro (tabela pequena). Memoizado por request. */
export const getRotas = cache(async (): Promise<Rota[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendario_rotas").select(COLUNAS);
  if (error) {
    console.error("[calendario-rotas] Supabase indisponível:", error.message);
    return [];
  }
  return (data ?? []).map((r) => mapRowToRota(r as Record<string, unknown>));
});

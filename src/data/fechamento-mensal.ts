import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { listarLancamentosDoMes } from "./custos-mensais";
import { receitaTotalDoMes } from "./receitas";
import { contarFaltasDoMes } from "./faltas";
import { somaLancamentos } from "@/domain/custos-metrics";
import { primeiroDiaDoMes } from "@/domain/periodo";

/**
 * Totais mensais de origem Supabase que o dashboard agrega. `custo_efetivo` NÃO
 * entra: vem do efetivo atual, é lido ao vivo e é barato. Ver migration 0020.
 */
export interface FechamentoMensal {
  mes: string; // 1º dia do mês, ISO
  custoFixo: number;
  custoVariavel: number;
  receitaTotal: number;
  faltas: number;
}

const COLUNAS = "mes, custo_fixo, custo_variavel, receita_total, faltas";

function rowToFechamento(row: Record<string, unknown>): FechamentoMensal {
  return {
    mes: primeiroDiaDoMes(String(row.mes)),
    custoFixo: Number(row.custo_fixo) || 0,
    custoVariavel: Number(row.custo_variavel) || 0,
    receitaTotal: Number(row.receita_total) || 0,
    faltas: Number(row.faltas) || 0,
  };
}

/** Recalcula os totais do mês direto das tabelas de origem (caro para meses antigos). */
async function computar(mes: string): Promise<FechamentoMensal> {
  const [lancamentos, receitaTotal, faltas] = await Promise.all([
    listarLancamentosDoMes(mes),
    receitaTotalDoMes(mes),
    contarFaltasDoMes(mes),
  ]);
  return {
    mes,
    custoFixo: somaLancamentos(lancamentos, "fixo"),
    custoVariavel: somaLancamentos(lancamentos, "variavel"),
    receitaTotal,
    faltas,
  };
}

/**
 * Fechamento de um mês. Para mês FECHADO: lê a foto do Supabase; se faltar,
 * recalcula das origens uma vez e grava (lazy backfill). Para o mês corrente:
 * recalcula sempre ao vivo, sem gravar (o mês ainda muda). A foto é apagada nas
 * server actions de escrita (ver fechamento-cache.ts), então uma correção de mês
 * anterior — lançamento atrasado — refaz a foto no acesso seguinte.
 * Memoizado por `mes` dentro da requisição.
 */
export const getFechamentoMensal = cache(async (mes: string): Promise<FechamentoMensal> => {
  const supabase = await createClient();
  const fechado = mes < primeiroDiaDoMes();

  if (fechado) {
    const { data, error } = await supabase
      .from("fechamento_mensal")
      .select(COLUNAS)
      .eq("mes", mes)
      .maybeSingle();
    if (error) console.error("[fechamento-mensal] Supabase indisponível:", error.message);
    if (data) return rowToFechamento(data as Record<string, unknown>);
  }

  const f = await computar(mes);

  if (fechado) {
    const { error } = await supabase.from("fechamento_mensal").upsert(
      {
        mes,
        custo_fixo: f.custoFixo,
        custo_variavel: f.custoVariavel,
        receita_total: f.receitaTotal,
        faltas: f.faltas,
      },
      { onConflict: "mes" },
    );
    if (error) console.error("[fechamento-mensal] falha ao gravar foto:", error.message);
  }

  return f;
});

import { createClient } from "@/lib/supabase/server";
import { mapTotalDiario } from "./mappers";
import { agregarPorMes, type PontoDescarregoMensal } from "@/domain/descarregamento-tendencia";
import { primeiroDiaDoMes, mesAnterior, inicioFimDoMes, INICIO_HISTORICO } from "@/domain/periodo";

const COLS =
  "id, data, descarregos, qtd_batido, qtd_paletizado, qtd_pal_rem, qtd_volume, peso_kg, receita, observacao";

/**
 * Série mensal de descarrego dos últimos `qtdMeses` meses, INCLUINDO o mês
 * corrente (em andamento). Diferente da Tendências de faturamento, que só usa
 * meses fechados: o histórico de descarrego é curto (começa em julho/2026) e o
 * gestor quer enxergar o mês corrente. A UI marca o último mês como parcial.
 *
 * Retorna só os meses que têm lançamento — sem inventar meses zerados, que num
 * dado de digitação manual seriam "não lancei" e não "não descarreguei".
 */
export async function serieDescarregoMensal(qtdMeses = 12): Promise<PontoDescarregoMensal[]> {
  const atual = primeiroDiaDoMes(); // mês corrente "yyyy-mm-01"
  let inicioMes = atual;
  for (let i = 1; i < qtdMeses; i++) inicioMes = mesAnterior(inicioMes);
  // Nunca antes do histórico consolidado.
  if (inicioMes < INICIO_HISTORICO) inicioMes = INICIO_HISTORICO;

  const inicio = inicioMes; // já é dia 01
  const fim = inicioFimDoMes(atual).fim; // último dia do mês corrente

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("receitas_descarregamento_diario")
    .select(COLS)
    .gte("data", inicio)
    .lte("data", fim)
    .order("data", { ascending: true });
  if (error) throw new Error(error.message);

  const diarios = (data ?? []).map((row) =>
    mapTotalDiario(row as Parameters<typeof mapTotalDiario>[0]),
  );
  return agregarPorMes(diarios);
}

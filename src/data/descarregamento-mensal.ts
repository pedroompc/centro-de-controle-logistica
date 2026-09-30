import { createClient } from "@/lib/supabase/server";
import { mapTotalDiario } from "./mappers";
import { buscarTodas } from "./paginar";
import { listarCarrosDia } from "./carros-dia";
import {
  agregarPorMes,
  diariosDosLancamentos,
  type PontoDescarregoMensal,
} from "@/domain/descarregamento-tendencia";
import type { DescarregamentoTipo } from "@/domain/types";
import { primeiroDiaDoMes, mesAnterior, inicioFimDoMes, INICIO_HISTORICO } from "@/domain/periodo";

const COLS =
  "id, data, descarregos, qtd_batido, qtd_paletizado, qtd_pal_rem, qtd_volume, peso_kg, receita, observacao";

/**
 * Série mensal de descarrego dos últimos `qtdMeses` meses, INCLUINDO o mês
 * corrente (em andamento). Diferente da Tendências de faturamento, que só usa
 * meses fechados: o histórico de descarrego é curto (começa em julho/2026) e o
 * gestor quer enxergar o mês corrente. A UI marca o último mês como parcial.
 *
 * Soma as duas formas de lançar descarrego: total do dia e por fornecedor. No
 * lançamento por fornecedor, os carros vêm da contagem real do dia quando ela
 * existe (um lançamento é uma nota, não um caminhão).
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
  // As duas formas de lançar descarrego: total do dia e por fornecedor.
  const [totais, lancamentos, carros] = await Promise.all([
    buscarTodas((de, ate) =>
      supabase
        .from("receitas_descarregamento_diario")
        .select(COLS)
        .gte("data", inicio)
        .lte("data", fim)
        .order("id")
        .range(de, ate),
    ),
    buscarTodas((de, ate) =>
      supabase
        .from("receitas_descarregamento")
        .select("data, tipo, quantidade, peso_kg, receita")
        .gte("data", inicio)
        .lte("data", fim)
        .order("id")
        .range(de, ate),
    ),
    listarCarrosDia(inicio, fim),
  ]);

  const diarios = totais.map((row) =>
    mapTotalDiario(row as Parameters<typeof mapTotalDiario>[0]),
  );
  const porFornecedor = diariosDosLancamentos(
    lancamentos.map((r) => ({
      data: String(r.data),
      tipo: r.tipo as DescarregamentoTipo,
      quantidade: r.quantidade == null ? null : Number(r.quantidade),
      pesoKg: Number(r.peso_kg),
      receita: Number(r.receita),
    })),
    carros,
  );
  return agregarPorMes([...diarios, ...porFornecedor]);
}

// Números da casa no BI Geral: efetivo, faturamento líquido, clientes atendidos
// e custo logístico — as MESMAS fontes e regras do Início (custo pelo
// custoLogisticoDoPeriodo, faturamento pelo getResumoFaturamentoPeriodo).
import { listarFuncionarios } from "@/data/funcionarios";
import { listarLancamentosDoMes, serieCustosMensais } from "@/data/custos-mensais";
import { serieEfetivoSetorMensal } from "@/data/efetivo-mensal";
import { getResumoFaturamentoPeriodo } from "@/data/faturamento-mensal";
import { custoLogisticoDoPeriodo } from "@/domain/custo-periodo";
import { ehAluguelGalpao } from "@/domain/custo-grupos";
import { totaisEfetivoPorMes } from "@/domain/efetivo";
import { percentualCustoLogistico } from "@/domain/faturamento";
import { hojeISO } from "@/domain/fechamento";
import { INICIO_HISTORICO, mesDoPeriodo, mesesDoPeriodo, temHistoricoSupabase, type Periodo } from "@/domain/periodo";

export interface ResumoCasa {
  efetivo: number | null; // ativos hoje
  erro: string | null; // Supabase fora: tudo vem null e a tela mostra "indisponível"
  faturamentoLiquido: number | null;
  clientesAtendidos: number | null; // cliente distinto por dia (PDVs atendidos)
  custoLogistico: number | null;
  custoSobreFat: number | null; // fração 0..1
  aluguel: number | null; // aluguel do galpão dentro do custo logístico
}

export async function carregarResumoCasa(periodo: Periodo): Promise<ResumoCasa> {
  try {
    return await ler(periodo);
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    console.error("[resumo-casa]", erro);
    return { efetivo: null, faturamentoLiquido: null, clientesAtendidos: null, custoLogistico: null, custoSobreFat: null, aluguel: null, erro };
  }
}

async function ler(periodo: Periodo): Promise<ResumoCasa> {
  const mesUnico = mesDoPeriodo(periodo);
  const comHistorico = temHistoricoSupabase(periodo);
  const qtdSerie = Math.max(12, mesesDoPeriodo({ de: INICIO_HISTORICO, ate: hojeISO() }).length);
  const [funcionarios, lancamentosMes, serieSetor, serieCustos, fat] = await Promise.all([
    listarFuncionarios(),
    comHistorico && mesUnico ? listarLancamentosDoMes(mesUnico) : Promise.resolve([]),
    serieEfetivoSetorMensal(qtdSerie),
    serieCustosMensais(qtdSerie),
    getResumoFaturamentoPeriodo(periodo.de, periodo.ate).catch(() => null),
  ]);

  const ativos = funcionarios.filter((f) => f.status === "ativo");
  const efTotais = totaisEfetivoPorMes(serieSetor);
  const custo = custoLogisticoDoPeriodo({
    comHistorico,
    mesUnico,
    lancamentosMes,
    folhaAtual: ativos.reduce((t, f) => t + f.custoMensal, 0),
    meses: mesesDoPeriodo(periodo),
    folhaPorMes: new Map(efTotais.map((t) => [t.mes, t.folhaTotal])),
    custosPorMes: new Map(serieCustos.map((c) => [c.mes, c])),
  });
  const venda = fat?.vendaLiquida ?? null;
  const meses = new Set(mesesDoPeriodo(periodo));
  const aluguel =
    custo === null
      ? null
      : mesUnico
        ? lancamentosMes.filter((c) => ehAluguelGalpao(c.nome)).reduce((t, c) => t + c.valor, 0)
        : serieCustos.filter((c) => meses.has(c.mes)).reduce((t, c) => t + c.aluguel, 0);
  return {
    efetivo: ativos.length, // como o Início: ativos de HOJE (não há foto confiável por mês)
    faturamentoLiquido: venda,
    clientesAtendidos: fat?.atendimentos ?? null,
    custoLogistico: custo,
    custoSobreFat: custo === null || venda === null ? null : percentualCustoLogistico(custo, venda),
    aluguel,
    erro: null,
  };
}

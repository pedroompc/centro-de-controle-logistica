// Relatório geral de custos (aba Custos → Relatório geral). Mesmas fontes do
// Início: folha pela foto mensal por setor (mês corrente = cadastro vivo),
// fixos/variáveis de custos_mensais e faturamento = venda líquida do Winthor
// (meses fechados pela foto que se auto-cura; mês corrente ao vivo).
import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { listarLancamentosDosMeses } from "@/data/custos-mensais";
import { serieEfetivoSetorMensal } from "@/data/efetivo-mensal";
import { getResumoFaturamentoDashboard, getSerieTendencias } from "@/data/faturamento-mensal";
import { getFaturadoEntregaRetira } from "@/data/faturamento";
import { fotoSetorAtual } from "@/domain/efetivo";
import { liquidoEntregaRetira } from "@/domain/faturamento";
import { custoGruposDoMes, type CustoGruposMes } from "@/domain/custo-grupos";
import { hojeISO } from "@/domain/fechamento";
import { INICIO_HISTORICO, mesesDoPeriodo, primeiroDiaDoMes } from "@/domain/periodo";

export interface MesRelatorio {
  custo: CustoGruposMes;
  vendaLiquida: number | null;
  atendimentos: number | null; // PDVs atendidos (cliente distinto por dia)
  fechado: boolean;
}

export interface RelatorioCustos {
  ano: number;
  meses: MesRelatorio[]; // do início do histórico (ou janeiro) até o mês corrente
  /** Venda líquida do mês corrente que saiu em entrega (sem retira), até hoje. */
  vendaEntregaMesAtual: number | null;
  /** Faturamento do mês corrente caiu (Winthor fora). */
  faturamentoMesAtualIndisponivel: boolean;
}

export async function carregarRelatorioCustos(hoje: Date = new Date()): Promise<RelatorioCustos> {
  const ano = hoje.getFullYear();
  const mesAtual = primeiroDiaDoMes(hoje);
  const inicioAno = `${ano}-01-01`;
  const de = inicioAno > INICIO_HISTORICO ? inicioAno : INICIO_HISTORICO;
  const meses = mesesDoPeriodo({ de, ate: hojeISO() });

  const [funcionarios, setores, lancamentos, fotos, serieFat, fatAtual, entregaRetira] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
    listarLancamentosDosMeses(meses),
    serieEfetivoSetorMensal(meses.length + 1),
    getSerieTendencias(12),
    getResumoFaturamentoDashboard(mesAtual).catch(() => null),
    getFaturadoEntregaRetira(mesAtual, hojeISO()),
  ]);

  const folhaAtual = fotoSetorAtual(funcionarios, setores).map((l) => ({ setor: l.setor, custo: l.custoAtivos, ativos: l.ativos }));
  const fatPorMes = new Map(serieFat.map((p) => [p.mes, p]));

  const linhas: MesRelatorio[] = meses.map((mes) => {
    const folha =
      mes === mesAtual
        ? folhaAtual
        : fotos.filter((f) => f.mes === mes).map((f) => ({ setor: f.setor, custo: f.custoAtivos, ativos: f.ativos }));
    const custo = custoGruposDoMes(
      mes,
      folha,
      lancamentos.filter((l) => l.mes === mes),
    );
    if (mes === mesAtual) {
      return { custo, vendaLiquida: fatAtual?.vendaLiquida ?? null, atendimentos: fatAtual?.atendimentos ?? null, fechado: false };
    }
    const f = fatPorMes.get(mes);
    return { custo, vendaLiquida: f?.vendaLiquida ?? null, atendimentos: f?.atendimentos ?? null, fechado: true };
  });

  return {
    ano,
    meses: linhas,
    vendaEntregaMesAtual: entregaRetira ? liquidoEntregaRetira(entregaRetira).entrega : null,
    faturamentoMesAtualIndisponivel: fatAtual === null,
  };
}

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
import { INICIO_HISTORICO, inicioFimDoMes, mesAnterior, mesesDoPeriodo, primeiroDiaDoMes } from "@/domain/periodo";
import { lerBaseRegioes, type BaseRegioesMes } from "@/data/custo-regioes";
import { serieReceitasMensais } from "@/data/receitas";
import { lerEntregasMeses } from "@/data/winthor-entregas";

export interface MesRelatorio {
  custo: CustoGruposMes;
  vendaLiquida: number | null;
  atendimentos: number | null; // PDVs atendidos (cliente distinto por dia)
  entregas: number | null; // entregas do BI Motoristas (cliente distinto por viagem, sem retira); null = Winthor fora
  receita: number | null; // receitas logísticas do mês (descarrego + totais do dia + diversas); null = indisponível
  fechado: boolean;
}

export interface RelatorioCustos {
  ano: number;
  meses: MesRelatorio[]; // do início do histórico (ou janeiro) até o mês corrente
  /** Venda líquida do mês corrente que saiu em entrega (sem retira), até hoje. */
  vendaEntregaMesAtual: number | null;
  /** Quem está na folha do mês corrente, por nome de setor (ativos, maior custo primeiro). */
  pessoasPorSetor: Record<string, { nome: string; cargo: string; custo: number }[]>;
  /** Base por região do último mês fechado (`null` = Winthor fora). */
  regioes: { mes: string; base: BaseRegioesMes | null };
  /** Faturamento do mês corrente caiu (Winthor fora). */
  faturamentoMesAtualIndisponivel: boolean;
}

export async function carregarRelatorioCustos(hoje: Date = new Date()): Promise<RelatorioCustos> {
  const ano = hoje.getFullYear();
  const mesAtual = primeiroDiaDoMes(hoje);
  const inicioAno = `${ano}-01-01`;
  const de = inicioAno > INICIO_HISTORICO ? inicioAno : INICIO_HISTORICO;
  const meses = mesesDoPeriodo({ de, ate: hojeISO() });

  const mesRegioes = mesAnterior(mesAtual);
  const faixaRegioes = inicioFimDoMes(mesRegioes);
  const [funcionarios, setores, lancamentos, fotos, serieFat, fatAtual, entregaRetira, baseRegioes, serieReceitas, entregasMeses] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
    listarLancamentosDosMeses(meses),
    serieEfetivoSetorMensal(meses.length + 1),
    getSerieTendencias(12),
    getResumoFaturamentoDashboard(mesAtual).catch(() => null),
    getFaturadoEntregaRetira(mesAtual, hojeISO()),
    lerBaseRegioes(faixaRegioes.inicio, faixaRegioes.fim),
    serieReceitasMensais(24).catch(() => null),
    lerEntregasMeses(meses[0], mesAtual).catch(() => null),
  ]);
  const entregasPorMes = entregasMeses ? new Map(entregasMeses.map((e) => [e.mes, e.entregas])) : null;
  const entregasDo = (mes: string) => (entregasPorMes ? (entregasPorMes.get(mes) ?? null) : null);
  const receitaPorMes = serieReceitas ? new Map(serieReceitas.map((r) => [r.mes, r.valor])) : null;
  const receitaDo = (mes: string) => (receitaPorMes ? (receitaPorMes.get(mes) ?? 0) : null);

  const folhaAtual = fotoSetorAtual(funcionarios, setores).map((l) => ({ setor: l.setor, custo: l.custoAtivos, ativos: l.ativos }));
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));
  const pessoasPorSetor: RelatorioCustos["pessoasPorSetor"] = {};
  for (const f of funcionarios) {
    if (f.status !== "ativo") continue;
    const setor = nomeSetor.get(f.setorId);
    if (!setor) continue;
    (pessoasPorSetor[setor] ??= []).push({ nome: f.nome, cargo: f.cargo, custo: f.custoMensal });
  }
  for (const l of Object.values(pessoasPorSetor)) l.sort((a, b) => b.custo - a.custo);
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
      return { custo, vendaLiquida: fatAtual?.vendaLiquida ?? null, atendimentos: fatAtual?.atendimentos ?? null, entregas: entregasDo(mes), receita: receitaDo(mes), fechado: false };
    }
    const f = fatPorMes.get(mes);
    return { custo, vendaLiquida: f?.vendaLiquida ?? null, atendimentos: f?.atendimentos ?? null, entregas: entregasDo(mes), receita: receitaDo(mes), fechado: true };
  });

  return {
    ano,
    meses: linhas,
    vendaEntregaMesAtual: entregaRetira ? liquidoEntregaRetira(entregaRetira).entrega : null,
    pessoasPorSetor,
    regioes: { mes: mesRegioes, base: baseRegioes },
    faturamentoMesAtualIndisponivel: fatAtual === null,
  };
}

import Link from "next/link";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL, formatPercent } from "@/domain/format";
import {
  primeiroDiaDoMes,
  mesAnterior,
  formatMesAno,
  inicioFimDoMes,
  limitarAoHistorico,
} from "@/domain/periodo";
import { MesNav } from "@/components/mes-nav";
import { listarLancamentosDoMes, serieCustosMensais } from "@/data/custos-mensais";
import { serieEfetivoSetorMensal, registrarFotoEfetivoSetor } from "@/data/efetivo-mensal";
import { receitaTotalDoMes } from "@/data/receitas";
import { totalDoMes, somaLancamentos } from "@/domain/custos-metrics";
import { custoLiquido } from "@/domain/receitas-metrics";
import { fotoSetorAtual, totaisEfetivoPorMes } from "@/domain/efetivo";
import { compararSerie, type PontoValor } from "@/domain/comparativo-mensal";
import { PageHeader, StatCard, Card, SectionTitle } from "@/components/ui";
import { Suspense } from "react";
import {
  FaturamentoCards,
  FaturamentoSkeleton,
  FaturamentoDetalhe,
  FaturamentoDetalheSkeleton,
} from "./faturamento-cards";
import { ListaComparativa, type LinhaComparativa, type SerieMes } from "./dashboard-comparativos";

const inteiro = new Intl.NumberFormat("pt-BR");
const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotuloMes = (mes: string) => `${MES_ABREV[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;

interface DeltaProps {
  deltaTexto: string | null;
  deltaSubindo: boolean;
  deltaPositivo: boolean;
}

/** Variação de um valor vs o mês anterior, já formatada (regra: custo ↑ = ruim). */
function fmtDelta(atual: number, anterior: number | null, maiorEhBom: boolean): DeltaProps {
  if (anterior === null) return { deltaTexto: null, deltaSubindo: false, deltaPositivo: true };
  const dif = atual - anterior;
  const subindo = dif > 0;
  const positivo = maiorEhBom ? dif >= 0 : dif <= 0;
  const sinal = dif >= 0 ? "+" : "−";
  const texto = anterior !== 0 ? `${sinal}${formatPercent(Math.abs(dif / anterior))}` : `${sinal}${formatBRL(Math.abs(dif))}`;
  return { deltaTexto: texto, deltaSubindo: subindo, deltaPositivo: positivo };
}

/** Série mês a mês (drill-down), com a variação de cada mês vs o anterior. */
function serieMeses(
  pontos: PontoValor[],
  maiorEhBom: boolean,
  subPorMes?: Map<string, string>,
): SerieMes[] {
  return compararSerie(pontos).map((p) => {
    const temDelta = p.deltaAbs !== null;
    const subindo = (p.deltaAbs ?? 0) > 0;
    const positivo = maiorEhBom ? (p.deltaAbs ?? 0) >= 0 : (p.deltaAbs ?? 0) <= 0;
    const sinal = (p.deltaAbs ?? 0) >= 0 ? "+" : "−";
    const texto = !temDelta
      ? null
      : p.deltaFrac !== null
        ? `${sinal}${formatPercent(Math.abs(p.deltaFrac))}`
        : `${sinal}${formatBRL(Math.abs(p.deltaAbs ?? 0))}`;
    return {
      rotulo: rotuloMes(p.mes),
      display: formatBRL(p.valor),
      sub: subPorMes?.get(p.mes),
      deltaTexto: texto,
      deltaSubindo: subindo,
      deltaPositivo: positivo,
    };
  });
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  // Default = mês atual; qualquer mês pedido é preso à janela navegável.
  const mesAtual = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const mesFechado = mesAtual < primeiroDiaDoMes();
  const mesAnt = mesAnterior(mesAtual);
  const [funcionarios, setores, faltas, lancamentosMes, receitasMes] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
    listarFaltas(),
    listarLancamentosDoMes(mesAtual),
    receitaTotalDoMes(mesAtual),
  ]);
  const { inicio, fim } = inicioFimDoMes(mesAtual);

  const ativos = funcionarios.filter((f) => f.status === "ativo");
  const custoEfetivo = ativos.reduce((t, f) => t + f.custoMensal, 0);
  const faltasMes = faltasNoPeriodo(faltas, funcionarios.map((f) => f.id), inicio, fim);
  const fixos = somaLancamentos(lancamentosMes, "fixo");
  const variaveis = somaLancamentos(lancamentosMes, "variavel");
  const custoTotalMes = totalDoMes(lancamentosMes, custoEfetivo);
  const custoLiquidoMes = custoLiquido(custoTotalMes, receitasMes);

  // Congela a foto do mês corrente por setor (best-effort) e lê o histórico —
  // fonte do comparativo mês a mês. Registrar ANTES de ler p/ o mês entrar já.
  await registrarFotoEfetivoSetor(fotoSetorAtual(funcionarios, setores));
  const [serieSetor, serieCustos] = await Promise.all([
    serieEfetivoSetorMensal(12),
    serieCustosMensais(12),
  ]);

  // Índices por mês para lookups do comparativo.
  const efTotais = totaisEfetivoPorMes(serieSetor);
  const efTotalPorMes = new Map(efTotais.map((t) => [t.mes, t]));
  const custosPorMes = new Map(serieCustos.map((c) => [c.mes, c]));
  // setor (nome) → mês → { custo, ativos }
  const setorPorMes = new Map<string, Map<string, { custo: number; ativos: number }>>();
  for (const r of serieSetor) {
    const m = setorPorMes.get(r.setor) ?? new Map<string, { custo: number; ativos: number }>();
    m.set(r.mes, { custo: r.custoAtivos, ativos: r.ativos });
    setorPorMes.set(r.setor, m);
  }

  // Custo + efetivo por setor numa leitura só: barra pelo custo, nº de pessoas ao lado.
  const setorPorCusto = setores
    .map((s) => {
      const custo = custoDoSetor(funcionarios, s.id);
      const efetivo = ativos.filter((f) => f.setorId === s.id).length;
      return { nome: s.nome, custo, efetivo };
    })
    .filter((i) => i.custo > 0 || i.efetivo > 0)
    .sort((a, b) => b.custo - a.custo)
    .slice(0, 8);
  const maxCustoSetor = Math.max(1, ...setorPorCusto.map((s) => s.custo));

  // Linhas comparativas: setores (barra âmbar, chip de pessoas, drill-down por mês).
  const linhasSetor: LinhaComparativa[] = setorPorCusto.map((s) => {
    const meses = setorPorMes.get(s.nome) ?? new Map<string, { custo: number; ativos: number }>();
    const custoAnt = meses.get(mesAnt)?.custo ?? null;
    const pontos: PontoValor[] = efTotais
      .map((t) => t.mes)
      .filter((m) => meses.has(m))
      .map((m) => ({ mes: m, valor: meses.get(m)!.custo }));
    const subPorMes = new Map([...meses].map(([m, v]) => [m, `${inteiro.format(v.ativos)} pes.`]));
    return {
      chave: `setor:${s.nome}`,
      label: s.nome,
      valorDisplay: formatBRL(s.custo),
      sub: `${s.efetivo}`,
      barra: s.custo / maxCustoSetor,
      ...fmtDelta(s.custo, custoAnt, false),
      serie: serieMeses(pontos, false, subPorMes),
    };
  });

  // Composição do mês: Salário (foto de efetivo), Fixos e Variáveis (histórico
  // real de custos_mensais), com Total no fim.
  const salarioAnt = efTotalPorMes.get(mesAnt)?.folhaTotal ?? null;
  const fixosAnt = custosPorMes.get(mesAnt)?.fixos ?? null;
  const variaveisAnt = custosPorMes.get(mesAnt)?.variaveis ?? null;
  const totalAnt =
    salarioAnt !== null && fixosAnt !== null && variaveisAnt !== null
      ? salarioAnt + fixosAnt + variaveisAnt
      : null;
  const maxComp = Math.max(1, custoEfetivo, fixos, variaveis);

  const pontosSalario: PontoValor[] = efTotais.map((t) => ({ mes: t.mes, valor: t.folhaTotal }));
  const pontosFixos: PontoValor[] = serieCustos.map((c) => ({ mes: c.mes, valor: c.fixos }));
  const pontosVar: PontoValor[] = serieCustos.map((c) => ({ mes: c.mes, valor: c.variaveis }));
  const pontosTotal: PontoValor[] = efTotais
    .filter((t) => custosPorMes.has(t.mes))
    .map((t) => {
      const c = custosPorMes.get(t.mes)!;
      return { mes: t.mes, valor: t.folhaTotal + c.fixos + c.variaveis };
    });

  const linhasComposicao: LinhaComparativa[] = [
    {
      chave: "salario", label: "Salário (efetivo)", valorDisplay: formatBRL(custoEfetivo),
      barra: custoEfetivo / maxComp, ...fmtDelta(custoEfetivo, salarioAnt, false), serie: serieMeses(pontosSalario, false),
    },
    {
      chave: "fixos", label: "Custos fixos", valorDisplay: formatBRL(fixos),
      barra: fixos / maxComp, ...fmtDelta(fixos, fixosAnt, false), serie: serieMeses(pontosFixos, false),
    },
    {
      chave: "variaveis", label: "Custos variáveis", valorDisplay: formatBRL(variaveis),
      barra: variaveis / maxComp, ...fmtDelta(variaveis, variaveisAnt, false), serie: serieMeses(pontosVar, false),
    },
    {
      chave: "total", label: "Total do mês", valorDisplay: formatBRL(custoTotalMes),
      destaque: true, ...fmtDelta(custoTotalMes, totalAnt, false), serie: serieMeses(pontosTotal, false),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Visão geral"
        subtitle={`Operação de logística · ${formatMesAno(mesAtual)}${mesFechado ? " · mês fechado" : " · em andamento"}`}
      >
        <Link
          href="/fechamento"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
            <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
            <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
          </svg>
          Compartilhar fechamento
        </Link>
        <MesNav mes={mesAtual} hrefFor={(m) => `/?mes=${m}`} />
      </PageHeader>

      <Suspense fallback={<FaturamentoSkeleton />}>
        <FaturamentoCards mes={mesAtual} custoTotalMes={custoTotalMes} />
      </Suspense>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Funcionários ativos" value={`${ativos.length}`} hint={`${funcionarios.length} no efetivo`} accent="navy" href="/funcionarios" />
        <StatCard label="Custo bruto do mês" value={formatBRL(custoTotalMes)} accent="gold" href="/custos" />
        <StatCard label="Custo líquido do mês" value={formatBRL(custoLiquidoMes)} hint={`Receitas: ${formatBRL(receitasMes)}`} accent="green" href="/receitas" />
        <StatCard label="Faltas no mês" value={`${faltasMes}`} accent="red" href={`/faltas?mes=${mesAtual}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>Custo e efetivo por setor</SectionTitle>
            <span className="text-xs text-slate-400">Δ vs {formatMesAno(mesAnt)} · clique para ver mês a mês</span>
          </div>
          <ListaComparativa linhas={linhasSetor} tone="gold" />
        </Card>

        <Card className="p-6">
          <div className="mb-2 flex items-center justify-between">
            <SectionTitle>Composição do mês</SectionTitle>
            <span className="text-xs text-slate-400">Δ vs {formatMesAno(mesAnt)}</span>
          </div>
          <ListaComparativa linhas={linhasComposicao} tone="navy" />
        </Card>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        Custos fixos/variáveis comparam com o histórico real de lançamentos. Salário e efetivo por
        setor usam a foto mensal do efetivo (julho e agosto semeados; daqui pra frente, capturada a cada mês).
      </p>

      <div className="mt-6">
        <Suspense fallback={<FaturamentoDetalheSkeleton />}>
          <FaturamentoDetalhe mes={mesAtual} />
        </Suspense>
      </div>
    </div>
  );
}

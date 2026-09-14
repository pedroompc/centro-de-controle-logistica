import Link from "next/link";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import {
  primeiroDiaDoMes,
  formatMesAno,
  inicioFimDoMes,
  limitarAoHistorico,
} from "@/domain/periodo";
import { MesNav } from "@/components/mes-nav";
import { listarLancamentosDoMes } from "@/data/custos-mensais";
import { receitaTotalDoMes } from "@/data/receitas";
import { totalDoMes, somaLancamentos } from "@/domain/custos-metrics";
import { custoLiquido } from "@/domain/receitas-metrics";
import { PageHeader, StatCard, Card, SectionTitle, BarList, SetorBarList } from "@/components/ui";
import { Suspense } from "react";
import {
  FaturamentoCards,
  FaturamentoSkeleton,
  FaturamentoDetalhe,
  FaturamentoDetalheSkeleton,
} from "./faturamento-cards";

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const sp = await searchParams;
  // Default = mês atual; qualquer mês pedido é preso à janela navegável.
  const mesAtual = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const mesFechado = mesAtual < primeiroDiaDoMes();
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

  // Custo + efetivo por setor numa leitura só: barra pelo custo, nº de pessoas ao lado.
  const setorPorCusto = setores
    .map((s) => {
      const custo = custoDoSetor(funcionarios, s.id);
      const efetivo = ativos.filter((f) => f.setorId === s.id).length;
      return { label: s.nome, custo, custoDisplay: formatBRL(custo), efetivo, href: `/setores/${s.id}` };
    })
    .filter((i) => i.custo > 0 || i.efetivo > 0)
    .sort((a, b) => b.custo - a.custo)
    .slice(0, 8);

  const composicao = [
    { label: "Salário (efetivo)", value: custoEfetivo, display: formatBRL(custoEfetivo) },
    { label: "Custos fixos", value: fixos, display: formatBRL(fixos) },
    { label: "Custos variáveis", value: variaveis, display: formatBRL(variaveis) },
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
          <SectionTitle>Custo e efetivo por setor</SectionTitle>
          <SetorBarList items={setorPorCusto} />
        </Card>

        <Card className="p-6">
          <SectionTitle>Composição do mês</SectionTitle>
          <BarList items={composicao} tone="navy" />
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
            <span className="text-sm font-medium text-slate-500">Total do mês</span>
            <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold text-[#141a4d]">
              {formatBRL(custoTotalMes)}
            </span>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Suspense fallback={<FaturamentoDetalheSkeleton />}>
          <FaturamentoDetalhe mes={mesAtual} />
        </Suspense>
      </div>
    </div>
  );
}

import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual, primeiroDiaDoMes, formatMesAno } from "@/domain/periodo";
import { listarLancamentosDoMes } from "@/data/custos-mensais";
import { totalDoMes, somaLancamentos } from "@/domain/custos-metrics";
import { PageHeader, StatCard, Card, SectionTitle, BarList } from "@/components/ui";
import { Suspense } from "react";
import {
  FaturamentoCards,
  FaturamentoSkeleton,
  FaturamentoDetalhe,
  FaturamentoDetalheSkeleton,
} from "./faturamento-cards";

export default async function Dashboard() {
  const mesAtual = primeiroDiaDoMes();
  const [funcionarios, setores, faltas, lancamentosMes] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
    listarFaltas(),
    listarLancamentosDoMes(mesAtual),
  ]);
  const { inicio, fim } = inicioFimMesAtual();

  const ativos = funcionarios.filter((f) => f.status === "ativo");
  const custoEfetivo = ativos.reduce((t, f) => t + f.custoMensal, 0);
  const faltasMes = faltasNoPeriodo(faltas, funcionarios.map((f) => f.id), inicio, fim);
  const fixos = somaLancamentos(lancamentosMes, "fixo");
  const variaveis = somaLancamentos(lancamentosMes, "variavel");
  const custoTotalMes = totalDoMes(lancamentosMes, custoEfetivo);

  const custoPorSetor = setores
    .map((s) => ({
      label: s.nome,
      value: custoDoSetor(funcionarios, s.id),
      display: formatBRL(custoDoSetor(funcionarios, s.id)),
      href: `/setores/${s.id}`,
    }))
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const efetivoPorSetor = setores
    .map((s) => {
      const n = ativos.filter((f) => f.setorId === s.id).length;
      return { label: s.nome, value: n, display: `${n}`, href: `/setores/${s.id}` };
    })
    .filter((i) => i.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const composicao = [
    { label: "Salário (efetivo)", value: custoEfetivo, display: formatBRL(custoEfetivo) },
    { label: "Custos fixos", value: fixos, display: formatBRL(fixos) },
    { label: "Custos variáveis", value: variaveis, display: formatBRL(variaveis) },
  ];

  return (
    <div>
      <PageHeader title="Visão geral" subtitle={`Operação de logística · ${formatMesAno(mesAtual)}`} />

      <Suspense fallback={<FaturamentoSkeleton />}>
        <FaturamentoCards custoTotalMes={custoTotalMes} />
      </Suspense>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Funcionários ativos" value={`${ativos.length}`} hint={`${funcionarios.length} no efetivo`} accent="navy" href="/funcionarios" />
        <StatCard label="Custo total do mês" value={formatBRL(custoTotalMes)} accent="gold" href="/custos" />
        <StatCard label="Faltas no mês" value={`${faltasMes}`} accent="red" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-2">
          <SectionTitle>Custo por setor</SectionTitle>
          <BarList items={custoPorSetor} tone="gold" />
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
        <Card className="p-6">
          <SectionTitle>Efetivo por setor</SectionTitle>
          <BarList items={efetivoPorSetor} tone="navy" />
        </Card>
      </div>

      <div className="mt-6">
        <Suspense fallback={<FaturamentoDetalheSkeleton />}>
          <FaturamentoDetalhe />
        </Suspense>
      </div>
    </div>
  );
}

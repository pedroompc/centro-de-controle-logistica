import Link from "next/link";
import { notFound } from "next/navigation";
import { listarSetores } from "@/data/setores";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual } from "@/domain/periodo";
import { PageHeader, StatCard, Card, BackLink, StatusBadge } from "@/components/ui";

export default async function SetorDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [setores, funcionarios, faltas] = await Promise.all([
    listarSetores(),
    listarFuncionarios(),
    listarFaltas(),
  ]);
  const setor = setores.find((s) => s.id === id);
  if (!setor) notFound();

  const doSetor = funcionarios.filter((f) => f.setorId === id);
  const head = headcountPorStatus(funcionarios, id);
  const { inicio, fim } = inicioFimMesAtual();
  const totalFaltas = faltasNoPeriodo(faltas, doSetor.map((f) => f.id), inicio, fim);

  return (
    <div>
      <BackLink href="/setores">Setores</BackLink>
      <PageHeader title={setor.nome} subtitle={`${doSetor.length} funcionários neste setor`} />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Custo mensal (ativos)" value={formatBRL(custoDoSetor(funcionarios, id))} accent="gold" />
        <StatCard
          label="Pessoas"
          value={`${head.ativo}`}
          hint={`ativos${head.afastado ? ` · ${head.afastado} afastados` : ""}`}
          accent="navy"
        />
        <StatCard label="Faltas no mês" value={`${totalFaltas}`} accent="red" />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">Cargo</th>
                <th className="px-5 py-3 font-semibold">Custo mensal</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {doSetor.map((f) => (
                <tr key={f.id} className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/funcionarios/${f.id}`} className="font-medium text-[#141a4d] hover:text-amber-600">
                      {f.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{f.cargo}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{formatBRL(f.custoMensal)}</td>
                  <td className="px-5 py-3"><StatusBadge status={f.status} /></td>
                </tr>
              ))}
              {doSetor.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-400">Nenhum funcionário neste setor.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

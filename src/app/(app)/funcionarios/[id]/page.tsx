import { notFound } from "next/navigation";
import { buscarFuncionario } from "@/data/funcionarios";
import { faltasDoFuncionario, excluirFalta } from "@/data/faltas";
import { listarSetores } from "@/data/setores";
import { formatBRL, formatDataBR } from "@/domain/format";
import { PageHeader, StatCard, Card, SectionTitle, BackLink, StatusBadge, Pill } from "@/components/ui";
import { FuncionarioForm } from "../funcionario-form";
import { FaltaForm } from "./falta-form";

export default async function FuncionarioDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [funcionario, setores, faltas] = await Promise.all([
    buscarFuncionario(id),
    listarSetores(),
    faltasDoFuncionario(id),
  ]);
  if (!funcionario) notFound();
  const setor = setores.find((s) => s.id === funcionario.setorId);

  return (
    <div>
      <BackLink href="/funcionarios">Funcionários</BackLink>
      <PageHeader title={funcionario.nome} subtitle={`${funcionario.cargo} · ${setor?.nome ?? "—"}`}>
        <StatusBadge status={funcionario.status} />
        <FuncionarioForm setores={setores} inicial={funcionario} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Custo mensal" value={formatBRL(funcionario.custoMensal)} accent="gold" />
        <StatCard label="Admissão" value={formatDataBR(funcionario.dataAdmissao)} accent="navy" />
        <StatCard label="Total de faltas" value={`${faltas.length}`} accent={faltas.length > 0 ? "red" : "navy"} />
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Faltas</SectionTitle>
          <FaltaForm funcionarioId={funcionario.id} />
        </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Data</th>
                  <th className="px-5 py-3 font-semibold">Tipo</th>
                  <th className="px-5 py-3 font-semibold">Observação</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {faltas.map((falta) => (
                  <tr key={falta.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-5 py-3 tabular-nums text-slate-700">{formatDataBR(falta.data)}</td>
                    <td className="px-5 py-3"><Pill tone="slate">{falta.tipo}</Pill></td>
                    <td className="px-5 py-3 text-slate-500">{falta.observacao ?? "—"}</td>
                    <td className="px-5 py-3 text-right">
                      <form action={excluirFalta.bind(null, falta.id)}>
                        <button className="text-sm font-medium text-rose-600 hover:text-rose-700">Remover</button>
                      </form>
                    </td>
                  </tr>
                ))}
                {faltas.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-400">Sem faltas registradas.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </div>
  );
}

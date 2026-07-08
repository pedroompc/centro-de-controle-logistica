import Link from "next/link";
import { notFound } from "next/navigation";
import { listarSetores } from "@/data/setores";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual } from "@/domain/periodo";

export default async function SetorDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">{setor.nome}</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Custo total (ativos)</p>
          <p className="text-lg font-bold">{formatBRL(custoDoSetor(funcionarios, id))}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Pessoas</p>
          <p className="text-lg font-bold">
            {head.ativo} ativos · {head.afastado} afastados · {head.desligado} desligados
          </p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Faltas no mês</p>
          <p className="text-lg font-bold">{totalFaltas}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Cargo</th>
              <th className="px-4 py-2">Custo mensal</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {doSetor.map((f) => (
              <tr key={f.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/funcionarios/${f.id}`} className="font-medium text-slate-800">
                    {f.nome}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{f.cargo}</td>
                <td className="px-4 py-2 text-slate-600">{formatBRL(f.custoMensal)}</td>
                <td className="px-4 py-2 text-slate-600">{f.status}</td>
              </tr>
            ))}
            {doSetor.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                Nenhum funcionário neste setor.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

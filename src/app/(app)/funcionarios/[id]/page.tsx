import { notFound } from "next/navigation";
import { buscarFuncionario } from "@/data/funcionarios";
import { faltasDoFuncionario, excluirFalta } from "@/data/faltas";
import { listarSetores } from "@/data/setores";
import { formatBRL, formatDataBR } from "@/domain/format";
import { FuncionarioForm } from "../funcionario-form";
import { FaltaForm } from "./falta-form";

export default async function FuncionarioDetalhe({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [funcionario, setores, faltas] = await Promise.all([
    buscarFuncionario(id),
    listarSetores(),
    faltasDoFuncionario(id),
  ]);
  if (!funcionario) notFound();
  const setor = setores.find((s) => s.id === funcionario.setorId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{funcionario.nome}</h1>
          <p className="text-slate-500">
            {funcionario.cargo} · {setor?.nome ?? "—"} · {funcionario.status}
          </p>
        </div>
        <FuncionarioForm setores={setores} inicial={funcionario} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Custo mensal</p>
          <p className="text-lg font-bold">{formatBRL(funcionario.custoMensal)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Admissão</p>
          <p className="text-lg font-bold">{formatDataBR(funcionario.dataAdmissao)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Total de faltas</p>
          <p className="text-lg font-bold">{faltas.length}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Faltas</h2>
        <FaltaForm funcionarioId={funcionario.id} />
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">Observação</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {faltas.map((falta) => (
                <tr key={falta.id} className="border-b last:border-0">
                  <td className="px-4 py-2">{formatDataBR(falta.data)}</td>
                  <td className="px-4 py-2">{falta.tipo}</td>
                  <td className="px-4 py-2 text-slate-500">{falta.observacao ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <form action={excluirFalta.bind(null, falta.id)}>
                      <button className="text-sm text-red-600">Remover</button>
                    </form>
                  </td>
                </tr>
              ))}
              {faltas.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                  Sem faltas registradas.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

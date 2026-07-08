import Link from "next/link";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { formatBRL } from "@/domain/format";
import { FuncionarioForm } from "./funcionario-form";

export default async function FuncionariosPage({
  searchParams,
}: {
  searchParams: Promise<{ setor?: string; status?: string; q?: string }>;
}) {
  const { setor, status, q } = await searchParams;
  const [funcionarios, setores] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
  ]);
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));

  const filtrados = funcionarios.filter((f) => {
    if (setor && f.setorId !== setor) return false;
    if (status && f.status !== status) return false;
    if (q && !f.nome.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Funcionários</h1>
        <FuncionarioForm setores={setores} />
      </div>

      <form className="flex flex-wrap gap-2 text-sm">
        <input name="q" defaultValue={q} placeholder="Buscar por nome"
          className="rounded-lg border border-slate-300 px-3 py-2" />
        <select name="setor" defaultValue={setor ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2">
          <option value="">Todos os setores</option>
          {setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
        </select>
        <select name="status" defaultValue={status ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2">
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="afastado">Afastado</option>
          <option value="desligado">Desligado</option>
        </select>
        <button className="rounded-lg border px-4 py-2 text-slate-700">Filtrar</button>
      </form>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Cargo</th>
              <th className="px-4 py-2">Setor</th>
              <th className="px-4 py-2">Custo mensal</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((f) => (
              <tr key={f.id} className="border-b last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2">
                  <Link href={`/funcionarios/${f.id}`} className="font-medium text-slate-800">
                    {f.nome}
                  </Link>
                </td>
                <td className="px-4 py-2 text-slate-600">{f.cargo}</td>
                <td className="px-4 py-2 text-slate-600">{nomeSetor.get(f.setorId) ?? "—"}</td>
                <td className="px-4 py-2 text-slate-600">{formatBRL(f.custoMensal)}</td>
                <td className="px-4 py-2 text-slate-600">{f.status}</td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                Nenhum funcionário encontrado.
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

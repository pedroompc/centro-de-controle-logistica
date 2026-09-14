import Link from "next/link";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { formatBRL } from "@/domain/format";
import { PageHeader, Card, StatusBadge } from "@/components/ui";
import { isAdmin } from "@/data/auth";
import { FuncionarioForm } from "./funcionario-form";

const inputCls =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export default async function FuncionariosPage({
  searchParams,
}: {
  searchParams: Promise<{ setor?: string; status?: string; q?: string }>;
}) {
  const { setor, status, q } = await searchParams;
  const [funcionarios, setores, admin] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
    isAdmin(),
  ]);
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));

  const filtrados = funcionarios.filter((f) => {
    if (setor && f.setorId !== setor) return false;
    if (status && f.status !== status) return false;
    if (q && !f.nome.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Funcionários" subtitle={`${filtrados.length} de ${funcionarios.length} no efetivo`}>
        <Link
          href="/faltas"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
            <path d="M3 9h18M8 3v3M16 3v3" />
            <path d="m10 13 4 4M14 13l-4 4" />
          </svg>
          Faltas
        </Link>
        {admin && <FuncionarioForm setores={setores} />}
      </PageHeader>

      <Card className="mb-4 p-3">
        <form method="get" className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <input
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome"
            className={`${inputCls} col-span-2 sm:min-w-[12rem] sm:flex-1`}
          />
          <select name="setor" defaultValue={setor ?? ""} className={`${inputCls} w-full sm:w-auto`}>
            <option value="">Todos os setores</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
          <select name="status" defaultValue={status ?? ""} className={`${inputCls} w-full sm:w-auto`}>
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="afastado">Afastado</option>
            <option value="desligado">Desligado</option>
          </select>
          <button className="col-span-2 rounded-xl bg-[#181d55] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#10143f] sm:col-span-1 sm:py-2">
            Filtrar
          </button>
        </form>
      </Card>

      <Card className="overflow-hidden">
        {/* Desktop: tabela */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Nome</th>
                <th className="px-5 py-3 font-semibold">Cargo</th>
                <th className="px-5 py-3 font-semibold">Setor</th>
                <th className="px-5 py-3 font-semibold">Custo mensal</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((f) => (
                <tr key={f.id} className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <Link href={`/funcionarios/${f.id}`} className="font-medium text-[#141a4d] hover:text-amber-600">
                      {f.nome}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{f.cargo}</td>
                  <td className="px-5 py-3 text-slate-500">{nomeSetor.get(f.setorId) ?? "—"}</td>
                  <td className="px-5 py-3 tabular-nums text-slate-600">{formatBRL(f.custoMensal)}</td>
                  <td className="px-5 py-3"><StatusBadge status={f.status} /></td>
                </tr>
              ))}
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400">Nenhum funcionário encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile: cards */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {filtrados.map((f) => (
            <li key={f.id}>
              <Link
                href={`/funcionarios/${f.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#141a4d]">{f.nome}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {f.cargo} · {nomeSetor.get(f.setorId) ?? "—"}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="tabular-nums text-sm font-semibold text-slate-700">{formatBRL(f.custoMensal)}</span>
                  <StatusBadge status={f.status} />
                </div>
              </Link>
            </li>
          ))}
          {filtrados.length === 0 && (
            <li className="px-4 py-8 text-center text-slate-400">Nenhum funcionário encontrado.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

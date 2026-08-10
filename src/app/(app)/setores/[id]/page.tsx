import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { listarSetores, renomearSetor, excluirSetor } from "@/data/setores";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarFaltas } from "@/data/faltas";
import { isAdmin } from "@/data/auth";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual } from "@/domain/periodo";
import { PageHeader, StatCard, Card, SectionTitle, BackLink, StatusBadge } from "@/components/ui";
import { BotaoConfirmar } from "@/components/confirm-button";

export default async function SetorDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [setores, funcionarios, faltas, admin] = await Promise.all([
    listarSetores(),
    listarFuncionarios(),
    listarFaltas(),
    isAdmin(),
  ]);
  const setor = setores.find((s) => s.id === id);
  if (!setor) notFound();

  async function excluir() {
    "use server";
    await excluirSetor(id);
    redirect("/setores");
  }

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

      {admin && (
        <Card className="mt-6 p-6">
          <SectionTitle>Gerenciar setor</SectionTitle>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <form action={renomearSetor} className="flex w-full items-end gap-2 sm:w-auto">
              <input type="hidden" name="id" value={setor.id} />
              <label className="flex-1 text-sm sm:flex-none">
                <span className="mb-1 block text-xs font-medium text-slate-500">Nome do setor</span>
                <input
                  name="nome"
                  required
                  defaultValue={setor.nome}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
                />
              </label>
              <button className="shrink-0 rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
                Salvar
              </button>
            </form>
            <form action={excluir}>
              <BotaoConfirmar
                confirmacao={`Excluir o setor "${setor.nome}"? Só é possível se não houver funcionários nele.`}
                className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
              >
                Excluir setor
              </BotaoConfirmar>
            </form>
          </div>
        </Card>
      )}

      <Card className="mt-6 overflow-hidden">
        {/* Desktop: tabela */}
        <div className="hidden overflow-x-auto md:block">
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

        {/* Mobile: cards */}
        <ul className="divide-y divide-slate-100 md:hidden">
          {doSetor.map((f) => (
            <li key={f.id}>
              <Link
                href={`/funcionarios/${f.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition active:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-[#141a4d]">{f.nome}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{f.cargo}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="tabular-nums text-sm font-semibold text-slate-700">{formatBRL(f.custoMensal)}</span>
                  <StatusBadge status={f.status} />
                </div>
              </Link>
            </li>
          ))}
          {doSetor.length === 0 && (
            <li className="px-4 py-8 text-center text-slate-400">Nenhum funcionário neste setor.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

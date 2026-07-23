import Link from "next/link";
import { listarSetores } from "@/data/setores";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual } from "@/domain/periodo";
import { PageHeader, Pill } from "@/components/ui";
import { isAdmin } from "@/data/auth";
import { SetorForm } from "./setor-form";

export default async function SetoresPage() {
  const [setores, funcionarios, faltas, admin] = await Promise.all([
    listarSetores(),
    listarFuncionarios(),
    listarFaltas(),
    isAdmin(),
  ]);
  const { inicio, fim } = inicioFimMesAtual();

  return (
    <div>
      <PageHeader title="Setores" subtitle={`${setores.length} setores na operação`}>
        {admin && <SetorForm />}
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {setores.map((setor) => {
          const head = headcountPorStatus(funcionarios, setor.id);
          const ids = funcionarios.filter((f) => f.setorId === setor.id).map((f) => f.id);
          const totalFaltas = faltasNoPeriodo(faltas, ids, inicio, fim);
          return (
            <Link
              key={setor.id}
              href={`/setores/${setor.id}`}
              className="group @container rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <h2 className="font-[family-name:var(--font-sora)] font-bold text-[#141a4d]">{setor.nome}</h2>
                <span className="text-slate-300 transition group-hover:text-amber-500">→</span>
              </div>
              <p className="mt-3 font-[family-name:var(--font-sora)] text-[clamp(1rem,10cqi,1.5rem)] font-extrabold tracking-tight tabular-nums whitespace-nowrap text-[#141a4d]">
                {formatBRL(custoDoSetor(funcionarios, setor.id))}
              </p>
              <p className="text-xs text-slate-400">custo mensal (ativos)</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <Pill tone="green">{head.ativo} ativos</Pill>
                {head.afastado > 0 && <Pill tone="gold">{head.afastado} afastados</Pill>}
                <Pill tone={totalFaltas > 0 ? "red" : "slate"}>{totalFaltas} faltas/mês</Pill>
              </div>
            </Link>
          );
        })}
        {setores.length === 0 && <p className="text-slate-500">Nenhum setor cadastrado ainda.</p>}
      </div>
    </div>
  );
}

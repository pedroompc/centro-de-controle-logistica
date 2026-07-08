import Link from "next/link";
import { listarSetores } from "@/data/setores";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, headcountPorStatus, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual } from "@/domain/periodo";
import { SetorForm } from "./setor-form";

export default async function SetoresPage() {
  const [setores, funcionarios, faltas] = await Promise.all([
    listarSetores(),
    listarFuncionarios(),
    listarFaltas(),
  ]);
  const { inicio, fim } = inicioFimMesAtual();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Setores</h1>
        <SetorForm />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {setores.map((setor) => {
          const head = headcountPorStatus(funcionarios, setor.id);
          const ids = funcionarios
            .filter((f) => f.setorId === setor.id)
            .map((f) => f.id);
          const totalFaltas = faltasNoPeriodo(faltas, ids, inicio, fim);
          return (
            <Link
              key={setor.id}
              href={`/setores/${setor.id}`}
              className="rounded-xl border bg-white p-4 shadow-sm hover:shadow"
            >
              <h2 className="font-semibold text-slate-800">{setor.nome}</h2>
              <p className="mt-2 text-lg font-bold text-slate-900">
                {formatBRL(custoDoSetor(funcionarios, setor.id))}
              </p>
              <p className="text-sm text-slate-500">
                {head.ativo} ativos · {head.afastado} afastados · {head.desligado} desligados
              </p>
              <p className="text-sm text-slate-500">Faltas no mês: {totalFaltas}</p>
            </Link>
          );
        })}
        {setores.length === 0 && (
          <p className="text-slate-500">Nenhum setor cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}

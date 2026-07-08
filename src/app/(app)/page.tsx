import Link from "next/link";
import { listarFuncionarios } from "@/data/funcionarios";
import { listarSetores } from "@/data/setores";
import { listarFaltas } from "@/data/faltas";
import { custoDoSetor, faltasNoPeriodo } from "@/domain/metrics";
import { formatBRL } from "@/domain/format";
import { inicioFimMesAtual } from "@/domain/periodo";

export default async function Dashboard() {
  const [funcionarios, setores, faltas] = await Promise.all([
    listarFuncionarios(),
    listarSetores(),
    listarFaltas(),
  ]);
  const { inicio, fim } = inicioFimMesAtual();

  const ativos = funcionarios.filter((f) => f.status === "ativo");
  const custoTotal = ativos.reduce((t, f) => t + f.custoMensal, 0);
  const faltasMes = faltasNoPeriodo(faltas, funcionarios.map((f) => f.id), inicio, fim);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Funcionários ativos</p>
          <p className="text-2xl font-bold">{ativos.length}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Custo total do efetivo</p>
          <p className="text-2xl font-bold">{formatBRL(custoTotal)}</p>
        </div>
        <div className="rounded-xl border bg-white p-4">
          <p className="text-sm text-slate-500">Faltas no mês</p>
          <p className="text-2xl font-bold">{faltasMes}</p>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Por setor</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {setores.map((setor) => {
            const ids = funcionarios.filter((f) => f.setorId === setor.id).map((f) => f.id);
            return (
              <Link key={setor.id} href={`/setores/${setor.id}`}
                className="rounded-xl border bg-white p-4 shadow-sm hover:shadow">
                <h3 className="font-semibold text-slate-800">{setor.nome}</h3>
                <p className="mt-2 text-lg font-bold">{formatBRL(custoDoSetor(funcionarios, setor.id))}</p>
                <p className="text-sm text-slate-500">
                  Faltas no mês: {faltasNoPeriodo(faltas, ids, inicio, fim)}
                </p>
              </Link>
            );
          })}
          {setores.length === 0 && (
            <p className="text-slate-500">Cadastre setores para ver os números aqui.</p>
          )}
        </div>
      </section>
    </div>
  );
}

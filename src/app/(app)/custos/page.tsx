import Link from "next/link";
import { listarLancamentosDoMes } from "@/data/custos-mensais";
import { listarFuncionarios } from "@/data/funcionarios";
import { custoTotalAtivos } from "@/domain/metrics";
import { somaLancamentos, totalDoMes } from "@/domain/custos-metrics";
import { formatBRL } from "@/domain/format";
import { primeiroDiaDoMes, mesAnterior, mesProximo, formatMesAno } from "@/domain/periodo";
import { AbrirMesButton } from "./abrir-mes-button";
import { LancarVariavelForm } from "./lancar-variavel-form";
import { editarLancamento, removerLancamento } from "@/data/custos-mensais";

export default async function CustosPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const { mes: mesParam } = await searchParams;
  const mes = mesParam ? primeiroDiaDoMes(mesParam) : primeiroDiaDoMes();

  const [lancamentos, funcionarios] = await Promise.all([
    listarLancamentosDoMes(mes),
    listarFuncionarios(),
  ]);

  const salario = custoTotalAtivos(funcionarios);
  const fixos = lancamentos.filter((l) => l.tipo === "fixo");
  const variaveis = lancamentos.filter((l) => l.tipo === "variavel");
  const total = totalDoMes(lancamentos, salario);
  const mesVazio = fixos.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Custos</h1>
        <div className="flex items-center gap-3 text-sm">
          <Link href={`/custos?mes=${mesAnterior(mes)}`} className="rounded-lg border px-3 py-1">◀</Link>
          <span className="font-semibold text-slate-700">{formatMesAno(mes)}</span>
          <Link href={`/custos?mes=${mesProximo(mes)}`} className="rounded-lg border px-3 py-1">▶</Link>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <p className="text-sm text-slate-500">Total do mês</p>
        <p className="text-3xl font-bold text-slate-900">{formatBRL(total)}</p>
        <p className="mt-1 text-sm text-slate-500">
          Fixos {formatBRL(somaLancamentos(lancamentos, "fixo"))} · Variáveis {formatBRL(somaLancamentos(lancamentos, "variavel"))} · Salário {formatBRL(salario)}
        </p>
      </div>

      {mesVazio && (
        <div className="flex items-center justify-between rounded-xl border border-dashed bg-white p-4">
          <p className="text-slate-600">Este mês ainda não foi aberto (sem custos fixos gerados).</p>
          <AbrirMesButton mes={mes} />
        </div>
      )}

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-800">Fixos</h2>
        <BlocoLancamentos itens={fixos} vazio="Nenhum custo fixo neste mês." />
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Variáveis</h2>
          <LancarVariavelForm mes={mes} />
        </div>
        <BlocoLancamentos itens={variaveis} vazio="Nenhum custo variável lançado." />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-slate-800">Salário (do efetivo)</h2>
        <div className="rounded-xl border bg-white p-4 text-slate-700">
          {formatBRL(salario)} · <Link href="/funcionarios" className="text-slate-500 underline">ver efetivo</Link>
        </div>
      </section>
    </div>
  );
}

function BlocoLancamentos({ itens, vazio }: { itens: import("@/domain/types").CustoMensal[]; vazio: string }) {
  if (itens.length === 0) return <p className="text-sm text-slate-500">{vazio}</p>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b bg-slate-50 text-slate-500">
          <tr><th className="px-4 py-2">Item</th><th className="px-4 py-2">Valor</th><th className="px-4 py-2"></th></tr>
        </thead>
        <tbody>
          {itens.map((l) => (
            <tr key={l.id} className="border-b last:border-0">
              <td className="px-4 py-2 text-slate-700">{l.nome}</td>
              <td className="px-4 py-2">
                <form action={editarLancamento} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <input name="valor" type="number" step="0.01" min="0" defaultValue={l.valor}
                    className="w-32 rounded-lg border border-slate-300 px-2 py-1" />
                  <button className="text-xs text-slate-600 underline">salvar</button>
                </form>
              </td>
              <td className="px-4 py-2 text-right">
                <form action={removerLancamento.bind(null, l.id)}>
                  <button className="text-sm text-red-600">remover</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import Link from "next/link";
import type { CustoMensal } from "@/domain/types";
import { listarLancamentosDoMes, editarLancamento, removerLancamento } from "@/data/custos-mensais";
import { listarFuncionarios } from "@/data/funcionarios";
import { receitaTotalDoMes } from "@/data/receitas";
import { custoLiquido } from "@/domain/receitas-metrics";
import { custoTotalAtivos } from "@/domain/metrics";
import { somaLancamentos, totalDoMes } from "@/domain/custos-metrics";
import { formatBRL, formatDataBR } from "@/domain/format";
import { primeiroDiaDoMes, mesAnterior, mesProximo, formatMesAno } from "@/domain/periodo";
import { PageHeader, Card, SectionTitle, BarList } from "@/components/ui";
import { isAdmin } from "@/data/auth";
import { AbrirMesButton } from "./abrir-mes-button";
import { LancarVariavelForm } from "./lancar-variavel-form";

export default async function CustosPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes: mesParam } = await searchParams;
  const mes = mesParam ? primeiroDiaDoMes(mesParam) : primeiroDiaDoMes();

  const [lancamentos, funcionarios, receitas, admin] = await Promise.all([
    listarLancamentosDoMes(mes),
    listarFuncionarios(),
    receitaTotalDoMes(mes),
    isAdmin(),
  ]);

  const salario = custoTotalAtivos(funcionarios);
  const somaFixos = somaLancamentos(lancamentos, "fixo");
  const somaVariaveis = somaLancamentos(lancamentos, "variavel");
  const fixos = lancamentos.filter((l) => l.tipo === "fixo");
  const variaveis = lancamentos.filter((l) => l.tipo === "variavel");
  const total = totalDoMes(lancamentos, salario); // custos brutos
  const liquido = custoLiquido(total, receitas);
  const mesVazio = fixos.length === 0;

  const composicao = [
    { label: "Salário", value: salario, display: formatBRL(salario) },
    { label: "Fixos", value: somaFixos, display: formatBRL(somaFixos) },
    { label: "Variáveis", value: somaVariaveis, display: formatBRL(somaVariaveis) },
  ];

  return (
    <div>
      <PageHeader title="Custos" subtitle="Custos da operação, mês a mês">
        <Link href={`/custos?mes=${mesAnterior(mes)}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50">◀</Link>
        <span className="min-w-[7rem] text-center text-sm font-semibold text-[#141a4d]">{formatMesAno(mes)}</span>
        <Link href={`/custos?mes=${mesProximo(mes)}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50">▶</Link>
      </PageHeader>

      <Card className="p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="@container">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total do mês</p>
            <p className="mt-1 font-[family-name:var(--font-sora)] text-[clamp(1.5rem,11cqi,2.25rem)] font-extrabold tracking-tight tabular-nums whitespace-nowrap text-[#141a4d]">
              {formatBRL(total)}
            </p>
            <p className="mt-1 text-sm text-slate-400">{formatMesAno(mes)}</p>
          </div>
          <div className="md:border-l md:border-slate-100 md:pl-6">
            <BarList items={composicao} tone="navy" />
          </div>
        </div>
      </Card>

      <Card className="mt-4 p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <SectionTitle>Resultado logístico do mês</SectionTitle>
          <Link href="/receitas" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">ver receitas →</Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="@container rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Custos brutos</p>
            <p className="mt-1 font-[family-name:var(--font-sora)] text-[clamp(1rem,10cqi,1.5rem)] font-extrabold tabular-nums whitespace-nowrap text-[#141a4d]">{formatBRL(total)}</p>
            <p className="mt-1 text-xs text-slate-400">Salário + fixos + variáveis</p>
          </div>
          <div className="@container rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700">
              <span aria-hidden>▼</span> Receitas logísticas
            </p>
            <p className="mt-1 font-[family-name:var(--font-sora)] text-[clamp(1rem,10cqi,1.5rem)] font-extrabold tabular-nums whitespace-nowrap text-emerald-700">− {formatBRL(receitas)}</p>
            <p className="mt-1 text-xs text-emerald-600/80">Compensação demonstrada — não altera os custos</p>
          </div>
          <div className="@container rounded-xl border-2 border-amber-300 bg-amber-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">= Custo líquido</p>
            <p className="mt-1 font-[family-name:var(--font-sora)] text-[clamp(1rem,10cqi,1.5rem)] font-extrabold tabular-nums whitespace-nowrap text-[#141a4d]">{formatBRL(liquido)}</p>
            <p className="mt-1 text-xs text-amber-700/80">Após abatimento das receitas</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-400">A receita é apresentada como compensação no resultado; os lançamentos de custo permanecem intactos.</p>
      </Card>

      {mesVazio && admin && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
          <p className="text-sm text-amber-800">Este mês ainda não foi aberto — gere os custos fixos para começar.</p>
          <AbrirMesButton mes={mes} />
        </div>
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Fixos</SectionTitle>
          <Link href="/custos/fixos" className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
            {admin ? "Gerenciar fixos" : "Ver fixos"}
          </Link>
        </div>
        <BlocoLancamentos itens={fixos} vazio="Nenhum custo fixo neste mês." admin={admin} />
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Variáveis</SectionTitle>
          {admin && <LancarVariavelForm mes={mes} />}
        </div>
        <BlocoLancamentos itens={variaveis} vazio="Nenhum custo variável lançado." admin={admin} mostrarData />
      </section>

      <section className="mt-6">
        <SectionTitle>Salário (do efetivo)</SectionTitle>
        <Card className="flex items-center justify-between p-5">
          <span className="font-[family-name:var(--font-sora)] text-xl font-bold text-[#141a4d]">{formatBRL(salario)}</span>
          <Link href="/funcionarios" className="text-sm font-medium text-amber-600 hover:text-amber-700">ver efetivo →</Link>
        </Card>
      </section>
    </div>
  );
}

const editInput =
  "w-32 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

function BlocoLancamentos({
  itens,
  vazio,
  admin,
  mostrarData = false,
}: {
  itens: CustoMensal[];
  vazio: string;
  admin: boolean;
  mostrarData?: boolean;
}) {
  if (itens.length === 0) return <p className="text-sm text-slate-400">{vazio}</p>;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              {mostrarData && <th className="px-5 py-3 font-semibold">Data</th>}
              <th className="px-5 py-3 font-semibold">Item</th>
              <th className="px-5 py-3 font-semibold">Valor</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {itens.map((l) => (
              <tr key={l.id} className="border-b border-slate-50 last:border-0">
                {mostrarData && (
                  <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-500">
                    {l.data ? formatDataBR(l.data) : "—"}
                  </td>
                )}
                <td className="px-5 py-3 font-medium text-[#141a4d]">{l.nome}</td>
                <td className="px-5 py-3">
                  {admin ? (
                    <form action={editarLancamento} className="flex items-center gap-2">
                      <input type="hidden" name="id" value={l.id} />
                      <input name="valor" type="number" step="0.01" min="0" defaultValue={l.valor} required className={editInput} />
                      <button className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">salvar</button>
                    </form>
                  ) : (
                    <span className="tabular-nums text-slate-600">{formatBRL(l.valor)}</span>
                  )}
                </td>
                <td className="px-5 py-3 text-right">
                  {admin && (
                    <form action={removerLancamento.bind(null, l.id)}>
                      <button className="text-sm font-medium text-rose-600 hover:text-rose-700">remover</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

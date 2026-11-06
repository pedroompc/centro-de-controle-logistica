import Link from "next/link";
import type { CustoMensal } from "@/domain/types";
import { listarLancamentosDoMes, listarLancamentosDosMeses, editarLancamento, removerLancamento } from "@/data/custos-mensais";
import { serieEfetivoMensal } from "@/data/efetivo-mensal";
import { listarFuncionarios } from "@/data/funcionarios";
import { custoTotalAtivos } from "@/domain/metrics";
import { somaLancamentos, totalDoMes } from "@/domain/custos-metrics";
import { formatBRL, formatDataBR } from "@/domain/format";
import {
  formatMesAno,
  lerPeriodo,
  mesDoPeriodo,
  mesesDoPeriodo,
  paramsDoPeriodo,
  periodoAnterior,
  periodoAnoPassado,
  primeiroDiaDoMes,
  periodoDoMes,
  rotuloCurto,
  rotuloPeriodo,
  INICIO_HISTORICO,
  type Periodo,
} from "@/domain/periodo";
import { hojeISO } from "@/domain/fechamento";
import { custoBrutoDoPeriodo, somaNosMeses } from "@/domain/custo-periodo";
import { compararPct } from "@/domain/comparacao";
import { ComparaPeriodos } from "@/components/compara-periodos";
import { PageHeader, Card, SectionTitle, BarList } from "@/components/ui";
import { PeriodoNav } from "@/components/periodo-nav";
import { isAdmin } from "@/data/auth";
import { AbrirMesButton } from "./abrir-mes-button";
import { LancarVariavelForm } from "./lancar-variavel-form";

const hrefCustos = (p: Record<string, string>) => (Object.keys(p).length ? `/custos?${new URLSearchParams(p)}` : "/custos");

export default async function CustosPage({ searchParams }: { searchParams: Promise<{ mes?: string; de?: string; ate?: string }> }) {
  const periodo = lerPeriodo(await searchParams);
  const mesUnico = mesDoPeriodo(periodo);
  if (!mesUnico) return <CustosDoPeriodo periodo={periodo} />;
  const mes = mesUnico;

  const [lancamentos, funcionarios, admin] = await Promise.all([
    listarLancamentosDoMes(mes),
    listarFuncionarios(),
    isAdmin(),
  ]);

  const salario = custoTotalAtivos(funcionarios);
  const somaFixos = somaLancamentos(lancamentos, "fixo");
  const somaVariaveis = somaLancamentos(lancamentos, "variavel");
  const fixos = lancamentos.filter((l) => l.tipo === "fixo");
  const variaveis = lancamentos.filter((l) => l.tipo === "variavel");
  const total = totalDoMes(lancamentos, salario);
  const mesVazio = fixos.length === 0;

  const composicao = [
    { label: "Salário", value: salario, display: formatBRL(salario) },
    { label: "Fixos", value: somaFixos, display: formatBRL(somaFixos) },
    { label: "Variáveis", value: somaVariaveis, display: formatBRL(somaVariaveis) },
  ];

  return (
    <div>
      <PageHeader title="Custos" subtitle="Custos da operação, mês a mês">
        <PeriodoNav periodo={periodo} hrefFor={hrefCustos} />
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

      {mesVazio && admin && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
          <p className="text-sm text-amber-800">Este mês ainda não foi aberto — gere os custos fixos para começar.</p>
          <AbrirMesButton mes={mes} />
        </div>
      )}

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <SectionTitle>Fixos</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Link href="/custos/equipamentos" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#141a4d] transition hover:bg-slate-50">
              Equipamentos
            </Link>
            <Link href="/custos/frota" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[#141a4d] transition hover:bg-slate-50">
              Frota
            </Link>
            <Link href="/custos/fixos" className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
              {admin ? "Gerenciar fixos" : "Ver fixos"}
            </Link>
          </div>
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
      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto md:block">
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

      {/* Mobile: cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {itens.map((l) => (
          <li key={l.id} className="px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-[#141a4d]">{l.nome}</p>
                {mostrarData && (
                  <p className="mt-0.5 text-xs tabular-nums text-slate-400">{l.data ? formatDataBR(l.data) : "—"}</p>
                )}
              </div>
              {!admin && (
                <span className="shrink-0 tabular-nums font-semibold text-slate-700">{formatBRL(l.valor)}</span>
              )}
            </div>
            {admin && (
              <div className="mt-2.5 flex items-center gap-2">
                <form action={editarLancamento} className="flex flex-1 items-center gap-2">
                  <input type="hidden" name="id" value={l.id} />
                  <input
                    name="valor"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={l.valor}
                    required
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
                  />
                  <button className="shrink-0 rounded-lg bg-[#181d55] px-3 py-2 text-xs font-semibold text-white active:bg-[#10143f]">
                    Salvar
                  </button>
                </form>
                <form action={removerLancamento.bind(null, l.id)}>
                  <button className="shrink-0 rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-600 active:bg-rose-50">
                    Remover
                  </button>
                </form>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Item somado nos meses do período (fixos/variáveis com o mesmo nome). */
function agregarPorNome(itens: CustoMensal[]): { nome: string; valor: number; meses: number }[] {
  const m = new Map<string, { nome: string; valor: number; meses: Set<string> }>();
  for (const l of itens) {
    const cur = m.get(l.nome) ?? { nome: l.nome, valor: 0, meses: new Set<string>() };
    cur.valor += l.valor;
    cur.meses.add(l.mes);
    m.set(l.nome, cur);
  }
  return [...m.values()].map((x) => ({ nome: x.nome, valor: x.valor, meses: x.meses.size })).sort((a, b) => b.valor - a.valor);
}

/**
 * Custos de um período que não é um mês inteiro: custos são mensais, então
 * somam os meses que o período toca (sem rateio por dia). Só leitura — lançar e
 * editar continuam no mês. Salário = foto mensal da folha (mês corrente sem
 * foto usa a folha atual).
 */
async function CustosDoPeriodo({ periodo }: { periodo: Periodo }) {
  const meses = mesesDoPeriodo(periodo).filter((m) => m >= INICIO_HISTORICO);
  const pAnt = periodoAnterior(periodo);
  const pAno = periodoAnoPassado(periodo);
  const qtd = Math.max(12, mesesDoPeriodo({ de: INICIO_HISTORICO, ate: hojeISO() }).length);
  const [lancamentos, funcionarios, efetivo, todos] = await Promise.all([
    listarLancamentosDosMeses(meses),
    listarFuncionarios(),
    serieEfetivoMensal(qtd),
    listarLancamentosDosMeses(mesesDoPeriodo({ de: INICIO_HISTORICO, ate: hojeISO() })),
  ]);
  const folhaPorMes = new Map(efetivo.map((e) => [e.mes, e.folhaTotal]));
  const mesAtual = primeiroDiaDoMes();
  if (meses.includes(mesAtual) && !folhaPorMes.has(mesAtual)) folhaPorMes.set(mesAtual, custoTotalAtivos(funcionarios));
  const custosPorMes = new Map<string, { fixos: number; variaveis: number }>();
  for (const l of todos) {
    const c = custosPorMes.get(l.mes) ?? { fixos: 0, variaveis: 0 };
    if (l.tipo === "fixo") c.fixos += l.valor;
    else c.variaveis += l.valor;
    custosPorMes.set(l.mes, c);
  }
  const custoDe = (p: Periodo) => custoBrutoDoPeriodo(mesesDoPeriodo(p), folhaPorMes, custosPorMes);
  const total = custoDe(periodo);
  const salario = somaNosMeses(folhaPorMes, meses) ?? 0;
  const somaFixos = somaLancamentos(lancamentos, "fixo");
  const somaVariaveis = somaLancamentos(lancamentos, "variavel");
  const composicao = [
    { label: "Salário", value: salario, display: formatBRL(salario) },
    { label: "Fixos", value: somaFixos, display: formatBRL(somaFixos) },
    { label: "Variáveis", value: somaVariaveis, display: formatBRL(somaVariaveis) },
  ];
  const fixos = agregarPorNome(lancamentos.filter((l) => l.tipo === "fixo"));
  const variaveis = agregarPorNome(lancamentos.filter((l) => l.tipo === "variavel"));
  const lista = (itens: typeof fixos, vazio: string) =>
    itens.length === 0 ? (
      <p className="text-sm text-slate-400">{vazio}</p>
    ) : (
      <Card className="p-5">
        <BarList tone="navy" items={itens.map((i) => ({ label: i.nome, value: i.valor, display: formatBRL(i.valor) }))} />
      </Card>
    );

  return (
    <div>
      <PageHeader title="Custos" subtitle="Custos da operação, mês a mês">
        <PeriodoNav periodo={periodo} hrefFor={hrefCustos} />
      </PageHeader>

      <Card className="p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="@container" title="Custos são mensais: soma dos meses que o período toca">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total do período</p>
            <p className="mt-1 font-[family-name:var(--font-sora)] text-[clamp(1.5rem,11cqi,2.25rem)] font-extrabold tracking-tight tabular-nums whitespace-nowrap text-[#141a4d]">
              {total === null ? "sem dado" : formatBRL(total)}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {rotuloPeriodo(periodo)} · {meses.length} {meses.length === 1 ? "mês" : "meses"}
            </p>
            {total !== null && (
              <ComparaPeriodos
                className="mt-2"
                itens={[
                  { c: compararPct(total, custoDe(pAnt), false), referencia: `vs ${rotuloCurto(pAnt)}` },
                  { c: compararPct(total, custoDe(pAno), false), referencia: `vs ${rotuloCurto(pAno)}` },
                ]}
              />
            )}
          </div>
          <div className="md:border-l md:border-slate-100 md:pl-6">
            <BarList items={composicao} tone="navy" />
          </div>
        </div>
      </Card>

      <section className="mt-6">
        <SectionTitle>Por mês</SectionTitle>
        <Card className="p-5">
          <BarList
            tone="gold"
            items={meses.map((m) => {
              const v = custoBrutoDoPeriodo([m], folhaPorMes, custosPorMes) ?? 0;
              return { label: formatMesAno(m), value: v, display: formatBRL(v), href: hrefCustos(paramsDoPeriodo(periodoDoMes(m))) };
            })}
          />
        </Card>
      </section>

      <section className="mt-6">
        <SectionTitle>Fixos</SectionTitle>
        {lista(fixos, "Nenhum custo fixo no período.")}
      </section>

      <section className="mt-6">
        <SectionTitle>Variáveis</SectionTitle>
        {lista(variaveis, "Nenhum custo variável no período.")}
      </section>
    </div>
  );
}

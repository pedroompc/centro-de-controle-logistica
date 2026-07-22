import Link from "next/link";
import { listarReceitasDoMes, serieReceitasMensais, removerReceita, type FiltrosReceita } from "@/data/receitas";
import { listarFornecedores } from "@/data/fornecedores";
import { listarPrecos } from "@/data/precos-descarregamento";
import { lerConfig } from "@/data/config-descarregamento";
import { isAdmin } from "@/data/auth";
import {
  resumoReceitas, receitaPorFornecedor, receitaPorTipo, toneladas,
} from "@/domain/receitas-metrics";
import { formatBRL, formatKg, formatDataBR } from "@/domain/format";
import { primeiroDiaDoMes, mesAnterior, mesProximo, formatMesAno } from "@/domain/periodo";
import { PageHeader, Card, SectionTitle, StatCard, HeroStat, BarList, Pill } from "@/components/ui";
import { DescarregamentoForm } from "./descarregamento-form";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import type { DescarregamentoTipo } from "@/domain/types";
import { listarDiversasDoMes, removerDiversa } from "@/data/receitas-diversas";
import { ROTULO_CATEGORIA } from "@/domain/receitas-diversas";
import { DiversaForm } from "./diversa-form";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

function fmtTon(t: number): string {
  return `${t.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t`;
}

// Monta querystring preservando filtros ao navegar entre meses.
function qs(mes: string, f: FiltrosReceita): string {
  const p = new URLSearchParams({ mes });
  if (f.fornecedorId) p.set("fornecedor", f.fornecedorId);
  if (f.tipo) p.set("tipo", f.tipo);
  return `/receitas?${p.toString()}`;
}

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; fornecedor?: string; tipo?: string }>;
}) {
  const sp = await searchParams;
  const mes = sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes();
  const filtros: FiltrosReceita = {
    fornecedorId: sp.fornecedor || undefined,
    tipo: (sp.tipo as DescarregamentoTipo) || undefined,
  };

  const [receitas, fornecedores, precos, config, serie, admin, diversas] = await Promise.all([
    listarReceitasDoMes(mes, filtros),
    listarFornecedores(),
    listarPrecos(),
    lerConfig(),
    serieReceitasMensais(),
    isAdmin(),
    listarDiversasDoMes(mes),
  ]);

  const resumo = resumoReceitas(receitas, diversas);
  const porFornecedor = receitaPorFornecedor(receitas);
  const porTipo = receitaPorTipo(receitas);

  const barrasFornecedor = porFornecedor.map((f) => ({
    label: f.nome, value: f.valor, display: formatBRL(f.valor),
  }));
  const barrasTipo = TIPOS_DESCARREGAMENTO.map((t) => ({
    label: ROTULO_TIPO[t], value: porTipo[t], display: formatBRL(porTipo[t]),
  }));
  const barrasMensal = serie.map((p) => ({
    label: formatMesAno(p.mes), value: p.valor, display: formatBRL(p.valor),
  }));

  return (
    <div>
      <PageHeader title="Receitas Logísticas" subtitle="Descarregamentos e outras receitas da operação">
        <Link href={qs(mesAnterior(mes), filtros)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50">◀</Link>
        <span className="min-w-[7rem] text-center text-sm font-semibold text-[#141a4d]">{formatMesAno(mes)}</span>
        <Link href={qs(mesProximo(mes), filtros)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50">▶</Link>
      </PageHeader>

      {/* Indicadores */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1"><HeroStat label="Receita total" value={formatBRL(resumo.total)} /></div>
        <StatCard
          label="Descarregamento"
          value={formatBRL(resumo.totalDescarregamento)}
          hint={`${receitas.length} lançamentos · ${fmtTon(resumo.toneladas)}`}
          accent="green"
        />
        <StatCard
          label="Outras receitas"
          value={formatBRL(resumo.totalDiversas)}
          hint={`${diversas.length} lançamentos`}
          accent="green"
        />
        <StatCard
          label="Valor médio / tonelada"
          value={formatBRL(resumo.medioPorTonelada)}
          hint="só descarregamento"
          accent="gold"
        />
      </div>

      {/* Ações + filtros */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="mes" value={mes} />
          <select name="fornecedor" defaultValue={filtros.fornecedorId ?? ""} className={field}>
            <option value="">Todos os fornecedores</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </select>
          <select name="tipo" defaultValue={filtros.tipo ?? ""} className={field}>
            <option value="">Todos os tipos</option>
            {TIPOS_DESCARREGAMENTO.map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO[t]}</option>
            ))}
          </select>
          <button className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">Filtrar</button>
        </form>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/receitas/export?${new URLSearchParams({ mes, ...(filtros.fornecedorId ? { fornecedor: filtros.fornecedorId } : {}), ...(filtros.tipo ? { tipo: filtros.tipo } : {}) }).toString()}`}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Exportar CSV</Link>
          <Link href="/receitas/fornecedores" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Fornecedores</Link>
          {admin && <Link href="/receitas/precos" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Preços</Link>}
          {admin && <DescarregamentoForm fornecedores={fornecedores} precos={precos} mes={mes} valorMinimo={config.valorMinimo} />}
        </div>
      </div>

      {/* Quebras */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle>Receita por fornecedor</SectionTitle>
          <Card className="p-5"><BarList items={barrasFornecedor} tone="gold" /></Card>
        </section>
        <section>
          <SectionTitle>Receita por tipo</SectionTitle>
          <Card className="p-5"><BarList items={barrasTipo} tone="navy" /></Card>
        </section>
      </div>

      {/* Tabela de lançamentos */}
      <section className="mt-6">
        <SectionTitle>Descarregamentos do mês</SectionTitle>
        {receitas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum descarregamento no período.</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Data</th>
                    <th className="px-5 py-3 font-semibold">Fornecedor</th>
                    <th className="px-5 py-3 font-semibold">Peso</th>
                    <th className="px-5 py-3 font-semibold">Tipo</th>
                    <th className="px-5 py-3 font-semibold">R$/ton</th>
                    <th className="px-5 py-3 font-semibold">Receita</th>
                    <th className="px-5 py-3 font-semibold">Obs.</th>
                    {admin && <th className="px-5 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {receitas.map((r) => (
                    <tr key={r.id} className="border-b border-slate-50 last:border-0 align-top">
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-500">{formatDataBR(r.data)}</td>
                      <td className="px-5 py-3 font-medium text-[#141a4d]">{r.fornecedorNome}</td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-600">
                        {formatKg(r.pesoKg)} <span className="text-slate-400">({fmtTon(toneladas(r.pesoKg))})</span>
                      </td>
                      <td className="px-5 py-3">
                        <Pill tone={r.tipo === "paletizado" ? "gold" : r.tipo === "pal_rem" ? "navy" : "slate"}>
                          {ROTULO_TIPO[r.tipo] ?? r.tipo}
                        </Pill>
                      </td>
                      <td className="px-5 py-3 tabular-nums text-slate-600">{formatBRL(r.precoPorTonelada)}</td>
                      <td className="px-5 py-3 font-semibold tabular-nums text-emerald-700">{formatBRL(r.receita)}</td>
                      <td className="px-5 py-3 max-w-[16rem] truncate text-slate-500" title={r.observacao ?? ""}>{r.observacao ?? "—"}</td>
                      {admin && (
                        <td className="px-5 py-3">
                          <div className="flex flex-col items-end gap-2">
                            <DescarregamentoForm fornecedores={fornecedores} precos={precos} mes={mes} valorMinimo={config.valorMinimo} receita={r} />
                            <form action={removerReceita.bind(null, r.id)}>
                              <button className="text-sm font-medium text-rose-600 hover:text-rose-700">remover</button>
                            </form>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* Outras receitas */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Outras receitas do mês</SectionTitle>
          {admin && <DiversaForm mes={mes} />}
        </div>
        {diversas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma outra receita no período.</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Data</th>
                    <th className="px-5 py-3 font-semibold">Categoria</th>
                    <th className="px-5 py-3 font-semibold">Material</th>
                    <th className="px-5 py-3 font-semibold">Quantidade</th>
                    <th className="px-5 py-3 font-semibold">R$/kg</th>
                    <th className="px-5 py-3 font-semibold">Valor</th>
                    <th className="px-5 py-3 font-semibold">Obs.</th>
                    {admin && <th className="px-5 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {diversas.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 last:border-0 align-top">
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-500">{formatDataBR(d.data)}</td>
                      <td className="px-5 py-3">
                        <Pill tone="navy">{ROTULO_CATEGORIA[d.categoria] ?? d.categoria}</Pill>
                      </td>
                      <td className="px-5 py-3 font-medium text-[#141a4d]">{d.material ?? "—"}</td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-600">
                        {d.quantidade === null ? "—" : `${formatKg(d.quantidade)}`}
                      </td>
                      <td className="px-5 py-3 tabular-nums text-slate-600">
                        {d.precoUnitario === null ? "—" : formatBRL(d.precoUnitario)}
                      </td>
                      <td className="px-5 py-3 font-semibold tabular-nums text-emerald-700">{formatBRL(d.valor)}</td>
                      <td className="px-5 py-3 max-w-[16rem] truncate text-slate-500" title={d.observacao ?? ""}>{d.observacao ?? "—"}</td>
                      {admin && (
                        <td className="px-5 py-3">
                          <div className="flex flex-col items-end gap-2">
                            <DiversaForm mes={mes} diversa={d} />
                            <form action={removerDiversa.bind(null, d.id)}>
                              <button className="text-sm font-medium text-rose-600 hover:text-rose-700">remover</button>
                            </form>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* Comparação mensal */}
      <section className="mt-6">
        <SectionTitle>Comparação mensal</SectionTitle>
        <Card className="p-5"><BarList items={barrasMensal} tone="gold" /></Card>
      </section>
    </div>
  );
}

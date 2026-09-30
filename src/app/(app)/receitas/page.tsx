import Link from "next/link";
import { listarReceitasDoMes, serieReceitasMensais, removerReceita, type FiltrosReceita } from "@/data/receitas";
import { listarFornecedores } from "@/data/fornecedores";
import { listarPrecos } from "@/data/precos-descarregamento";
import { lerConfig } from "@/data/config-descarregamento";
import { isAdmin } from "@/data/auth";
import {
  resumoReceitas, receitaPorFornecedor, receitaPorTipo, quantidadePorTipo, receitaPorDia, toneladas,
} from "@/domain/receitas-metrics";
import { formatBRL, formatKg, formatDataBR } from "@/domain/format";
import { primeiroDiaDoMes, formatMesAno, limitarAoHistorico } from "@/domain/periodo";
import { PageHeader, Card, SectionTitle, StatCard, HeroStat, BarList, Pill } from "@/components/ui";
import { MesNav } from "@/components/mes-nav";
import { DescarregamentoForm } from "./descarregamento-form";
import { ReceitaPorTipo } from "./receita-por-tipo";
import { FornecedorRanking } from "./fornecedor-ranking";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import type { DescarregamentoTipo } from "@/domain/types";
import { listarDiversasDoMes, removerDiversa } from "@/data/receitas-diversas";
import { ROTULO_CATEGORIA } from "@/domain/receitas-diversas";
import { DiversaForm } from "./diversa-form";
import { listarTotaisDiariosDoMes, removerTotalDiario } from "@/data/receitas-diario";
import { TotalDiarioForm } from "./total-diario-form";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

function fmtTon(t: number): string {
  return `${t.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t`;
}

/**
 * Granularidade da tabela de descarregamentos. "detalhado" é a leitura de quem
 * opera (um lançamento por linha); "simples" é a de quem só quer o resultado do
 * dia. Detalhado é o default — qualquer valor desconhecido cai nele.
 */
type Vista = "detalhado" | "simples";

// Padrão é "simples": ao abrir Receitas sem parâmetro, mostra a vista simples.
// Só "detalhado" explícito na URL sai do padrão.
function lerVista(bruto: string | undefined): Vista {
  return bruto === "detalhado" ? "detalhado" : "simples";
}

/**
 * Dia aberto a partir da vista Simples ("yyyy-mm-dd"). Só vale na vista
 * Detalhado e dentro do mês exibido — um dia de outro mês daria uma tabela vazia
 * sem explicação, então é descartado.
 */
function lerDia(bruto: string | undefined, mes: string, vista: Vista): string | undefined {
  if (vista !== "detalhado" || !bruto || !/^\d{4}-\d{2}-\d{2}$/.test(bruto)) return undefined;
  return primeiroDiaDoMes(bruto) === mes ? bruto : undefined;
}

// Monta querystring preservando filtros e vista ao navegar entre meses. O dia só
// vai quando passado: trocar de mês ou de vista volta ao mês inteiro.
function qs(mes: string, f: FiltrosReceita, vista: Vista, dia?: string): string {
  const p = new URLSearchParams({ mes });
  if (f.fornecedorId) p.set("fornecedor", f.fornecedorId);
  if (f.tipo) p.set("tipo", f.tipo);
  if (vista === "detalhado") p.set("vista", vista); // simples é o padrão; só marca o não-padrão
  if (dia) p.set("dia", dia);
  return `/receitas?${p.toString()}`;
}

const VISTAS: { valor: Vista; rotulo: string }[] = [
  { valor: "detalhado", rotulo: "Detalhado" },
  { valor: "simples", rotulo: "Simples" },
];

/** Alterna a granularidade da tabela preservando mês e filtros ativos. */
function SeletorVista({ mes, filtros, vista }: { mes: string; filtros: FiltrosReceita; vista: Vista }) {
  return (
    <div className="mb-3 inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
      {VISTAS.map((v) => {
        const ativo = v.valor === vista;
        return (
          <Link
            key={v.valor}
            href={qs(mes, filtros, v.valor)}
            aria-current={ativo ? "page" : undefined}
            className={`rounded-[0.6rem] px-3 py-1.5 text-xs font-semibold transition ${
              ativo ? "bg-white text-[#141a4d] shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {v.rotulo}
          </Link>
        );
      })}
    </div>
  );
}

export default async function ReceitasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; fornecedor?: string; tipo?: string; vista?: string; dia?: string }>;
}) {
  const sp = await searchParams;
  const mes = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const filtros: FiltrosReceita = {
    fornecedorId: sp.fornecedor || undefined,
    tipo: (sp.tipo as DescarregamentoTipo) || undefined,
  };
  const vista = lerVista(sp.vista);
  const dia = lerDia(sp.dia, mes, vista);

  const [receitas, fornecedores, precos, config, serie, admin, diversas, totais] = await Promise.all([
    listarReceitasDoMes(mes, filtros),
    listarFornecedores(),
    listarPrecos(),
    lerConfig(),
    serieReceitasMensais(),
    isAdmin(),
    listarDiversasDoMes(mes),
    listarTotaisDiariosDoMes(mes),
  ]);

  // Fornecedor e tipo são conceitos exclusivos de descarregamento — reciclagem não
  // tem nenhum dos dois. Com um desses filtros ativo, o usuário pediu um recorte de
  // descarregamento; misturar reciclagem nos totais (e no CSV) exibiria uma "receita
  // total" que soma dinheiro de fora do filtro, sem nada avisando. Por isso as
  // diversas somem do recorte inteiro — lista, totais e export — quando filtrado.
  const filtrandoDescarregamento = Boolean(filtros.fornecedorId || filtros.tipo);
  const diversasVisiveis = filtrandoDescarregamento ? [] : diversas;
  // Totais do dia não têm fornecedor/tipo, então saem do recorte pela mesma
  // razão que as diversas.
  const totaisVisiveis = filtrandoDescarregamento ? [] : totais;

  const resumo = resumoReceitas(receitas, diversasVisiveis, totaisVisiveis);
  const porFornecedor = receitaPorFornecedor(receitas);
  const porTipo = receitaPorTipo(receitas);
  const porDia = receitaPorDia(receitas, totaisVisiveis);
  // Somado da própria coluna, não derivado de `resumo.toneladas`: aquele valor é
  // arredondado a 2 casas de tonelada (granularidade de 10 kg) e o rodapé deixaria
  // de fechar com os kg exibidos nas linhas.
  const pesoTotalKg = porDia.reduce((t, d) => t + d.pesoKg, 0);
  // A contagem antiga `receitas.length` ignora os totais do dia lançados direto.
  const descarregosTotal = porDia.reduce((t, d) => t + d.descarregos, 0);
  // Só a tabela detalhada é recortada pelo dia; cards e gráficos seguem o mês.
  const receitasTabela = dia ? receitas.filter((r) => r.data === dia) : receitas;

  const barrasFornecedor = porFornecedor.map((f) => ({
    label: f.nome, value: f.valor, display: formatBRL(f.valor),
  }));
  const porTipoQtd = quantidadePorTipo(receitas, totaisVisiveis);
  const barrasTipo = TIPOS_DESCARREGAMENTO.map((t) => ({
    label: ROTULO_TIPO[t], value: porTipo[t], display: formatBRL(porTipo[t]),
  }));
  const barrasTipoQtd = TIPOS_DESCARREGAMENTO.map((t) => ({
    label: ROTULO_TIPO[t], value: porTipoQtd[t], display: porTipoQtd[t].toLocaleString("pt-BR"),
  }));
  const barrasMensal = serie.map((p) => ({
    label: formatMesAno(p.mes), value: p.valor, display: formatBRL(p.valor),
  }));

  return (
    <div>
      <PageHeader title="Receitas Logísticas" subtitle="Descarregos e outras receitas da operação">
        <MesNav mes={mes} hrefFor={(m) => qs(m, filtros, vista)} />
      </PageHeader>

      {/* Indicadores */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-1"><HeroStat label="Receita total" value={formatBRL(resumo.total)} /></div>
        <StatCard
          label="Descarrego"
          value={formatBRL(resumo.totalDescarregamento)}
          hint={`${descarregosTotal} descarregos · ${fmtTon(resumo.toneladas)}`}
          accent="green"
        />
        <StatCard
          label="Outras receitas"
          value={formatBRL(resumo.totalDiversas)}
          hint={filtrandoDescarregamento ? "fora do filtro atual" : `${diversasVisiveis.length} lançamentos`}
          accent="green"
        />
        <StatCard
          label="Valor médio / tonelada"
          value={formatBRL(resumo.medioPorTonelada)}
          hint="só descarrego"
          accent="gold"
        />
      </div>

      {/* Ações + filtros */}
      <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
        <form method="get" className="flex flex-wrap items-end gap-2 text-sm">
          <input type="hidden" name="mes" value={mes} />
          {/* Sem isto, "Filtrar" recarrega sem `vista` e devolve o usuário ao padrão (simples). */}
          <input type="hidden" name="vista" value={vista} />
          {dia && <input type="hidden" name="dia" value={dia} />}
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

      {/* Quebras empilhadas em largura total. Antes eram duas colunas, mas
          "por tipo" tem só 3 itens: ao lado da lista longa de fornecedores (ou
          de uma comparação mensal com poucos meses) sobrava um vão feio ao lado
          do card curto. Em coluna única cada card ocupa a largura toda e nenhum
          card curto fica encostado num alto — sem buraco, em qualquer volume de
          dados. A lista de fornecedores rola dentro de uma altura limitada para
          não esticar a página. */}
      <section className="mt-6">
        <SectionTitle>Receita por fornecedor</SectionTitle>
        <Card className="p-5"><FornecedorRanking items={barrasFornecedor} /></Card>
      </section>
      <section className="mt-6">
        <SectionTitle>Por tipo</SectionTitle>
        <Card className="p-5"><ReceitaPorTipo porReceita={barrasTipo} porQuantidade={barrasTipoQtd} /></Card>
      </section>
      <section className="mt-6">
        <SectionTitle>Comparação mensal</SectionTitle>
        <Card className="p-5"><BarList items={barrasMensal} tone="gold" /></Card>
      </section>

      {/* Tabela de lançamentos */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Descarregos do mês</SectionTitle>
          <div className="flex flex-wrap items-center gap-3">
            {admin && vista === "simples" && <TotalDiarioForm mes={mes} />}
            <SeletorVista mes={mes} filtros={filtros} vista={vista} />
          </div>
        </div>
        {dia && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-2.5 text-sm">
            <span className="text-amber-900">
              Lançamentos de <strong className="tabular-nums">{formatDataBR(dia)}</strong> · {receitasTabela.length}{" "}
              {receitasTabela.length === 1 ? "lançamento" : "lançamentos"} ·{" "}
              <strong className="tabular-nums">{formatBRL(receitasTabela.reduce((t, x) => t + x.receita, 0))}</strong>
            </span>
            <span className="flex gap-3 font-medium">
              <Link href={qs(mes, filtros, "simples")} className="text-amber-800 hover:underline">← voltar aos dias</Link>
              <Link href={qs(mes, filtros, "detalhado")} className="text-amber-800 hover:underline">ver o mês inteiro</Link>
            </span>
          </div>
        )}
        {(vista === "simples" ? porDia.length === 0 : receitasTabela.length === 0) ? (
          <p className="text-sm text-slate-400">Nenhum descarrego no período.</p>
        ) : vista === "simples" ? (
          <Card className="overflow-hidden">
            {/* Desktop: tabela */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Data</th>
                    <th className="px-5 py-3 font-semibold">Descarregos</th>
                    <th className="px-5 py-3 font-semibold">Peso</th>
                    <th className="px-5 py-3 font-semibold">Receita</th>
                    {admin && <th className="px-5 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {porDia.map((d) => (
                    <tr key={d.id ?? d.data} className={`border-b border-slate-50 last:border-0 ${d.origem === "detalhado" ? "hover:bg-amber-50/40" : ""}`}>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-500">
                        {d.origem === "detalhado" ? (
                          <Link href={qs(mes, filtros, "detalhado", d.data)} className="font-medium text-[#141a4d] underline decoration-slate-300 underline-offset-4 hover:decoration-amber-500">
                            {formatDataBR(d.data)}
                          </Link>
                        ) : (
                          formatDataBR(d.data)
                        )}
                      </td>
                      <td className="px-5 py-3 tabular-nums font-medium text-[#141a4d]">
                        {d.descarregos}
                        {d.origem === "total" && (
                          <span className="ml-2 align-middle text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
                            total do dia
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-600">
                        {formatKg(d.pesoKg)} <span className="text-slate-400">({fmtTon(toneladas(d.pesoKg))})</span>
                      </td>
                      <td className="px-5 py-3 whitespace-nowrap font-semibold tabular-nums text-emerald-700">{formatBRL(d.receita)}</td>
                      {admin && (
                        <td className="px-5 py-3">
                          {d.origem === "total" && d.id ? (
                            <div className="flex flex-col items-end gap-2">
                              <TotalDiarioForm mes={mes} total={totaisVisiveis.find((t) => t.id === d.id)} />
                              <form action={removerTotalDiario.bind(null, d.id)}>
                                <button className="text-sm font-medium text-rose-600 hover:text-rose-700">remover</button>
                              </form>
                            </div>
                          ) : (
                            <Link href={qs(mes, filtros, "detalhado", d.data)} className="text-xs font-medium text-slate-400 hover:text-amber-700">
                              ver lançamentos →
                            </Link>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50/70 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total do mês
                    </th>
                    <td className="px-5 py-3 tabular-nums font-semibold text-[#141a4d]">{descarregosTotal}</td>
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums font-semibold text-[#141a4d]">
                      {formatKg(pesoTotalKg)} <span className="font-normal text-slate-400">({fmtTon(toneladas(pesoTotalKg))})</span>
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap font-semibold tabular-nums text-emerald-700">{formatBRL(resumo.totalDescarregamento)}</td>
                    {admin && <td className="px-5 py-3"></td>}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile: cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {porDia.map((d) => (
                <li key={d.id ?? d.data} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      {d.origem === "detalhado" ? (
                        <Link href={qs(mes, filtros, "detalhado", d.data)} className="tabular-nums font-medium text-[#141a4d] underline decoration-slate-300 underline-offset-4">
                          {formatDataBR(d.data)}
                        </Link>
                      ) : (
                        <p className="tabular-nums font-medium text-[#141a4d]">{formatDataBR(d.data)}</p>
                      )}
                      <p className="mt-0.5 text-xs text-slate-500">
                        {d.descarregos} descarregos
                        {d.origem === "total" ? " · total do dia" : ""} · {formatKg(d.pesoKg)}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-emerald-700">{formatBRL(d.receita)}</span>
                  </div>
                  {admin && d.origem === "total" && d.id && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <TotalDiarioForm mes={mes} total={totaisVisiveis.find((t) => t.id === d.id)} />
                      <form action={removerTotalDiario.bind(null, d.id)}>
                        <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 active:bg-rose-50">
                          Remover
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 bg-slate-50/70 px-4 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total do mês</span>
                <div className="text-right">
                  <p className="font-semibold tabular-nums text-emerald-700">{formatBRL(resumo.totalDescarregamento)}</p>
                  <p className="text-xs tabular-nums text-slate-500">
                    {descarregosTotal} descarregos · {formatKg(pesoTotalKg)}
                  </p>
                </div>
              </li>
            </ul>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            {/* Desktop: tabela */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Data</th>
                    <th className="px-5 py-3 font-semibold">Fornecedor</th>
                    <th className="px-5 py-3 font-semibold">Peso</th>
                    <th className="px-5 py-3 font-semibold">Tipo</th>
                    <th className="px-5 py-3 font-semibold">Preço</th>
                    <th className="px-5 py-3 font-semibold">Receita</th>
                    <th className="px-5 py-3 font-semibold">Obs.</th>
                    {admin && <th className="px-5 py-3"></th>}
                  </tr>
                </thead>
                <tbody>
                  {receitasTabela.map((r) => (
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
                      <td className="px-5 py-3 tabular-nums text-slate-600">
                        {r.tipo === "volume"
                          ? `${r.quantidade ?? 0} cx × ${formatBRL(r.precoPorUnidade ?? 0)}`
                          : formatBRL(r.precoPorTonelada)}
                      </td>
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

            {/* Mobile: cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {receitasTabela.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#141a4d]">{r.fornecedorNome}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500">
                        {formatDataBR(r.data)} · {formatKg(r.pesoKg)}
                      </p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-emerald-700">{formatBRL(r.receita)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Pill tone={r.tipo === "paletizado" ? "gold" : r.tipo === "pal_rem" ? "navy" : "slate"}>
                      {ROTULO_TIPO[r.tipo] ?? r.tipo}
                    </Pill>
                    <span className="tabular-nums">
                      {r.tipo === "volume"
                        ? `${r.quantidade ?? 0} cx × ${formatBRL(r.precoPorUnidade ?? 0)}`
                        : formatBRL(r.precoPorTonelada)}
                    </span>
                  </div>
                  {r.observacao && <p className="mt-1.5 text-xs text-slate-500">{r.observacao}</p>}
                  {admin && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <DescarregamentoForm fornecedores={fornecedores} precos={precos} mes={mes} valorMinimo={config.valorMinimo} receita={r} />
                      <form action={removerReceita.bind(null, r.id)}>
                        <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 active:bg-rose-50">
                          Remover
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Outras receitas */}
      <section className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Outras receitas do mês</SectionTitle>
          {admin && !filtrandoDescarregamento && <DiversaForm mes={mes} />}
        </div>
        {filtrandoDescarregamento ? (
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
            <p className="text-sm text-amber-800">
              Filtro por fornecedor ou tipo ativo — esses conceitos só existem em descarrego.
              As outras receitas (reciclagem) ficam fora deste recorte. Limpe o filtro para vê-las.
            </p>
          </div>
        ) : diversasVisiveis.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhuma outra receita no período.</p>
        ) : (
          <Card className="overflow-hidden">
            {/* Desktop: tabela */}
            <div className="hidden overflow-x-auto md:block">
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
                  {diversasVisiveis.map((d) => (
                    <tr key={d.id} className="border-b border-slate-50 last:border-0 align-top">
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-500">{formatDataBR(d.data)}</td>
                      <td className="px-5 py-3">
                        <Pill tone="navy">{ROTULO_CATEGORIA[d.categoria] ?? d.categoria}</Pill>
                      </td>
                      <td className="px-5 py-3 font-medium text-[#141a4d]">{d.material ?? "—"}</td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-600">
                        {/* 3 casas: pesagem de reciclagem é fracionária (numeric(14,3)), diferente do
                            descarregamento acima — arredondar pra inteiro esconderia a quantidade real. */}
                        {d.quantidade === null ? "—" : `${formatKg(d.quantidade, 3)}`}
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

            {/* Mobile: cards */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {diversasVisiveis.map((d) => (
                <li key={d.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#141a4d]">
                        {d.material ?? (ROTULO_CATEGORIA[d.categoria] ?? d.categoria)}
                      </p>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500">{formatDataBR(d.data)}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-emerald-700">{formatBRL(d.valor)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Pill tone="navy">{ROTULO_CATEGORIA[d.categoria] ?? d.categoria}</Pill>
                    {d.quantidade !== null && (
                      <span className="tabular-nums">
                        {formatKg(d.quantidade, 3)}
                        {d.precoUnitario !== null ? ` × ${formatBRL(d.precoUnitario)}` : ""}
                      </span>
                    )}
                  </div>
                  {d.observacao && <p className="mt-1.5 text-xs text-slate-500">{d.observacao}</p>}
                  {admin && (
                    <div className="mt-2.5 flex items-center gap-2">
                      <DiversaForm mes={mes} diversa={d} />
                      <form action={removerDiversa.bind(null, d.id)}>
                        <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-600 active:bg-rose-50">
                          Remover
                        </button>
                      </form>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}

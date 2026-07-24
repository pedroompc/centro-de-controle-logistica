import Link from "next/link";
import { listarReceitasDoMes, serieReceitasMensais, removerReceita, type FiltrosReceita } from "@/data/receitas";
import { listarFornecedores } from "@/data/fornecedores";
import { listarPrecos } from "@/data/precos-descarregamento";
import { lerConfig } from "@/data/config-descarregamento";
import { isAdmin } from "@/data/auth";
import {
  resumoReceitas, receitaPorFornecedor, receitaPorTipo, receitaPorDia, toneladas,
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

/**
 * Granularidade da tabela de descarregamentos. "detalhado" é a leitura de quem
 * opera (um lançamento por linha); "simples" é a de quem só quer o resultado do
 * dia. Detalhado é o default — qualquer valor desconhecido cai nele.
 */
type Vista = "detalhado" | "simples";

function lerVista(bruto: string | undefined): Vista {
  return bruto === "simples" ? "simples" : "detalhado";
}

// Monta querystring preservando filtros e vista ao navegar entre meses.
function qs(mes: string, f: FiltrosReceita, vista: Vista): string {
  const p = new URLSearchParams({ mes });
  if (f.fornecedorId) p.set("fornecedor", f.fornecedorId);
  if (f.tipo) p.set("tipo", f.tipo);
  if (vista === "simples") p.set("vista", vista);
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
  searchParams: Promise<{ mes?: string; fornecedor?: string; tipo?: string; vista?: string }>;
}) {
  const sp = await searchParams;
  const mes = sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes();
  const filtros: FiltrosReceita = {
    fornecedorId: sp.fornecedor || undefined,
    tipo: (sp.tipo as DescarregamentoTipo) || undefined,
  };
  const vista = lerVista(sp.vista);

  const [receitas, fornecedores, precos, config, serie, admin, diversas] = await Promise.all([
    listarReceitasDoMes(mes, filtros),
    listarFornecedores(),
    listarPrecos(),
    lerConfig(),
    serieReceitasMensais(),
    isAdmin(),
    listarDiversasDoMes(mes),
  ]);

  // Fornecedor e tipo são conceitos exclusivos de descarregamento — reciclagem não
  // tem nenhum dos dois. Com um desses filtros ativo, o usuário pediu um recorte de
  // descarregamento; misturar reciclagem nos totais (e no CSV) exibiria uma "receita
  // total" que soma dinheiro de fora do filtro, sem nada avisando. Por isso as
  // diversas somem do recorte inteiro — lista, totais e export — quando filtrado.
  const filtrandoDescarregamento = Boolean(filtros.fornecedorId || filtros.tipo);
  const diversasVisiveis = filtrandoDescarregamento ? [] : diversas;

  const resumo = resumoReceitas(receitas, diversasVisiveis);
  const porFornecedor = receitaPorFornecedor(receitas);
  const porTipo = receitaPorTipo(receitas);
  const porDia = receitaPorDia(receitas);
  // Somado da própria coluna, não derivado de `resumo.toneladas`: aquele valor é
  // arredondado a 2 casas de tonelada (granularidade de 10 kg) e o rodapé deixaria
  // de fechar com os kg exibidos nas linhas.
  const pesoTotalKg = porDia.reduce((t, d) => t + d.pesoKg, 0);

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
        <Link href={qs(mesAnterior(mes), filtros, vista)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50">◀</Link>
        <span className="min-w-[7rem] text-center text-sm font-semibold text-[#141a4d]">{formatMesAno(mes)}</span>
        <Link href={qs(mesProximo(mes), filtros, vista)} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 hover:bg-slate-50">▶</Link>
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
          hint={filtrandoDescarregamento ? "fora do filtro atual" : `${diversasVisiveis.length} lançamentos`}
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
          {/* Sem isto, "Filtrar" recarrega sem `vista` e devolve o usuário ao detalhado. */}
          <input type="hidden" name="vista" value={vista} />
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Descarregamentos do mês</SectionTitle>
          <SeletorVista mes={mes} filtros={filtros} vista={vista} />
        </div>
        {receitas.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum descarregamento no período.</p>
        ) : vista === "simples" ? (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Data</th>
                    <th className="px-5 py-3 font-semibold">Descarregos</th>
                    <th className="px-5 py-3 font-semibold">Peso</th>
                    <th className="px-5 py-3 font-semibold">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {porDia.map((d) => (
                    <tr key={d.data} className="border-b border-slate-50 last:border-0">
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-500">{formatDataBR(d.data)}</td>
                      <td className="px-5 py-3 tabular-nums font-medium text-[#141a4d]">{d.descarregos}</td>
                      <td className="px-5 py-3 whitespace-nowrap tabular-nums text-slate-600">
                        {formatKg(d.pesoKg)} <span className="text-slate-400">({fmtTon(toneladas(d.pesoKg))})</span>
                      </td>
                      <td className="px-5 py-3 font-semibold tabular-nums text-emerald-700">{formatBRL(d.receita)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-slate-200 bg-slate-50/70 text-slate-600">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Total do mês
                    </th>
                    <td className="px-5 py-3 tabular-nums font-semibold text-[#141a4d]">{receitas.length}</td>
                    <td className="px-5 py-3 whitespace-nowrap tabular-nums font-semibold text-[#141a4d]">
                      {formatKg(pesoTotalKg)} <span className="font-normal text-slate-400">({fmtTon(toneladas(pesoTotalKg))})</span>
                    </td>
                    <td className="px-5 py-3 font-semibold tabular-nums text-emerald-700">{formatBRL(resumo.totalDescarregamento)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
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
          {admin && !filtrandoDescarregamento && <DiversaForm mes={mes} />}
        </div>
        {filtrandoDescarregamento ? (
          <div className="rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-4">
            <p className="text-sm text-amber-800">
              Filtro por fornecedor ou tipo ativo — esses conceitos só existem em descarregamento.
              As outras receitas (reciclagem) ficam fora deste recorte. Limpe o filtro para vê-las.
            </p>
          </div>
        ) : diversasVisiveis.length === 0 ? (
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

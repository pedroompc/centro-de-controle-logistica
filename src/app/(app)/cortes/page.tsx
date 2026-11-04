import { Suspense, type CSSProperties } from "react";
import { lerCortes, lerCortesMensais } from "@/data/cortes";
import { getResumoFaturamentoDashboard, vendaLiquidaDasFotos } from "@/data/faturamento-mensal";
import Link from "next/link";
import {
  resumoCortes, taxaCorte, lerMotivo, filtrarCortes, rotuloFiltro, variacaoCorte, variacaoTaxaCorte, serieDiaria,
  DIMENSOES_CORTE, type DimensaoCorte, type FiltrosCorte, type GrupoCorte, type LinhaCorte, type VariacaoCorte,
} from "@/domain/cortes";
import { formatBRL, formatPercent, formatKg, formatDataBR } from "@/domain/format";
import { primeiroDiaDoMes, formatMesAno, limitarAoHistorico, inicioFimDoMes, mesAnterior, INICIO_HISTORICO } from "@/domain/periodo";
import { PageHeader, Card, StatCard, SectionTitle, BarList } from "@/components/ui";
import { MesNav } from "@/components/mes-nav";

const inteiro = new Intl.NumberFormat("pt-BR");
const brl0 = (v: number) => formatBRL(Math.round(v)).replace(/,00$/, "");

const NOME_DIM: Record<DimensaoCorte, string> = {
  origem: "Origem", motivo: "Motivo", usuario: "Quem cortou", fornecedor: "Fornecedor", comprador: "Comprador", produto: "Produto", cliente: "Cliente",
};

// Par de cores de gráfico da marca (navy/âmbar que passam no validador de dataviz).
const COR_BARRA = "#3d47a8";
const COR_SELECIONADA = "#c2820a";

type Params = { mes?: string; dia?: string } & FiltrosCorte;

/** Hoje em Recife ("yyyy-mm-dd") — o gráfico do mês corrente para no dia de hoje. */
const hojeRecife = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Recife" });

/** Pedido no Winthor: abre a consulta de pedidos já filtrada (o pedido é anterior ao corte). */
function hrefPedido(l: LinhaCorte): string {
  const d = new Date(`${l.dia}T12:00:00`);
  d.setDate(d.getDate() - 90);
  const ini = d.toISOString().slice(0, 10);
  return `/pedidos?buscar=1&numped=${l.numped}&ini=${ini}&fim=${l.dia}`;
}

/**
 * Cortes: o que foi pedido e não saiu (PCCORTEI). Valor = quantidade cortada ×
 * preço de venda do item. Ao vivo do Winthor, filiais 1 e 11.
 */
export default async function CortesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const filtros: FiltrosCorte = {};
  for (const d of DIMENSOES_CORTE) if (typeof sp[d] === "string" && sp[d]) filtros[d] = sp[d];
  const temFiltro = Object.keys(filtros).length > 0;
  const mes = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const mesFechado = mes < primeiroDiaDoMes();
  const { inicio, fim } = inicioFimDoMes(mes);
  // Dia só vale dentro do mês escolhido.
  const dia = typeof sp.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.dia) && sp.dia >= inicio && sp.dia <= fim ? sp.dia : null;
  const mesAnt = mesAnterior(mes);
  const mesAntCurto = formatMesAno(mesAnt).slice(0, 3);
  const mesLabel = `${formatMesAno(mes)}${mesFechado ? " · mês fechado" : " · em andamento"}`;
  const url = (over: Partial<Params>) => {
    const p = { mes, dia: dia ?? undefined, ...filtros, ...over };
    const q = new URLSearchParams();
    if (p.mes && p.mes !== primeiroDiaDoMes()) q.set("mes", p.mes);
    if (p.dia) q.set("dia", p.dia);
    for (const d of DIMENSOES_CORTE) if (p[d]) q.set(d, p[d]!);
    const s = q.toString();
    return s ? `/cortes?${s}` : "/cortes";
  };
  // Mudar de mês mantém os filtros (o dia não: é daquele mês); clicar de novo no item ativo tira o filtro.
  const href = (m: string) => url({ mes: m, dia: undefined });
  const alternar = (d: DimensaoCorte, chave: string) => url({ [d]: filtros[d] === chave ? undefined : chave });
  const alternarDia = (d: string) => url({ dia: dia === d ? undefined : d });

  // Tudo do Oracle em paralelo (~0,5 s). O faturamento (view lenta, ~7 s) NÃO
  // entra aqui: o card da taxa carrega à parte, num <Suspense>.
  let linhas: LinhaCorte[];
  let linhasAnt: LinhaCorte[];
  let meses: Awaited<ReturnType<typeof lerCortesMensais>>;
  try {
    const ant = inicioFimDoMes(mesAnt);
    [linhas, linhasAnt, meses] = await Promise.all([
      lerCortes(inicio, fim),
      lerCortes(ant.inicio, ant.fim),
      lerCortesMensais(mesAnterior(INICIO_HISTORICO), fim),
    ]);
  } catch (e) {
    console.error("[cortes]", e);
    return (
      <div>
        <PageHeader title="Cortes" subtitle={`${mesLabel} · Winthor`}>
          <MesNav mes={mes} hrefFor={href} />
        </PageHeader>
        <Card className="p-6 text-sm text-slate-500">Sem acesso ao Winthor agora — tente de novo em instantes.</Card>
      </div>
    );
  }

  const total = resumoCortes(linhas);
  const filtradas = filtrarCortes(linhas, filtros);
  // Mês inteiro com os filtros (o gráfico por dia mostra todos os dias) e o recorte do dia, se houver.
  const rMes = temFiltro ? resumoCortes(filtradas) : total;
  const r = dia ? resumoCortes(filtradas, dia) : rMes;
  const doDia = dia ? filtradas.filter((l) => l.dia === dia) : filtradas;
  // Mês anterior com os MESMOS filtros: a comparação vale também com filtro ligado.
  // Com um dia escolhido não compara (dia × mês não é comparação justa).
  const rAnt = resumoCortes(filtrarCortes(linhasAnt, filtros));
  const vs = (atual: number, anterior: number) => (dia ? null : variacaoCorte(atual, anterior, mesAntCurto));
  const vValor = vs(r.valor, rAnt.valor);
  const vItens = vs(r.itens, rAnt.itens);
  const vSkus = vs(r.skus, rAnt.skus);
  const top = [...doDia].sort((a, b) => b.valor - a.valor).slice(0, 20);
  const serie = serieDiaria(rMes.porDia, inicio, mesFechado ? fim : hojeRecife() < fim ? hojeRecife() : fim);
  const detalheItens = `${inteiro.format(r.pedidos)} pedidos · ${inteiro.format(r.clientes)} clientes`;
  const detalheProdutos = `${inteiro.format(r.qt)} un · ${formatKg(r.kg)} · ${r.valor > 0 ? formatPercent(r.harpia / r.valor, 0) : "—"} na separação`;

  return (
    <div>
      <PageHeader title="Cortes" subtitle={`${mesLabel} · filiais 1 e 11`}>
        {/* Planilha do mês com os mesmos filtros da tela. <a> e não <Link>: é download. */}
        <a
          href={url({}).replace(/^\/cortes/, "/cortes/export")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
          </svg>
          Exportar planilha
        </a>
        <MesNav mes={mes} hrefFor={href} />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardVariacao
          label="Valor cortado"
          value={brl0(r.valor)}
          variacao={vValor}
          semVariacao={dia ? `de ${brl0(rMes.valor)} no mês` : temFiltro ? `de ${brl0(total.valor)} no mês` : "venda que não saiu"}
          title={temFiltro || dia ? `${brl0(total.valor)} de corte no mês, sem filtro` : "Quantidade cortada × preço de venda do item no pedido"}
          accent="red"
        />
        {temFiltro || dia ? (
          <StatCard
            label="Do corte do mês"
            value={total.valor > 0 ? formatPercent(r.valor / total.valor, 1) : "—"}
            hint={dia ? `dia ${formatDataBR(dia).slice(0, 5)}` : "participação do filtro"}
          />
        ) : (
          <Suspense fallback={<div className="h-[104px] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />}>
            <CardTaxa mes={mes} mesAnt={mesAnt} mesAntCurto={mesAntCurto} valor={total.valor} valorAnt={rAnt.valor} />
          </Suspense>
        )}
        <CardVariacao label="Itens cortados" value={inteiro.format(r.itens)} variacao={vItens} semVariacao={detalheItens} title={detalheItens} />
        <CardVariacao label="Produtos" value={inteiro.format(r.skus)} variacao={vSkus} semVariacao={detalheProdutos} title={detalheProdutos} />
      </div>

      {(temFiltro || dia) && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {dia && (
            <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#eef0fb] py-1 pl-3 pr-1 text-sm font-semibold text-[#1b2168]">
              <span className="truncate">Dia: {formatDataBR(dia)}</span>
              <Link href={url({ dia: undefined })} scroll={false} aria-label="Remover filtro de dia" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:bg-white">
                ✕
              </Link>
            </span>
          )}
          {DIMENSOES_CORTE.filter((d) => filtros[d]).map((d) => (
            <span key={d} className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#eef0fb] py-1 pl-3 pr-1 text-sm font-semibold text-[#1b2168]">
              <span className="truncate">
                {NOME_DIM[d]}: {rotuloFiltro(linhas, d, filtros[d]!)}
              </span>
              <Link
                href={url({ [d]: undefined })}
                scroll={false}
                aria-label={`Remover filtro de ${NOME_DIM[d].toLowerCase()}`}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:bg-white"
              >
                ✕
              </Link>
            </span>
          ))}
          <Link href={url({ dia: undefined, ...Object.fromEntries(DIMENSOES_CORTE.map((d) => [d, undefined])) })} scroll={false} className="text-xs font-medium text-amber-600 hover:text-amber-700">
            limpar filtros
          </Link>
        </div>
      )}

      {filtradas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">{temFiltro ? "Nenhum corte com esses filtros neste mês." : "Nenhum corte neste mês."}</Card>
      ) : (
        <>
          <div className="mb-6 grid gap-6 lg:grid-cols-3">
            <section className="min-w-0 lg:col-span-2">
              <SectionTitle>Dia a dia</SectionTitle>
              <Card className="p-5">
                <BarrasDia serie={serie} ativo={dia} hrefDia={alternarDia} />
              </Card>
            </section>
            <Bloco titulo="Origem" grupos={r.porOrigem} dim="origem" ativo={filtros.origem} alternar={alternar} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Bloco titulo="Motivos" grupos={r.porMotivo} dim="motivo" ativo={filtros.motivo} alternar={alternar} />
            <Bloco titulo="Quem cortou (Harpia)" grupos={r.porUsuario} dim="usuario" ativo={filtros.usuario} alternar={alternar} vazio="Nenhum corte registrado pelo Harpia." />
            <Bloco titulo="Fornecedores" grupos={r.porFornecedor} dim="fornecedor" ativo={filtros.fornecedor} alternar={alternar} />
            <Bloco titulo="Compradores" grupos={r.porComprador} dim="comprador" ativo={filtros.comprador} alternar={alternar} />
            <Bloco titulo="Produtos" grupos={r.porProduto} dim="produto" ativo={filtros.produto} alternar={alternar} />
            <Bloco titulo="Clientes" grupos={r.porCliente} dim="cliente" ativo={filtros.cliente} alternar={alternar} />
          </div>

          <section className="mt-6">
            <SectionTitle>{temFiltro ? "Mês a mês · todos os cortes" : "Mês a mês"}</SectionTitle>
            <Card className="p-5">
              <BarList
                tone="navy"
                items={meses.filter((m) => m.mes >= INICIO_HISTORICO).map((m) => ({
                  label: formatMesAno(m.mes),
                  value: m.valor,
                  display: brl0(m.valor),
                  href: href(m.mes),
                }))}
              />
            </Card>
          </section>

          <section className="mt-6">
            <SectionTitle>{dia ? `Maiores cortes · ${formatDataBR(dia)}` : "Maiores cortes"}</SectionTitle>
            <Card className="overflow-hidden">
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[860px] text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Data</th>
                      <th className="px-4 py-3 font-semibold">Pedido</th>
                      <th className="px-4 py-3 font-semibold">Produto</th>
                      <th className="px-4 py-3 font-semibold">Cliente</th>
                      <th className="px-4 py-3 text-right font-semibold">Qtd</th>
                      <th className="px-4 py-3 text-right font-semibold">Valor</th>
                      <th className="px-4 py-3 font-semibold">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((l, i) => {
                      const m = lerMotivo(l.motivo);
                      return (
                        <tr key={i} className="border-b border-slate-50 last:border-0">
                          <td className="px-4 py-2.5 whitespace-nowrap tabular-nums text-slate-500">{formatDataBR(l.dia)}</td>
                          <td className="px-4 py-2.5 tabular-nums">
                            {l.temPedido ? (
                              <Link href={hrefPedido(l)} className="text-[#2a327f] hover:underline">{l.numped}</Link>
                            ) : (
                              <span className="text-slate-400" title="Pedido cortado inteiro: não está mais no Winthor">{l.numped}</span>
                            )}
                          </td>
                          <td className="max-w-[16rem] truncate px-4 py-2.5 font-medium text-[#141a4d]" title={l.produto}>
                            {l.codprod} · {l.produto}
                          </td>
                          <td className="max-w-[14rem] truncate px-4 py-2.5 text-slate-600" title={l.cliente ?? undefined}>{l.cliente ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right tabular-nums text-slate-600">{inteiro.format(l.qt)}</td>
                          <td className="px-4 py-2.5 text-right font-semibold whitespace-nowrap tabular-nums text-[#141a4d]">{formatBRL(l.valor)}</td>
                          <td className="max-w-[14rem] truncate px-4 py-2.5 text-slate-500" title={m.usuario ? `${m.motivo} · ${m.usuario}` : m.motivo}>
                            {m.motivo}
                            {m.usuario && <span className="text-slate-400"> · {m.usuario}</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <ul className="divide-y divide-slate-100 md:hidden">
                {top.map((l, i) => {
                  const m = lerMotivo(l.motivo);
                  return (
                    <li key={i} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 truncate font-medium text-[#141a4d]">{l.produto}</p>
                        <span className="shrink-0 font-semibold tabular-nums text-[#141a4d]">{formatBRL(l.valor)}</span>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {formatDataBR(l.dia)} ·{" "}
                        {l.temPedido ? (
                          <Link href={hrefPedido(l)} className="text-[#2a327f] underline-offset-2 hover:underline">ped. {l.numped}</Link>
                        ) : (
                          <span>ped. {l.numped}</span>
                        )}{" "}
                        · {inteiro.format(l.qt)} un · {l.cliente ?? "—"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-slate-400">
                        {m.motivo}
                        {m.usuario ? ` · ${m.usuario}` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}

/** Card com a comparação contra o mês anterior como dado de apoio (rose só quando piora). */
function CardVariacao({
  label, value, variacao, semVariacao, title, accent,
}: {
  label: string;
  value: string;
  variacao: VariacaoCorte | null;
  semVariacao: string;
  title: string;
  accent?: "red";
}) {
  return (
    <StatCard
      label={label}
      value={value}
      accent={accent}
      hint={variacao?.texto ?? semVariacao}
      hintRuim={variacao?.piorou ?? false}
      title={variacao ? `${title} · ${variacao.texto}` : title}
    />
  );
}

/**
 * Taxa de corte (corte ÷ (corte + venda líquida)) e a variação em p.p. contra o
 * mês anterior. Fica num <Suspense>: a venda líquida vem ao vivo da view de
 * faturamento (~7 s), e o resto da página não espera por ela. O mês anterior
 * (fechado) usa a foto do Supabase — sem segunda varredura da view.
 */
async function CardTaxa({
  mes, mesAnt, mesAntCurto, valor, valorAnt,
}: {
  mes: string;
  mesAnt: string;
  mesAntCurto: string;
  valor: number;
  valorAnt: number;
}) {
  const [fat, fotos] = await Promise.all([
    getResumoFaturamentoDashboard(mes).catch(() => null),
    vendaLiquidaDasFotos([mesAnt]).catch(() => new Map<string, number>()),
  ]);
  const taxa = taxaCorte(valor, fat?.vendaLiquida ?? null);
  const taxaAnt = taxaCorte(valorAnt, fotos.get(mesAnt) ?? null);
  const v = variacaoTaxaCorte(taxa, taxaAnt, mesAntCurto);
  const base = "Corte ÷ (corte + venda líquida da 111)";
  return (
    <StatCard
      label="Do que foi pedido"
      value={taxa === null ? "—" : formatPercent(taxa, 2)}
      hint={fat?.foto ? "Winthor fora · foto do mês" : (v?.texto ?? "corte ÷ (corte + venda líquida)")}
      hintRuim={!fat?.foto && (v?.piorou ?? false)}
      title={v ? `${base} · ${v.texto}` : base}
    />
  );
}

/**
 * Valor cortado por dia do mês. Cada barra é um link: clica filtra o dia,
 * clica de novo tira. Detalhe do dia no hover (title), sem legenda na tela.
 */
function BarrasDia({ serie, ativo, hrefDia }: { serie: { dia: string; valor: number }[]; ativo: string | null; hrefDia: (dia: string) => string }) {
  const max = Math.max(1, ...serie.map((d) => d.valor));
  return (
    <div>
      <div className="flex h-40 items-end gap-[3px]">
        {serie.map((d, i) => {
          const sel = ativo === d.dia;
          const barra = (
            <div
              className="crescer-y w-full rounded-t-sm transition group-hover:brightness-125"
              style={{
                "--i": i,
                height: d.valor > 0 ? `${Math.max(3, (d.valor / max) * 100)}%` : "0",
                background: sel ? COR_SELECIONADA : COR_BARRA,
                opacity: ativo && !sel ? 0.35 : 1,
              } as CSSProperties}
            />
          );
          const dica = `${formatDataBR(d.dia)} · ${d.valor > 0 ? brl0(d.valor) : "sem corte"}`;
          return d.valor > 0 ? (
            <Link key={d.dia} href={hrefDia(d.dia)} scroll={false} title={`${dica} · clique para ${sel ? "tirar o filtro" : "filtrar"}`} aria-current={sel ? "true" : undefined} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
              {barra}
            </Link>
          ) : (
            <div key={d.dia} title={dica} className="flex h-full min-w-0 flex-1 flex-col justify-end border-b border-slate-200">
              {barra}
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-[3px]">
        {serie.map((d) => {
          const n = Number(d.dia.slice(8));
          const mostra = ativo === d.dia || (!ativo && (n === 1 || n % 5 === 0));
          return (
            <span key={d.dia} className={`min-w-0 flex-1 text-center text-[0.65rem] font-semibold tabular-nums ${ativo === d.dia ? "text-[#c2820a]" : "text-slate-400"}`}>
              {mostra ? n : ""}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function Bloco({
  titulo, grupos, dim, ativo, alternar, vazio = "Sem dados.",
}: {
  titulo: string;
  grupos: GrupoCorte[];
  dim: DimensaoCorte;
  ativo?: string;
  alternar: (d: DimensaoCorte, chave: string) => string;
  vazio?: string;
}) {
  const itens = grupos.slice(0, 8);
  return (
    <section>
      <SectionTitle>{titulo}</SectionTitle>
      <Card className="p-5">
        {itens.length === 0 ? (
          <p className="text-sm text-slate-400">{vazio}</p>
        ) : (
          <BarList
            items={itens.map((g) => ({ label: g.rotulo, value: g.valor, display: brl0(g.valor), href: alternar(dim, g.chave), active: ativo === g.chave }))}
          />
        )}
      </Card>
    </section>
  );
}

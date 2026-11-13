import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { lerCortes, lerEstoqueDosCortados } from "@/data/cortes";
import { getResumoFaturamentoPeriodo } from "@/data/faturamento-mensal";
import {
  resumoCortes, taxaCorte, filtrarCortes, rotuloFiltro, porProdutoDetalhado, serieSemanal, variacaoPct,
  DIMENSOES_CORTE, type DimensaoCorte, type FiltrosCorte, type GrupoCorte, type ResumoCortes, type ProdutoCortado,
} from "@/domain/cortes";
import { formatBRL, formatPercent } from "@/domain/format";
import { lerPeriodo, mesDoPeriodo, paramsDoPeriodo, periodoAberto, periodoAnterior, rotuloCurto, rotuloPeriodo, type Periodo } from "@/domain/periodo";
import { PageHeader, Card, BarList } from "@/components/ui";
import TabelaAuditoria, { type LinhaAuditoria } from "./tabela-auditoria";

// Layout no padrão do app Flask do colega (app_cortes, aba "Cortes & Rupturas"):
// filtros → 6 indicadores → análise atual × anterior → gráficos → auditoria por
// produto. Os números seguem as regras do Centro: filiais 1 e 11, todo corte
// gravado no PCCORTEI, valor = quantidade cortada × preço de venda do item.

const inteiro = new Intl.NumberFormat("pt-BR");
const brl0 = (v: number) => formatBRL(Math.round(v)).replace(/,00$/, "");
const pct = (v: number | null, casas = 1) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${formatPercent(Math.abs(v), casas)}`);

const NOME_DIM: Record<DimensaoCorte, string> = {
  origem: "Área", hora: "Hora", motivo: "Motivo", usuario: "Conferente", fornecedor: "Fornecedor", comprador: "Comprador", produto: "Produto", cliente: "Cliente",
};

// Área responsável, como no Flask: corte registrado pelo Harpia na separação é da
// Logística; o feito no Winthor é do Administrativo / Comercial.
const AREAS = [
  { valor: "", rotulo: "Visão geral" },
  { valor: "Separação (Harpia)", rotulo: "Logística" },
  { valor: "Winthor", rotulo: "Administrativo / Comercial" },
] as const;

type Params = { mes?: string; de?: string; ate?: string } & FiltrosCorte;

const rotuloCampo = "text-xs font-bold uppercase tracking-wide text-slate-500";
const campo =
  "w-full rounded-lg border border-slate-300 bg-[#F4F7FA] p-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-300/50";
const tituloCard = "mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500";

export default async function CortesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const filtros: FiltrosCorte = {};
  for (const d of DIMENSOES_CORTE) if (typeof sp[d] === "string" && sp[d]) filtros[d] = sp[d];
  // Período (mês por padrão). Piso = histórico (jul/2026): PCCORTEI de 2025 tem o erro da época.
  const periodo = lerPeriodo(sp);
  const pAnt = periodoAnterior(periodo);
  const { de: inicio, ate: fim } = periodo;
  const mesUnico = mesDoPeriodo(periodo);
  const mesLabel = `${rotuloPeriodo(periodo)}${periodoAberto(periodo) ? " · em andamento" : mesUnico ? " · mês fechado" : " · fechado"}`;

  const url = (over: Partial<Params>) => {
    const p = { ...paramsDoPeriodo(periodo), ...filtros, ...over } as Params;
    const q = new URLSearchParams();
    if (p.mes) q.set("mes", p.mes);
    if (p.de) q.set("de", p.de);
    if (p.ate) q.set("ate", p.ate);
    for (const d of DIMENSOES_CORTE) if (p[d]) q.set(d, p[d]!);
    const s = q.toString();
    return s ? `/cortes?${s}` : "/cortes";
  };
  // Clicar numa barra filtra; clicar de novo no item ativo tira o filtro.
  const alternar = (d: DimensaoCorte, chave: string) => url({ [d]: filtros[d] === chave ? undefined : chave });

  let linhas;
  let linhasAnt;
  try {
    [linhas, linhasAnt] = await Promise.all([lerCortes(inicio, fim), lerCortes(pAnt.de, pAnt.ate)]);
  } catch (e) {
    console.error("[cortes]", e);
    return (
      <div>
        <PageHeader title="Cortes & Rupturas" subtitle={`${mesLabel} · Winthor`} />
        <Card className="p-6 text-sm text-slate-500">Sem acesso ao Winthor agora — tente de novo em instantes.</Card>
      </div>
    );
  }

  const filtradas = filtrarCortes(linhas, filtros);
  const r = resumoCortes(filtradas);
  const rAnt = resumoCortes(filtrarCortes(linhasAnt, filtros));
  const produtos = porProdutoDetalhado(filtradas);
  const outrosFiltros = DIMENSOES_CORTE.filter((d) => d !== "origem" && filtros[d]);
  const vs = `vs ${rotuloCurto(pAnt)}`;
  const comVariacao = (base: string, atual: number, anterior: number) => {
    const v = variacaoPct(atual, anterior);
    return v === null ? base : `${base} · ${pct(v)} ${vs}`;
  };

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Cortes & Rupturas" subtitle={`${mesLabel} · filiais 1 e 11`} />

      {/* Filtros: GET simples — período, área e os demais filtros ativos seguem juntos. */}
      <details open className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-100 pb-2 text-lg font-bold text-slate-700">
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6 8v5l-4 2v-7z" /></svg>
            Filtros (Cortes)
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 transition group-open:rotate-180" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <form action="/cortes" className="mt-4 grid w-full grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap sm:gap-4">
          {outrosFiltros.map((d) => <input key={d} type="hidden" name={d} value={filtros[d]} />)}
          <label className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-1 sm:max-w-[240px]">
            <span className={rotuloCampo}>Data inicial</span>
            <input type="date" name="de" defaultValue={inicio} className={campo} />
          </label>
          <label className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-1 sm:max-w-[240px]">
            <span className={rotuloCampo}>Data final</span>
            <input type="date" name="ate" defaultValue={fim} className={campo} />
          </label>
          <label className="col-span-2 flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-1 sm:max-w-[240px]">
            <span className={rotuloCampo}>Área responsável</span>
            <select name="origem" defaultValue={filtros.origem ?? ""} className={campo}>
              {AREAS.map((a) => <option key={a.valor} value={a.valor}>{a.rotulo}</option>)}
            </select>
          </label>
          <div className="col-span-2 flex w-full flex-wrap items-center gap-3 md:ml-auto md:w-auto">
            <button type="submit" className="flex items-center gap-2 rounded-xl bg-[#141a4d] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1b2168]">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></svg>
              Atualizar dados
            </button>
            {/* Planilha com os mesmos filtros da tela. <a> e não <Link>: é download. */}
            <a
              href={url({}).replace(/^\/cortes/, "/cortes/export")}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-[#F4F7FA]"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
              </svg>
              Exportar planilha de cortes
            </a>
          </div>
        </form>
      </details>

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        <Kpi titulo="Valor perdido (venda)" valor={brl0(r.valor)} legenda="prejuízo bruto em vendas" cor="text-rose-600" borda="border-t-rose-500"
          title={comVariacao("Quantidade cortada × preço de venda do item no pedido", r.valor, rAnt.valor)} />
        <Kpi titulo="Valor perdido (custo)" valor={brl0(r.custo)} legenda="custo da mercadoria cortada" cor="text-amber-600" borda="border-t-amber-500"
          title={comVariacao("Quantidade cortada × custo financeiro de hoje (PCEST.CUSTOFIN)", r.custo, rAnt.custo)} />
        <Suspense fallback={<KpiCarregando />}>
          <KpiTaxa periodo={periodo} valor={r.valor} />
        </Suspense>
        <Kpi titulo="Total SKUs cortados" valor={`${inteiro.format(r.skus)} SKUs`} legenda="produtos distintos afetados" cor="text-[#1b2168]" borda="border-t-[#2a327f]"
          title={comVariacao(`${inteiro.format(r.pedidos)} pedidos · ${inteiro.format(r.clientes)} clientes`, r.skus, rAnt.skus)} />
        <Kpi titulo="Volume total cortado" valor={`${inteiro.format(r.qt)} un`} legenda="unidades físicas de itens" cor="text-[#3d47a8]" borda="border-t-[#3d47a8]"
          title={comVariacao(`${inteiro.format(r.itens)} itens de pedido cortados`, r.qt, rAnt.qt)} />
        <Suspense fallback={<KpiCarregando />}>
          <KpiFaturamento periodo={periodo} />
        </Suspense>
      </section>

      {outrosFiltros.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {outrosFiltros.map((d) => (
            <span key={d} className="inline-flex max-w-full items-center gap-2 rounded-full bg-[#eef0fb] py-1 pl-3 pr-1 text-sm font-semibold text-[#1b2168]">
              <span className="truncate">{NOME_DIM[d]}: {rotuloFiltro(linhas, d, filtros[d]!)}</span>
              <Link href={url({ [d]: undefined })} scroll={false} aria-label={`Remover filtro de ${NOME_DIM[d].toLowerCase()}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition hover:bg-white">
                ✕
              </Link>
            </span>
          ))}
          <Link href={url(Object.fromEntries(outrosFiltros.map((d) => [d, undefined])))} scroll={false} className="text-xs font-medium text-amber-600 hover:text-amber-700">
            limpar filtros
          </Link>
        </div>
      )}

      <Suspense fallback={<div className="h-56 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />}>
        <AnaliseSituacao periodo={periodo} periodoAnt={pAnt} atual={r} anterior={rAnt} />
      </Suspense>

      {filtradas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">Nenhum corte com esses filtros {mesUnico ? "neste mês" : "neste período"}.</Card>
      ) : (
        <>
          <section className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
            <Grafico titulo="Compradores afetados" grupos={r.porComprador} top={10} dim="comprador" ativo={filtros.comprador} alternar={alternar} />
            <Grafico titulo="Top 10 fornecedores afetados" grupos={r.porFornecedor} top={10} dim="fornecedor" ativo={filtros.fornecedor} alternar={alternar} />
            <Grafico titulo="Top 10 produtos mais cortados" grupos={r.porProduto} top={10} dim="produto" ativo={filtros.produto} alternar={alternar} />
            <Painel titulo="Cortes por semana">
              <BarList tone="navy" items={serieSemanal(r.porDia).map((s) => ({ label: s.rotulo, value: s.valor, display: brl0(s.valor) }))} />
            </Painel>
            <Grafico titulo="Clientes mais afetados financeiramente" grupos={r.porCliente} top={10} dim="cliente" ativo={filtros.cliente} alternar={alternar} />
            <Grafico titulo="Motivos do corte registrados" grupos={r.porMotivo} top={15} dim="motivo" ativo={filtros.motivo} alternar={alternar} />
            <Grafico titulo="Top 5 conferentes (Harpia)" grupos={r.porUsuario} top={5} dim="usuario" ativo={filtros.usuario} alternar={alternar} vazio="Nenhum corte registrado pelo Harpia." />
          </section>

          <section>
            <h3 className={tituloCard}>Auditoria estrutural · todos os produtos cortados no período ({inteiro.format(produtos.length)})</h3>
            <Suspense fallback={<TabelaAuditoria linhas={paraAuditoria(produtos, null, (c) => alternar("produto", String(c)))} carregandoEstoque />}>
              <Auditoria produtos={produtos} inicio={inicio} fim={fim} hrefProduto={(c) => alternar("produto", String(c))} />
            </Suspense>
          </section>
        </>
      )}
    </div>
  );
}

/** Indicador com faixa colorida no topo, no padrão dos cards do Flask. Detalhe no hover. */
function Kpi({ titulo, valor, legenda, cor, borda, title }: { titulo: string; valor: string; legenda: string; cor: string; borda: string; title?: string }) {
  return (
    <div title={title} className={`entrar flex min-h-[110px] min-w-0 flex-col justify-between rounded-2xl border border-t-4 border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5 ${borda}`}>
      <h3 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">{titulo}</h3>
      <p className={`truncate text-lg font-black tracking-tight tabular-nums sm:text-xl xl:text-2xl ${cor}`}>{valor}</p>
      <span className="text-[10px] font-medium text-slate-400">{legenda}</span>
    </div>
  );
}

const KpiCarregando = () => <div className="min-h-[110px] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />;

/**
 * % de cortes (perda) = corte ÷ (corte + venda líquida da 111). A venda líquida
 * vem ao vivo da view de faturamento (~7 s): carrega à parte, sem segurar a página.
 */
async function KpiTaxa({ periodo, valor }: { periodo: Periodo; valor: number }) {
  const fat = await getResumoFaturamentoPeriodo(periodo.de, periodo.ate).catch(() => null);
  const taxa = taxaCorte(valor, fat?.vendaLiquida ?? null);
  return (
    <Kpi titulo="% Cortes (perda)" valor={taxa === null ? "—" : formatPercent(taxa, 2)} legenda="proporção sobre faturado" cor="text-rose-500" borda="border-t-rose-400"
      title={`Corte ÷ (corte + venda líquida da 111)${fat?.foto ? " · Winthor fora, venda da última foto" : ""}`} />
  );
}

async function KpiFaturamento({ periodo }: { periodo: Periodo }) {
  const fat = await getResumoFaturamentoPeriodo(periodo.de, periodo.ate).catch(() => null);
  return (
    <Kpi titulo="Faturamento líquido" valor={fat ? brl0(fat.vendaLiquida) : "—"} legenda="base realizada no período" cor="text-emerald-600" borda="border-t-emerald-500"
      title={`Venda líquida da rotina 111 (filiais 1 e 11)${fat?.foto ? " · Winthor fora, última foto" : ""}`} />
  );
}

/** Atual × anterior, com a linha de resultado. Rose = piorou; o resto fica neutro. */
async function AnaliseSituacao({ periodo, periodoAnt, atual, anterior }: { periodo: Periodo; periodoAnt: Periodo; atual: ResumoCortes; anterior: ResumoCortes }) {
  const [fat, fatAnt] = await Promise.all([
    getResumoFaturamentoPeriodo(periodo.de, periodo.ate).catch(() => null),
    getResumoFaturamentoPeriodo(periodoAnt.de, periodoAnt.ate).catch(() => null),
  ]);
  const linha = (r: ResumoCortes, f: typeof fat) => ({
    fat: f?.vendaLiquida ?? null,
    venda: r.valor,
    custo: r.custo,
    taxa: taxaCorte(r.valor, f?.vendaLiquida ?? null),
    skus: r.skus,
    qt: r.qt,
  });
  const a = linha(atual, fat);
  const b = linha(anterior, fatAnt);
  const dataBR = (iso: string) => iso.split("-").reverse().join("/");
  const faixa = (p: Periodo) => `${dataBR(p.de)} a ${dataBR(p.ate)}`;
  const brl = (v: number | null) => (v === null ? "—" : brl0(v));
  // Resultado: % de variação; na taxa, diferença em pontos percentuais.
  const res = (x: number | null, y: number | null, subirEhBom = false) => {
    if (x === null || y === null) return <span className="text-slate-400">—</span>;
    const v = variacaoPct(x, y);
    if (v === null) return <span className="text-slate-400">—</span>;
    const ruim = subirEhBom ? v < 0 : v > 0;
    return <span className={`font-semibold ${ruim && Math.abs(v) >= 0.0005 ? "text-rose-600" : "text-[#1b2168]"}`}>{pct(v)}</span>;
  };
  const resTaxa = () => {
    if (a.taxa === null || b.taxa === null) return <span className="text-slate-400">—</span>;
    const pp = (a.taxa - b.taxa) * 100;
    const txt = `${pp > 0 ? "+" : pp < 0 ? "−" : ""}${Math.abs(pp).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} p.p.`;
    return <span className={`font-semibold ${pp >= 0.005 ? "text-rose-600" : "text-[#1b2168]"}`}>{txt}</span>;
  };
  const colunas: { rotulo: string; ant: ReactNode; atu: ReactNode; res: ReactNode }[] = [
    { rotulo: "Faturamento líquido", ant: brl(b.fat), atu: brl(a.fat), res: res(a.fat, b.fat, true) },
    { rotulo: "Valor perdido (venda)", ant: brl(b.venda), atu: brl(a.venda), res: res(a.venda, b.venda) },
    { rotulo: "Valor perdido (custo)", ant: brl(b.custo), atu: brl(a.custo), res: res(a.custo, b.custo) },
    { rotulo: "% Cortes (perda)", ant: b.taxa === null ? "—" : formatPercent(b.taxa, 2), atu: a.taxa === null ? "—" : formatPercent(a.taxa, 2), res: resTaxa() },
    { rotulo: "SKUs cortados", ant: inteiro.format(b.skus), atu: inteiro.format(a.skus), res: res(a.skus, b.skus) },
    { rotulo: "Volume cortado", ant: inteiro.format(b.qt), atu: inteiro.format(a.qt), res: res(a.qt, b.qt) },
  ];
  const th = "bg-[#F4F7FA] p-4 font-semibold text-slate-700 border-b border-slate-200";
  const td = "p-4 border-b border-slate-100 tabular-nums";
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={tituloCard}>Análise de situação de corte</h3>
        <p className="text-xs text-slate-400">Atual: {faixa(periodo)} · Anterior: {faixa(periodoAnt)}</p>
      </div>
      {/* Desktop: a tabela do Flask */}
      <div className="hidden w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full whitespace-nowrap text-left text-sm text-slate-600">
          <thead>
            <tr>
              <th className={th}>Data</th>
              {colunas.map((c) => <th key={c.rotulo} className={th}>{c.rotulo}</th>)}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={td}>{faixa(periodoAnt)}</td>
              {colunas.map((c) => <td key={c.rotulo} className={td}>{c.ant}</td>)}
            </tr>
            <tr>
              <td className={`${td} font-semibold text-[#141a4d]`}>{faixa(periodo)}</td>
              {colunas.map((c) => <td key={c.rotulo} className={`${td} font-semibold text-[#141a4d]`}>{c.atu}</td>)}
            </tr>
            <tr>
              <td className={td}>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#141a4d]">Resultado</span>
                <span className="mt-0.5 block text-[10px] font-medium text-slate-400">atual × anterior</span>
              </td>
              {colunas.map((c) => <td key={c.rotulo} className={td}>{c.res}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      {/* Mobile: um bloco por indicador */}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm md:hidden">
        {colunas.map((c) => (
          <li key={c.rotulo} className="grid grid-cols-3 gap-2 px-4 py-3 text-sm">
            <span className="col-span-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">{c.rotulo}</span>
            <span className="tabular-nums text-slate-500">{c.ant}</span>
            <span className="tabular-nums font-semibold text-[#141a4d]">{c.atu}</span>
            <span className="text-right tabular-nums">{c.res}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Painel({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Card className="flex min-w-0 flex-col p-4 sm:p-5">
      <h3 className={tituloCard}>{titulo}</h3>
      {children}
    </Card>
  );
}

/** Ranking em barras: clica filtra a tela toda, clica de novo tira. */
function Grafico({
  titulo, grupos, top, dim, ativo, alternar, vazio = "Sem dados.",
}: {
  titulo: string;
  grupos: GrupoCorte[];
  top: number;
  dim: DimensaoCorte;
  ativo?: string;
  alternar: (d: DimensaoCorte, chave: string) => string;
  vazio?: string;
}) {
  const itens = grupos.slice(0, top);
  return (
    <Painel titulo={titulo}>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-400">{vazio}</p>
      ) : (
        <BarList items={itens.map((g) => ({ label: g.rotulo, value: g.valor, display: brl0(g.valor), href: alternar(dim, g.chave), active: ativo === g.chave }))} />
      )}
    </Painel>
  );
}

function paraAuditoria(produtos: ProdutoCortado[], estoque: Map<number, { hoje: number; naData: number }> | null, hrefProduto: (c: number) => string): LinhaAuditoria[] {
  return produtos.map((p) => ({
    codprod: p.codprod,
    produto: `${p.codprod} - ${p.produto}`,
    href: hrefProduto(p.codprod),
    cargas: p.cargas,
    comprador: p.comprador ?? "Sem comprador",
    cliente: p.cliente ?? `${inteiro.format(p.clientes)} clientes`,
    fornecedor: p.fornecedor ?? "Sem fornecedor",
    qt: p.qt,
    pedidos: p.pedidos,
    valor: p.valor,
    ultimoDia: p.ultimoDia,
    conferente: p.conferente,
    motivo: p.motivo,
    estoqueHoje: estoque ? (estoque.get(p.codprod)?.hoje ?? 0) : null,
    estoqueNaData: estoque ? (estoque.get(p.codprod)?.naData ?? 0) : null,
  }));
}

/** Auditoria com o estoque de hoje e do dia do corte (consulta à parte, ~4 s). */
async function Auditoria({ produtos, inicio, fim, hrefProduto }: { produtos: ProdutoCortado[]; inicio: string; fim: string; hrefProduto: (c: number) => string }) {
  const estoque = await lerEstoqueDosCortados(inicio, fim).catch(() => null);
  return <TabelaAuditoria linhas={paraAuditoria(produtos, estoque, hrefProduto)} semEstoque={estoque === null} />;
}

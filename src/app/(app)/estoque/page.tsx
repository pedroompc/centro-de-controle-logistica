import Link from "next/link";
import type { ReactNode } from "react";
import { lerContasPagar, lerProdutosEstoque } from "@/data/estoque";
import { compradores, linhasTabela, resumoEstoque, SITUACOES, TAXA_CUSTO_FINANCEIRO, type Fatia, type TipoTabela } from "@/domain/estoque";
import { formatBRL, formatPercent } from "@/domain/format";
import { PageHeader, Card, BarList } from "@/components/ui";
import TabelaEstoque from "./tabela-estoque";

// Excesso de estoque, ruptura e obsoletos — aba portada do app Flask do colega
// (app_cortes → "Excesso de Estoque"), no mesmo desenho: filtros, 3 cards de
// capital, 16 indicadores, 8 gráficos e a tabela de detalhe. Posição de hoje das
// filiais 1 e 11, todos os compradores; preço de venda = o praticado nos últimos
// 90 dias (PCMOV), não a estimativa custo × 1,35 do Flask.

export const dynamic = "force-dynamic";

const inteiro = new Intl.NumberFormat("pt-BR");
const brl0 = (v: number) => formatBRL(Math.round(v)).replace(/,00$/, "");
const pct2 = (v: number | null) => (v === null ? "—" : formatPercent(v, 2));
const hojeRecife = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Recife" });

const TABELAS: Record<TipoTabela, { titulo: string; arquivo: string }> = {
  excesso: { titulo: "Produtos em excesso", arquivo: "Excesso" },
  obsoletos: { titulo: "Produtos obsoletos (sem venda há mais de 45 dias)", arquivo: "ISV (>45d)" },
  ruptura: { titulo: "Cobertura e ruptura por SKU", arquivo: "Ruptura" },
};

const tituloCard = "mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500";
const campo =
  "w-full rounded-lg border border-slate-300 bg-[#F4F7FA] p-2.5 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-300/50";

type Params = { comprador?: string; tabela?: string };

export default async function EstoquePage({ searchParams }: { searchParams: Promise<Params> }) {
  const sp = await searchParams;
  const codComprador = sp.comprador && /^\d+$/.test(sp.comprador) ? Number(sp.comprador) : null;
  const tabela = (["excesso", "obsoletos", "ruptura"] as const).find((t) => t === sp.tabela) ?? null;
  const hoje = hojeRecife();

  const url = (over: Partial<Params>) => {
    const p = { comprador: codComprador === null ? undefined : String(codComprador), tabela: tabela ?? undefined, ...over };
    const q = new URLSearchParams();
    if (p.comprador) q.set("comprador", p.comprador);
    if (p.tabela) q.set("tabela", p.tabela);
    const s = q.toString();
    return s ? `/estoque?${s}` : "/estoque";
  };
  const exportar = (t: TipoTabela) => `/estoque/export?tipo=${t}${codComprador === null ? "" : `&comprador=${codComprador}`}`;

  let todos;
  let contas: number | null;
  try {
    [todos, contas] = await Promise.all([lerProdutosEstoque(), lerContasPagar(codComprador).catch(() => null)]);
  } catch (e) {
    console.error("[estoque]", e);
    return (
      <div>
        <PageHeader title="Excesso de Estoque" subtitle="Winthor" />
        <Card className="p-6 text-sm text-slate-500">Sem acesso ao Winthor agora — tente de novo em instantes.</Card>
      </div>
    );
  }
  const lista = compradores(todos);
  const ps = codComprador === null ? todos : todos.filter((p) => p.codcomprador === codComprador);
  const r = resumoEstoque(ps, hoje, contas);
  const nomeComprador = lista.find((c) => c.chave === String(codComprador))?.rotulo;

  const pequeno = (titulo: string, valor: string, dica: string, opts: { tabela?: TipoTabela; cor?: string } = {}) => ({ titulo, valor, dica, ...opts });
  const indicadores = [
    pequeno("Ativo compras", brl0(r.ativoCusto), "Estoque de hoje a preço de custo (PCEST.CUSTOFIN)"),
    pequeno("Limite ideal", brl0(r.limiteIdeal), "Estoque de 60 dias do giro dos 3 últimos meses, a custo"),
    pequeno("Cap. em excesso", brl0(r.excesso), "Capital acima do estoque ideal, a custo · clique para ver a tabela", { tabela: "excesso", cor: "text-rose-600" }),
    pequeno("Ativo venda", brl0(r.ativoVenda), `Estoque a preço praticado nos últimos 90 dias${r.semPreco ? ` · ${inteiro.format(r.semPreco)} SKUs com estoque e sem venda ficam de fora` : ""}`),
    pequeno("Oportunidade (R$)", brl0(r.falta), "Quanto falta, a custo, para chegar ao estoque ideal"),
    pequeno("Obsoletos (>45d)", `${inteiro.format(r.obsoletos)} SKUs`, "Com estoque, sem venda há mais de 45 dias e sem entrada nos últimos 30 · clique para ver a tabela", { tabela: "obsoletos" }),
    pequeno("Valor obsoletos", brl0(r.valorObsoletos), "Estoque dos obsoletos a custo · clique para ver a tabela", { tabela: "obsoletos", cor: "text-amber-600" }),
    pequeno("SKUs em ruptura", `${inteiro.format(r.rupturas)} SKUs`, "Estoque zerado ou negativo · clique para ver a tabela", { tabela: "ruptura", cor: "text-rose-600" }),
    pequeno("Venda mensal", brl0(r.vendaMensal), "Média mensal do que saiu em venda nos últimos 90 dias (PCMOV)"),
    pequeno("Custo fin. (1,5%)", brl0(r.custoFinanceiro), `${formatPercent(TAXA_CUSTO_FINANCEIRO, 1)} ao mês sobre o capital em excesso (taxa fixa do app Flask)`),
    pequeno("Markup", pct2(r.markup), "Venda ÷ custo − 1 das vendas dos últimos 90 dias (preço praticado)"),
    pequeno("Quebra em R$", pct2(r.quebraValor), "Quanto falta, a custo, para o estoque ideal de 60 dias, dividido pelo valor desse ideal"),
    pequeno("Quebra em SKUs", pct2(r.quebraSkus), "Parte dos SKUs ativos com estoque zerado"),
    pequeno("Índice obsoletos", pct2(r.indiceObsoletos), "Parte dos SKUs ativos que está obsoleta"),
    pequeno("Oportunidades", `${inteiro.format(r.oportunidades)} SKUs`, "SKUs abaixo do estoque ideal"),
    pequeno("SKUs ativos", inteiro.format(r.skus), "Produtos com estoque ou com venda nos 3 últimos meses"),
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <PageHeader title="Excesso de Estoque" subtitle={`Posição de hoje · filiais 1 e 11${nomeComprador ? ` · ${nomeComprador}` : ""}`} />

      <details open className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between border-b border-slate-100 pb-2 text-lg font-bold text-slate-700">
          <span className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6 8v5l-4 2v-7z" /></svg>
            Filtros (Excesso)
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 transition group-open:rotate-180" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <form action="/estoque" className="mt-4 flex w-full flex-wrap items-end gap-4">
          {tabela && <input type="hidden" name="tabela" value={tabela} />}
          <label className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:min-w-[240px]">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Filtrar por comprador</span>
            <select name="comprador" defaultValue={codComprador === null ? "" : String(codComprador)} className={campo}>
              <option value="">Todos os compradores</option>
              {lista.map((c) => <option key={c.chave} value={c.chave}>{c.rotulo}</option>)}
            </select>
          </label>
          <div className="flex w-full flex-wrap items-center gap-3 md:ml-auto md:w-auto">
            <button type="submit" className="flex items-center gap-2 rounded-xl bg-[#141a4d] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#1b2168]">
              Atualizar dashboard
            </button>
            {(Object.keys(TABELAS) as TipoTabela[]).map((t) => (
              <a key={t} href={exportar(t)} className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-[#F4F7FA]">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
                </svg>
                {TABELAS[t].arquivo}
              </a>
            ))}
          </div>
        </form>
      </details>

      <section className="grid gap-4 md:grid-cols-3">
        <Destaque titulo="Estoque líquido pago (capital livre)" selo="Disponível" valor={r.estoqueLiquidoPago === null ? "—" : brl0(r.estoqueLiquidoPago)}
          legenda="ativo a custo menos contas a pagar" cor="text-[#1b2168]" borda="border-t-[#2a327f]" />
        <Destaque titulo="Contas a pagar (3 meses fechados)" selo="Passivo" valor={r.contasPagar === null ? "—" : brl0(r.contasPagar)}
          legenda="títulos de fornecedor vencidos e não pagos" cor="text-amber-600" borda="border-t-amber-500" />
        <Destaque titulo="Perda comercial (ruptura)" selo="Prejuízo" valor={brl0(r.perdaRuptura)}
          legenda="venda mensal dos SKUs zerados, a preço praticado" cor="text-rose-600" borda="border-t-rose-500" />
      </section>

      {/* 16 cards em 2 ou 4 colunas (sem card sobrando), com espaço para o número inteiro (R$ 135.341.038). */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {indicadores.map((k) => {
          const corpo = (
            <>
              <h3 className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{k.titulo}</h3>
              <p className={`whitespace-nowrap text-[15px] font-black tabular-nums tracking-tight sm:text-lg lg:text-[15px] xl:text-lg ${k.cor ?? "text-[#141a4d]"}`}>{k.valor}</p>
            </>
          );
          const cls = "entrar flex min-h-[84px] min-w-0 flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:shadow-md";
          return k.tabela ? (
            <Link key={k.titulo} href={url({ tabela: k.tabela })} scroll={false} title={k.dica} className={`${cls} ring-amber-300 hover:ring-2`}>{corpo}</Link>
          ) : (
            <div key={k.titulo} title={k.dica} className={cls}>{corpo}</div>
          );
        })}
      </section>

      {tabela && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <TabelaEstoque
            tipo={tabela}
            titulo={TABELAS[tabela].titulo}
            linhas={linhasTabela(ps, tabela, hoje)}
            situacoes={SITUACOES.map((s) => ({ id: s.id, rotulo: s.rotulo }))}
            hrefPlanilha={exportar(tabela)}
            hrefFechar={url({ tabela: undefined })}
          />
        </section>
      )}

      <section className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
        <Painel titulo="Limite ideal vs excesso real por comprador">
          <LimiteVsExcesso itens={r.porComprador} />
        </Painel>
        <Painel titulo="Status de cobertura e alertas de giro por SKU">
          <BarList tone="navy" items={r.porSituacao.map((s) => ({ label: s.rotulo, value: s.skus, display: `${inteiro.format(s.skus)} SKUs` }))} />
        </Painel>
        <Ranking titulo="Top 10 SKUs com ruptura (perda mensal)" itens={r.produtosRuptura} />
        <Ranking titulo="Top 10 SKUs obsoletos (dias sem venda)" itens={r.produtosObsoletos} formato={(v) => (v >= 999 ? "nunca vendeu" : `${inteiro.format(v)} dias`)} />
        <Ranking titulo="Top 10 fornecedores em excesso" itens={r.fornecedoresExcesso} />
        <Ranking titulo="Top 10 SKUs em excesso" itens={r.produtosExcesso} />
        <Ranking titulo="Top 10 SKUs por ativo total" itens={r.produtosAtivo} />
        <Ranking titulo="Top 10 fornecedores faltantes" itens={r.fornecedoresFalta} />
      </section>
    </div>
  );
}

function Destaque({ titulo, selo, valor, legenda, cor, borda }: { titulo: string; selo: string; valor: string; legenda: string; cor: string; borda: string }) {
  return (
    <div className={`entrar flex min-w-0 flex-col gap-2 rounded-2xl border border-t-4 border-slate-200/80 bg-white p-5 shadow-sm ${borda}`}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">{titulo}</h4>
        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">{selo}</span>
      </div>
      <p className={`whitespace-nowrap text-2xl font-black tabular-nums tracking-tight xl:text-3xl ${cor}`}>{valor}</p>
      <small className="text-xs font-medium text-slate-400">{legenda}</small>
    </div>
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

function Ranking({ titulo, itens, formato = brl0 }: { titulo: string; itens: Fatia[]; formato?: (v: number) => string }) {
  return (
    <Painel titulo={titulo}>
      {itens.length === 0 ? (
        <p className="text-sm text-slate-400">Nada nesta lista.</p>
      ) : (
        <BarList items={itens.map((i) => ({ label: i.rotulo, value: i.valor, display: formato(i.valor) }))} />
      )}
    </Painel>
  );
}

/** Duas barras por comprador: o limite ideal (navy) e o excesso real (âmbar), na mesma escala. */
function LimiteVsExcesso({ itens }: { itens: { rotulo: string; excesso: number; ideal: number }[] }) {
  const max = Math.max(1, ...itens.flatMap((i) => [i.excesso, i.ideal]));
  const larg = (v: number) => `${v > 0 ? Math.max(1, (v / max) * 100) : 0}%`;
  return (
    <div className="space-y-3">
      <div className="flex gap-4 text-[11px] font-medium text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#2a327f]" /> Limite ideal</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" /> Excesso real</span>
      </div>
      {itens.map((i) => (
        <div key={i.rotulo} className="flex items-center gap-3" title={`${i.rotulo} · ideal ${brl0(i.ideal)} · excesso ${brl0(i.excesso)}`}>
          <div className="w-28 shrink-0 truncate text-sm text-slate-600 sm:w-36">{i.rotulo}</div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="h-2.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#2a327f]" style={{ width: larg(i.ideal) }} /></div>
            <div className="h-2.5 rounded-full bg-slate-100"><div className="h-full rounded-full bg-amber-400" style={{ width: larg(i.excesso) }} /></div>
          </div>
          <div className="w-24 shrink-0 text-right text-xs tabular-nums">
            <div className="text-slate-500">{brl0(i.ideal)}</div>
            <div className="font-semibold text-amber-600">{brl0(i.excesso)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

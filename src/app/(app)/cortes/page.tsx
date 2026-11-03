import { lerCortes, lerCortesMensais } from "@/data/cortes";
import { getResumoFaturamentoDashboard } from "@/data/faturamento-mensal";
import { resumoCortes, taxaCorte, lerMotivo, type GrupoCorte, type LinhaCorte } from "@/domain/cortes";
import { formatBRL, formatPercent, formatKg, formatDataBR } from "@/domain/format";
import { primeiroDiaDoMes, formatMesAno, limitarAoHistorico, inicioFimDoMes, mesAnterior, INICIO_HISTORICO } from "@/domain/periodo";
import { variacaoPercentual } from "@/domain/tendencias";
import { PageHeader, Card, StatCard, SectionTitle, BarList } from "@/components/ui";
import { MesNav } from "@/components/mes-nav";

const inteiro = new Intl.NumberFormat("pt-BR");
const brl0 = (v: number) => formatBRL(Math.round(v)).replace(/,00$/, "");

/**
 * Cortes: o que foi pedido e não saiu (PCCORTEI). Valor = quantidade cortada ×
 * preço de venda do item. Ao vivo do Winthor, filiais 1 e 11.
 */
export default async function CortesPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const sp = await searchParams;
  const mes = limitarAoHistorico(sp.mes ? primeiroDiaDoMes(sp.mes) : primeiroDiaDoMes());
  const mesFechado = mes < primeiroDiaDoMes();
  const { inicio, fim } = inicioFimDoMes(mes);
  const mesLabel = `${formatMesAno(mes)}${mesFechado ? " · mês fechado" : " · em andamento"}`;
  const href = (m: string) => (m === primeiroDiaDoMes() ? "/cortes" : `/cortes?mes=${m}`);

  let linhas: LinhaCorte[];
  let meses: Awaited<ReturnType<typeof lerCortesMensais>>;
  let fat: Awaited<ReturnType<typeof getResumoFaturamentoDashboard>> | null;
  try {
    [linhas, meses, fat] = await Promise.all([lerCortes(inicio, fim), lerCortesMensais(mesAnterior(INICIO_HISTORICO), fim), getResumoFaturamentoDashboard(mes).catch(() => null)]);
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

  const r = resumoCortes(linhas);
  const taxa = taxaCorte(r.valor, fat?.vendaLiquida ?? null);
  const ant = meses.find((m) => m.mes === mesAnterior(mes));
  const delta = ant && ant.valor > 0 ? variacaoPercentual(r.valor, ant.valor) : null;
  const vsAnt = delta === null ? undefined : `${delta >= 0 ? "+" : "−"}${formatPercent(Math.abs(delta))} vs ${formatMesAno(mesAnterior(mes)).slice(0, 3)}`;
  const top = [...linhas].sort((a, b) => b.valor - a.valor).slice(0, 20);

  return (
    <div>
      <PageHeader title="Cortes" subtitle={`${mesLabel} · filiais 1 e 11`}>
        <MesNav mes={mes} hrefFor={href} />
      </PageHeader>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Valor cortado" value={brl0(r.valor)} hint={vsAnt ?? "venda que não saiu"} accent="red" />
        <StatCard label="Do que foi pedido" value={taxa === null ? "—" : formatPercent(taxa, 2)} hint="corte ÷ (corte + venda líquida)" />
        <StatCard label="Itens cortados" value={inteiro.format(r.itens)} hint={`${inteiro.format(r.pedidos)} pedidos · ${inteiro.format(r.clientes)} clientes`} />
        <StatCard label="Produtos" value={inteiro.format(r.skus)} hint={`${formatKg(r.kg)} · ${r.valor > 0 ? formatPercent(r.harpia / r.valor, 0) : "—"} na separação`} />
      </div>

      {linhas.length === 0 ? (
        <Card className="p-8 text-center text-sm text-slate-400">Nenhum corte neste mês.</Card>
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <Bloco titulo="Motivos" grupos={r.porMotivo} />
            <Bloco titulo="Quem cortou (Harpia)" grupos={r.porUsuario} vazio="Nenhum corte registrado pelo Harpia." />
            <Bloco titulo="Fornecedores" grupos={r.porFornecedor} />
            <Bloco titulo="Compradores" grupos={r.porComprador} />
            <Bloco titulo="Produtos" grupos={r.porProduto} />
            <Bloco titulo="Clientes" grupos={r.porCliente} />
          </div>

          <section className="mt-6">
            <SectionTitle>Mês a mês</SectionTitle>
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
            <SectionTitle>Maiores cortes</SectionTitle>
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
                          <td className="px-4 py-2.5 tabular-nums text-slate-500">{l.numped}</td>
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
                        {formatDataBR(l.dia)} · {inteiro.format(l.qt)} un · {l.cliente ?? "—"}
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

function Bloco({ titulo, grupos, vazio = "Sem dados." }: { titulo: string; grupos: GrupoCorte[]; vazio?: string }) {
  const itens = grupos.slice(0, 8);
  return (
    <section>
      <SectionTitle>{titulo}</SectionTitle>
      <Card className="p-5">
        {itens.length === 0 ? (
          <p className="text-sm text-slate-400">{vazio}</p>
        ) : (
          <BarList items={itens.map((g) => ({ label: g.rotulo, value: g.valor, display: brl0(g.valor) }))} />
        )}
      </Card>
    </section>
  );
}

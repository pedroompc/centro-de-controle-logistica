import Link from "next/link";
import { carregarAgregados } from "@/data/agregados";
import { indicadores, type Casa, type LinhaAgregado, type Numeros, type RelatorioAgregados } from "@/domain/agregados";
import {
  diferencaTotal,
  documentoAgregados,
  nomeProprio,
  ordenar,
  situacao,
  somarAgregados,
  tabelaAgregados,
  type Situacao,
} from "@/domain/agregados-relatorio";
import { formatBRL, formatPercent } from "@/domain/format";
import { paramsDoPeriodo, rotuloPeriodo } from "@/domain/periodo";
import { PeriodoNav } from "@/components/periodo-nav";
import { Card, PageHeader, StatCard } from "@/components/ui";
import { periodoDoPadrao } from "./periodo";
import { Exportar } from "./exportar";

const brl0 = (v: number | null) => (v === null ? "—" : formatBRL(Math.round(v)).replace(/,00$/, ""));
const brl = (v: number | null) => (v === null ? "—" : formatBRL(v));
const pct = (v: number | null, casas = 1) => (v === null ? "—" : formatPercent(v, casas));
const n0 = (v: number) => v.toLocaleString("pt-BR");
const dataCurta = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

const href = (p: Record<string, string>) => `/custos/agregados?${new URLSearchParams(p)}`;
const BOTAO = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#141a4d] transition hover:bg-slate-50";
const GRUPO = "border-l border-slate-200/70";

export default async function AgregadosPage({ searchParams }: { searchParams: Promise<{ mes?: string; de?: string; ate?: string }> }) {
  const periodo = periodoDoPadrao(await searchParams);
  const rotulo = rotuloPeriodo(periodo);

  let rel: RelatorioAgregados | null = null;
  try {
    rel = await carregarAgregados(periodo);
  } catch (e) {
    console.error("[agregados] Winthor indisponível:", e);
  }

  const resumo = rel ? resumir(rel) : null;
  const html =
    rel && resumo
      ? documentoAgregados(tabelaAgregados(rel), {
          periodo: rotulo,
          geradoEm: new Date(),
          kpis: [
            ["Faturado pelos agregados", brl0(resumo.tot.faturado)],
            ["Devolução", `${brl0(resumo.tot.devolvido)} (${pct(resumo.dev)})`],
            ["Custo total", formatBRL(resumo.custo)],
            ["Custo médio por dia rodado", brl0(resumo.porDia)],
          ],
        })
      : "";

  return (
    <div>
      <PageHeader title="Agregados" subtitle={`Custo × o que cada agregado entrega · ${rotulo}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/custos" className={BOTAO}>
            ← Relatório
          </Link>
          {rel && <Exportar html={html} hrefExcel={`/custos/agregados/export?${new URLSearchParams(paramsDoPeriodo(periodo, new Date(), true))}`} />}
          <PeriodoNav periodo={periodo} hrefFor={href} explicito />
        </div>
      </PageHeader>
      {rel && resumo ? <Conteudo rel={rel} r={resumo} /> : <Card className="p-6 text-sm text-slate-500">Winthor indisponível agora.</Card>}
    </div>
  );
}

/** Grau de observação: cinza = nada a observar, âmbar = atenção, vermelho = rever. */
const NIVEIS = [
  { tom: "navy", rotulo: "Sem observação", cor: "bg-slate-300" },
  { tom: "gold", rotulo: "Atenção", cor: "bg-amber-400" },
  { tom: "red", rotulo: "Rever", cor: "bg-rose-500" },
  { tom: "slate", rotulo: "Sem carga no período", cor: "bg-white ring-2 ring-inset ring-slate-300" },
] as const;
const nivel = (s: Situacao) => NIVEIS.find((n) => n.tom === s.tom) ?? NIVEIS[0];

function Ponto({ s }: { s: Situacao }) {
  return <span title={s.motivo} className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${nivel(s).cor}`} />;
}

function resumir(rel: RelatorioAgregados) {
  const tot = somarAgregados(rel.agregados.filter((a) => a.papel));
  const i = indicadores(tot);
  const clt = rel.casa.motorista ? indicadores(rel.casa.motorista) : null;
  const contagem = new Map<string, number>();
  for (const a of rel.agregados) {
    const t = situacao(a, a.papel ? rel.casa[a.papel] : undefined).tom;
    contagem.set(t, (contagem.get(t) ?? 0) + 1);
  }
  return {
    tot,
    custo: rel.agregados.reduce((t, a) => t + a.custo, 0),
    porDia: i.custoPorDia,
    porDiaClt: clt?.custoPorDia ?? null,
    dev: i.devolucao,
    devClt: clt?.devolucao ?? null,
    dif: diferencaTotal(rel),
    niveis: NIVEIS.map((n) => ({ ...n, qtd: contagem.get(n.tom) ?? 0 })).filter((n) => n.qtd > 0),
  };
}

function Conteudo({ rel, r }: { rel: RelatorioAgregados; r: ReturnType<typeof resumir> }) {
  const linhas = ordenar(rel);
  const casaDe = (a: LinhaAgregado) => (a.papel ? rel.casa[a.papel] : undefined);
  const maxDev = Math.max(0.1, ...linhas.map((a) => indicadores(a).devolucao ?? 0));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Faturado pelos agregados"
          value={brl0(r.tot.faturado)}
          hint={`${n0(r.tot.entregas)} entregas · ${n0(r.tot.notas)} notas`}
          title="Valor das notas que os agregados levaram no período"
        />
        <StatCard
          label="Devolução"
          value={brl0(r.tot.devolvido)}
          hint={`${pct(r.dev)} do faturado · ${n0(r.tot.notasDevolvidas)} notas`}
          accent="red"
          title="Valor devolvido das notas que eles levaram (líquido de IPI e ST)"
        />
        <StatCard
          label="Custo total"
          value={formatBRL(r.custo)}
          hint={`${rel.agregados.length} agregados · ${pct(r.custo / (r.tot.faturado - r.tot.devolvido || 1), 2)} do faturado líquido`}
          accent="gold"
          title="Pago no período pelo contas a pagar do Winthor (conta 13), pela data do lançamento"
        />
        <StatCard
          label="Custo médio por dia rodado"
          value={brl0(r.porDia)}
          hint={`${n0(r.tot.dias)} dias rodados no total`}
          title="Custo total ÷ dias em que os agregados saíram com carga (dias do carregamento no Winthor)"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
        {r.niveis.map((n) => (
          <span
            key={n.tom}
            className="flex items-center gap-1.5"
            title={n.tom === "gold" ? "Mais caro que o CLT ou devolução acima de 1,5× a do CLT" : n.tom === "red" ? "Mais caro que o CLT e devolução acima de 1,5× a do CLT" : undefined}
          >
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${n.cor}`} />
            {n.rotulo} <span className="font-semibold tabular-nums text-[#141a4d]">{n.qtd}</span>
          </span>
        ))}
      </div>

      {/* Celular: um cartão por agregado */}
      <div className="mt-4 grid gap-3 md:hidden">
        {linhas.map((a) => (
          <CartaoAgregado key={a.chave} a={a} casa={casaDe(a)} />
        ))}
      </div>

      <Card className="mt-4 hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1080px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-slate-500">
              <tr className="bg-slate-50/70 text-[10px] text-slate-400">
                <th className="px-4 pt-3" />
                <th colSpan={3} className={`${GRUPO} px-3 pt-3 text-center font-semibold`}>Operação</th>
                <th className={`${GRUPO} px-3 pt-3 text-center font-semibold`}>Qualidade</th>
                <th colSpan={4} className={`${GRUPO} px-3 pt-3 text-center font-semibold`}>Custo</th>
                <th className={`${GRUPO} px-4 pt-3`} />
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50/70">
                <th className="px-4 pb-3 pt-1 font-semibold">Agregado</th>
                <th className={`${GRUPO} px-3 pb-3 pt-1 text-right font-semibold`} title="Dias com carga no período">Dias</th>
                <th className="px-3 pb-3 pt-1 text-right font-semibold" title="Cliente distinto por viagem">Entregas</th>
                <th className="px-3 pb-3 pt-1 text-right font-semibold" title="Valor das notas que ele levou">Faturado</th>
                <th className={`${GRUPO} px-3 pb-3 pt-1 font-semibold`} title="Valor devolvido ÷ valor faturado das notas dele">Devolução</th>
                <th className={`${GRUPO} px-3 pb-3 pt-1 text-right font-semibold`} title="Pago no período (data do lançamento)">Pago</th>
                <th className="px-3 pb-3 pt-1 text-right font-semibold">Por dia</th>
                <th className="px-3 pb-3 pt-1 text-right font-semibold">Por entrega</th>
                <th className="px-3 pb-3 pt-1 text-right font-semibold" title="Custo ÷ (faturado − devolvido)">÷ Faturado</th>
                <th className={`${GRUPO} px-4 pb-3 pt-1 text-right font-semibold`}>Últ. pgto.</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {linhas.map((a) => (
                <LinhaTabela key={a.chave} a={a} casa={casaDe(a)} maxDev={maxDev} />
              ))}
              <LinhaTotal rotulo={`Total · ${rel.agregados.length} agregados`} x={{ ...r.tot, custo: r.custo }} />
            </tbody>
          </table>
        </div>
      </Card>

      {rel.outros.length > 0 && (
        <p className="mt-2 text-xs text-slate-400" title={rel.outros.map((o) => `${o.nome ?? o.matricula} (${o.papel}, ${o.dias} dias)`).join("\n")}>
          {rel.outros.length} pessoas rodaram carga sem ser agregado nem estar no cadastro
        </p>
      )}
    </>
  );
}

function BarraDevolucao({ v, max, alta }: { v: number | null; max: number; alta: boolean }) {
  if (v === null) return <span className="text-slate-300">—</span>;
  return (
    <div className="flex items-center gap-2">
      <span className={`w-12 text-right ${alta ? "font-semibold text-rose-600" : "text-slate-600"}`}>{pct(v)}</span>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${alta ? "bg-rose-400" : "bg-slate-300"}`} style={{ width: `${Math.min(100, (v / max) * 100)}%` }} />
      </div>
    </div>
  );
}

function LinhaTabela({ a, casa, maxDev }: { a: LinhaAgregado; casa: Casa | undefined; maxDev: number }) {
  const i = indicadores(a);
  const s = situacao(a, casa);
  const devCasa = casa ? indicadores(casa).devolucao : null;
  const alta = i.devolucao !== null && devCasa !== null && i.devolucao > devCasa * 1.5;
  const sem = !a.papel;
  return (
    <tr className="border-b border-slate-50 transition last:border-0 hover:bg-slate-50/60">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <Ponto s={s} />
          <p className="font-medium text-[#141a4d]">{nomeProprio(a.nome)}</p>
        </div>
        <p className="pl-[18px] text-xs text-slate-400">
          {a.papel ?? "sem carga no período"}
          {a.fornecedores.length > 1 ? ` · ${a.fornecedores.length} CNPJs` : ""}
        </p>
      </td>
      <td className="border-l border-slate-100 px-3 py-3 text-right text-slate-600">{sem ? "—" : a.dias}</td>
      <td className="px-3 py-3 text-right text-slate-600">{sem ? "—" : n0(a.entregas)}</td>
      <td className="px-3 py-3 text-right text-slate-600">{sem ? "—" : brl0(a.faturado)}</td>
      <td className="border-l border-slate-100 px-3 py-3" title={sem ? undefined : `${a.notasDevolvidas} de ${a.notas} notas · ${formatBRL(a.devolvido)} devolvidos`}>
        <BarraDevolucao v={i.devolucao} max={maxDev} alta={alta} />
      </td>
      <td className="border-l border-slate-100 px-3 py-3 text-right font-semibold text-[#141a4d]">{brl0(a.custo)}</td>
      <td className="px-3 py-3 text-right text-slate-600">{brl0(i.custoPorDia)}</td>
      <td className="px-3 py-3 text-right text-slate-600">{brl(i.custoPorEntrega)}</td>
      <td className="px-3 py-3 text-right text-slate-600">{pct(i.custoSobreFaturado, 2)}</td>
      <td className="border-l border-slate-100 px-4 py-3 text-right text-slate-500">{dataCurta(a.ultimoPagamento)}</td>
    </tr>
  );
}

function LinhaTotal({ rotulo, x }: { rotulo: string; x: Numeros & { custo: number } }) {
  const i = indicadores(x);
  return (
    <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-semibold text-[#141a4d]">
      <td className="px-4 py-3">{rotulo}</td>
      <td className="border-l border-slate-100 px-3 py-3 text-right">{n0(x.dias)}</td>
      <td className="px-3 py-3 text-right">{n0(x.entregas)}</td>
      <td className="px-3 py-3 text-right">{brl0(x.faturado)}</td>
      <td className="border-l border-slate-100 px-3 py-3">
        <span className="inline-block w-12 text-right">{pct(i.devolucao)}</span>
      </td>
      <td className="border-l border-slate-100 px-3 py-3 text-right">{brl0(x.custo)}</td>
      <td className="px-3 py-3 text-right">{brl0(i.custoPorDia)}</td>
      <td className="px-3 py-3 text-right">{brl(i.custoPorEntrega)}</td>
      <td className="px-3 py-3 text-right">{pct(i.custoSobreFaturado, 2)}</td>
      <td className="border-l border-slate-100 px-4 py-3" />
    </tr>
  );
}

function CartaoAgregado({ a, casa }: { a: LinhaAgregado; casa: Casa | undefined }) {
  const i = indicadores(a);
  const s = situacao(a, casa);
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <span className="absolute inset-y-0 left-0 w-1 bg-amber-400" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-semibold text-[#141a4d]">
            <Ponto s={s} />
            {nomeProprio(a.nome)}
          </p>
          <p className="mt-0.5 pl-[18px] text-xs text-slate-400">{a.papel ? `${a.dias} dias` : "sem carga no período"}</p>
        </div>
        <p className="shrink-0 font-[family-name:var(--font-sora)] text-lg font-bold tabular-nums text-[#141a4d]">{brl0(a.custo)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
        <dt className="text-slate-500">Faturado</dt>
        <dd className="text-right text-slate-700">{a.papel ? brl0(a.faturado) : "—"}</dd>
        <dt className="text-slate-500">Devolução</dt>
        <dd className="text-right text-slate-700">{pct(i.devolucao)}</dd>
        <dt className="text-slate-500">Custo por dia</dt>
        <dd className="text-right text-slate-700">{brl0(i.custoPorDia)}</dd>
      </dl>
    </div>
  );
}

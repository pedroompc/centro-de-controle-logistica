import Link from "next/link";
import { carregarAgregados } from "@/data/agregados";
import { diferencaVsCasa, indicadores, type Casa, type LinhaAgregado } from "@/domain/agregados";
import { formatBRL, formatPercent } from "@/domain/format";
import { lerPeriodo, mesAnterior, periodoDoMes, primeiroDiaDoMes, rotuloPeriodo } from "@/domain/periodo";
import { PeriodoNav } from "@/components/periodo-nav";
import { Card, PageHeader, Pill, StatCard } from "@/components/ui";

const brl = (v: number | null) => (v === null ? "—" : formatBRL(v));
const brl0 = (v: number | null) => (v === null ? "—" : formatBRL(Math.round(v)).replace(/,00$/, ""));
const pct = (v: number | null, casas = 1) => (v === null ? "—" : formatPercent(v, casas));
const n0 = (v: number) => v.toLocaleString("pt-BR");
const dataCurta = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "—");

const href = (p: Record<string, string>) => `/custos/agregados?${new URLSearchParams(p)}`;

export default async function AgregadosPage({ searchParams }: { searchParams: Promise<{ mes?: string; de?: string; ate?: string }> }) {
  const sp = await searchParams;
  // Sem período na URL abre no mês FECHADO: o agregado recebe na semana seguinte,
  // então o mês corrente sempre aparece com custo a menos.
  const periodo = sp.mes || sp.de ? lerPeriodo(sp) : periodoDoMes(mesAnterior(primeiroDiaDoMes()));
  const rotulo = rotuloPeriodo(periodo);

  let rel: Awaited<ReturnType<typeof carregarAgregados>> | null = null;
  try {
    rel = await carregarAgregados(periodo);
  } catch (e) {
    console.error("[agregados] Winthor indisponível:", e);
  }

  return (
    <div>
      <PageHeader title="Agregados" subtitle={`Custo × o que cada agregado entrega · ${rotulo}`}>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/custos" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#141a4d] transition hover:bg-slate-50">
            ← Relatório
          </Link>
          <PeriodoNav periodo={periodo} hrefFor={href} explicito />
        </div>
      </PageHeader>
      {rel ? <Conteudo rel={rel} /> : <Card className="p-6 text-sm text-slate-500">Winthor indisponível agora.</Card>}
    </div>
  );
}

function Conteudo({ rel }: { rel: NonNullable<Awaited<ReturnType<typeof carregarAgregados>>> }) {
  const { agregados, casa, outros } = rel;
  const com = agregados.filter((a) => a.papel !== null);
  const tot = somar(com);
  const custoTotal = agregados.reduce((t, a) => t + a.custo, 0);
  const iTot = indicadores({ ...tot, custo: tot.custo });
  const casaMot = casa.motorista;
  const iCasa = casaMot ? indicadores(casaMot) : null;
  const casaDe = (a: LinhaAgregado) => (a.papel ? casa[a.papel] : undefined);
  const difTotal = agregados.reduce((t, a) => t + (diferencaVsCasa(a, casaDe(a)) ?? 0), 0);

  const ordenados = [...agregados].sort((a, b) => (diferencaVsCasa(b, casaDe(b)) ?? -Infinity) - (diferencaVsCasa(a, casaDe(a)) ?? -Infinity));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Custo dos agregados"
          value={formatBRL(custoTotal)}
          hint={`${agregados.length} agregados · pago pela data do lançamento`}
          accent="gold"
          title="Contas a pagar do Winthor, conta 13 (Prestação de Serviço), dos fornecedores agregados"
        />
        <StatCard
          label="Faturado por eles"
          value={brl0(tot.faturado)}
          hint={`${n0(tot.entregas)} entregas · ${n0(tot.dias)} dias rodados`}
          title="Valor das notas das viagens em que o agregado foi o motorista (ou o ajudante)"
        />
        <StatCard
          label="Custo por dia rodado"
          value={brl0(iTot.custoPorDia)}
          hint={iCasa ? `casa: ${brl0(iCasa.custoPorDia)} por motorista` : undefined}
          hintRuim={iTot.custoPorDia !== null && iCasa?.custoPorDia != null && iTot.custoPorDia > iCasa.custoPorDia}
          title="Agregado: o que pagamos ÷ dias com carga. Casa: folha dos motoristas CLT no período ÷ dias com carga deles (só pessoal, sem frota)"
        />
        <StatCard
          label="Devolução (valor)"
          value={pct(iTot.devolucao)}
          hint={iCasa ? `casa: ${pct(iCasa.devolucao)}` : undefined}
          hintRuim={iTot.devolucao !== null && iCasa?.devolucao != null && iTot.devolucao > iCasa.devolucao}
          accent="red"
          title="Devolvido ÷ faturado das notas que saíram no período (base faturamento da aba Devoluções)"
        />
      </div>

      <p className="mt-3 text-sm text-slate-600">
        Se a casa fizesse os mesmos dias, a diferença no período seria de{" "}
        <span className={`font-semibold tabular-nums ${difTotal > 0 ? "text-rose-600" : "text-[#141a4d]"}`}>
          {difTotal > 0 ? "+" : "−"}
          {formatBRL(Math.abs(difTotal))}
        </span>{" "}
        <span className="text-slate-400">({difTotal > 0 ? "agregados saem mais caros" : "agregados saem mais baratos"})</span>
      </p>

      {/* Celular: um cartão por agregado */}
      <div className="mt-4 grid gap-3 md:hidden">
        {ordenados.map((a) => (
          <CartaoAgregado key={a.chave} a={a} casa={casaDe(a)} />
        ))}
      </div>

      <Card className="mt-4 hidden overflow-hidden md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Agregado</th>
                <th className="px-3 py-3 text-right font-semibold" title="Dias com carga no período">Dias</th>
                <th className="px-3 py-3 text-right font-semibold" title="Cliente distinto por viagem">Entregas</th>
                <th className="px-3 py-3 text-right font-semibold" title="Valor das notas das viagens dele">Faturado</th>
                <th className="px-3 py-3 text-right font-semibold" title="Devolvido ÷ faturado (valor)">Devolução</th>
                <th className="px-3 py-3 text-right font-semibold" title="Pago no período (data do lançamento)">Custo</th>
                <th className="px-3 py-3 text-right font-semibold">Custo/dia</th>
                <th className="px-3 py-3 text-right font-semibold" title="Custo − o que a casa gastaria pelos mesmos dias (+ = agregado mais caro)">vs casa</th>
                <th className="px-3 py-3 text-right font-semibold">Custo/entrega</th>
                <th className="px-3 py-3 text-right font-semibold" title="Custo ÷ (faturado − devolvido)">Custo ÷ fat.</th>
                <th className="px-4 py-3 text-right font-semibold">Último pgto.</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {ordenados.map((a) => (
                <LinhaTabela key={a.chave} a={a} casa={casaDe(a)} />
              ))}
              <LinhaResumo rotulo={`Agregados · ${com.length}`} x={{ ...tot, custo: tot.custo }} destaque />
              {casa.motorista && <LinhaResumo rotulo={`Casa · motoristas CLT · ${casa.motorista.pessoas}`} x={casa.motorista} />}
              {casa.ajudante && <LinhaResumo rotulo={`Casa · ajudantes CLT · ${casa.ajudante.pessoas}`} x={casa.ajudante} />}
            </tbody>
          </table>
        </div>
      </Card>

      {outros.length > 0 && (
        <p className="mt-2 text-xs text-slate-400" title={outros.map((o) => `${o.nome ?? o.matricula} (${o.papel}, ${o.dias} dias)`).join("\n")}>
          {outros.length} pessoas rodaram carga sem ser agregado nem estar no cadastro da casa (passe o mouse para ver)
        </p>
      )}
    </>
  );
}

function somar(as: LinhaAgregado[]) {
  const t = { custo: 0, dias: 0, viagens: 0, notas: 0, entregas: 0, kg: 0, faturado: 0, notasDevolvidas: 0, devolvido: 0 };
  for (const a of as) {
    t.custo += a.custo;
    t.dias += a.dias;
    t.viagens += a.viagens;
    t.notas += a.notas;
    t.entregas += a.entregas;
    t.kg += a.kg;
    t.faturado += a.faturado;
    t.notasDevolvidas += a.notasDevolvidas;
    t.devolvido += a.devolvido;
  }
  return t;
}

function Vs({ v }: { v: number | null }) {
  if (v === null) return <span className="text-slate-300">—</span>;
  const caro = v > 0;
  return (
    <span className={caro ? "font-semibold text-rose-600" : "font-semibold text-[#141a4d]"}>
      {caro ? "+" : "−"}
      {formatBRL(Math.abs(Math.round(v))).replace(/,00$/, "")}
    </span>
  );
}

function LinhaTabela({ a, casa }: { a: LinhaAgregado; casa: Casa | undefined }) {
  const i = indicadores(a);
  const iC = casa ? indicadores(casa) : null;
  const devAlta = i.devolucao !== null && iC?.devolucao != null && i.devolucao > iC.devolucao;
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="px-4 py-3">
        <p className="font-medium text-[#141a4d]">{a.nome}</p>
        <p className="text-xs text-slate-400">
          {a.papel ?? <Pill tone="gold">sem carga no período</Pill>}
          {a.papel && a.fornecedores.length > 1 ? ` · ${a.fornecedores.length} CNPJs` : ""}
        </p>
      </td>
      <td className="px-3 py-3 text-right text-slate-600">{a.papel ? a.dias : "—"}</td>
      <td className="px-3 py-3 text-right text-slate-600">{a.papel ? n0(a.entregas) : "—"}</td>
      <td className="px-3 py-3 text-right text-slate-600">{a.papel ? brl0(a.faturado) : "—"}</td>
      <td className={`px-3 py-3 text-right ${devAlta ? "font-semibold text-rose-600" : "text-slate-600"}`} title={a.papel ? `${a.notasDevolvidas} de ${a.notas} notas · ${formatBRL(a.devolvido)}` : undefined}>
        {pct(i.devolucao)}
      </td>
      <td className="px-3 py-3 text-right font-semibold text-[#141a4d]">{formatBRL(a.custo)}</td>
      <td className="px-3 py-3 text-right text-slate-600">{brl0(i.custoPorDia)}</td>
      <td className="px-3 py-3 text-right">
        <Vs v={diferencaVsCasa(a, casa)} />
      </td>
      <td className="px-3 py-3 text-right text-slate-600">{brl(i.custoPorEntrega)}</td>
      <td className="px-3 py-3 text-right text-slate-600">{pct(i.custoSobreFaturado, 2)}</td>
      <td className="px-4 py-3 text-right text-slate-500">{dataCurta(a.ultimoPagamento)}</td>
    </tr>
  );
}

function LinhaResumo({ rotulo, x, destaque = false }: { rotulo: string; x: Parameters<typeof indicadores>[0]; destaque?: boolean }) {
  const i = indicadores(x);
  return (
    <tr className={`${destaque ? "border-t-2 border-slate-200" : "border-t border-slate-100"} bg-slate-50/60 font-semibold text-[#141a4d]`}>
      <td className="px-4 py-3">{rotulo}</td>
      <td className="px-3 py-3 text-right">{n0(x.dias)}</td>
      <td className="px-3 py-3 text-right">{n0(x.entregas)}</td>
      <td className="px-3 py-3 text-right">{brl0(x.faturado)}</td>
      <td className="px-3 py-3 text-right">{pct(i.devolucao)}</td>
      <td className="px-3 py-3 text-right" title={destaque ? undefined : "Folha do setor no período (pró-rata)"}>{formatBRL(x.custo)}</td>
      <td className="px-3 py-3 text-right">{brl0(i.custoPorDia)}</td>
      <td className="px-3 py-3 text-right text-slate-300">—</td>
      <td className="px-3 py-3 text-right">{brl(i.custoPorEntrega)}</td>
      <td className="px-3 py-3 text-right">{pct(i.custoSobreFaturado, 2)}</td>
      <td className="px-4 py-3" />
    </tr>
  );
}

function CartaoAgregado({ a, casa }: { a: LinhaAgregado; casa: Casa | undefined }) {
  const i = indicadores(a);
  const iC = casa ? indicadores(casa) : null;
  const devAlta = i.devolucao !== null && iC?.devolucao != null && i.devolucao > iC.devolucao;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
      <span className="absolute inset-y-0 left-0 w-1 bg-amber-400" />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#141a4d]">{a.nome}</p>
          <p className="text-xs text-slate-400">{a.papel ? `${a.papel} · ${a.dias} dias` : "sem carga no período"}</p>
        </div>
        <p className="shrink-0 font-[family-name:var(--font-sora)] text-lg font-bold tabular-nums text-[#141a4d]">{formatBRL(a.custo)}</p>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
        <dt className="text-slate-500">Faturado</dt>
        <dd className="text-right text-slate-700">{a.papel ? brl0(a.faturado) : "—"}</dd>
        <dt className="text-slate-500">Devolução</dt>
        <dd className={`text-right ${devAlta ? "font-semibold text-rose-600" : "text-slate-700"}`}>{pct(i.devolucao)}</dd>
        <dt className="text-slate-500">Custo/dia</dt>
        <dd className="text-right text-slate-700">{brl0(i.custoPorDia)}</dd>
        <dt className="text-slate-500">vs casa</dt>
        <dd className="text-right">
          <Vs v={diferencaVsCasa(a, casa)} />
        </dd>
      </dl>
    </div>
  );
}

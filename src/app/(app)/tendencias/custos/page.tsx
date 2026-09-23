import { getSerieTendencias } from "@/data/faturamento-mensal";
import { serieCustosMensais, listarLancamentosDoMes } from "@/data/custos-mensais";
import { serieEfetivoMensal } from "@/data/efetivo-mensal";
import { montarCustosMensais, type EntradaCustoMes } from "@/domain/custos-tendencia";
import { somaLancamentos } from "@/domain/custos-metrics";
import { variacaoPercentual, variacaoPP } from "@/domain/tendencias";
import { formatBRL, formatPercent } from "@/domain/format";
import { Card, SectionTitle } from "@/components/ui";
import { CORES, KpiCard, type Delta } from "../widgets";
import { EvolucaoChart, type SeriePainel } from "../evolucao-chart";
import { TendenciasTabs } from "../tabs";

const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotuloMes = (mes: string) => `${MES_ABREV[Number(mes.slice(5, 7)) - 1]}/${mes.slice(2, 4)}`;

const rsKg = (v: number) => `${formatBRL(v)}/kg`;
const pctComSinal = (frac: number) => `${frac >= 0 ? "+" : "−"}${formatPercent(Math.abs(frac))}`;
const ppComSinal = (pp: number) =>
  `${pp >= 0 ? "+" : "−"}${Math.abs(pp).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;

// Custo subindo é RUIM (rose); caindo/estável é neutro (slate). Verde nunca.
const deltaCustoPct = (frac: number, tem: boolean): Delta => ({
  texto: tem ? pctComSinal(frac) : "—",
  subindo: frac > 0,
  positivo: frac <= 0,
});
const deltaCustoPP = (pp: number, tem: boolean): Delta => ({
  texto: tem ? ppComSinal(pp) : "—",
  subindo: pp > 0,
  positivo: pp <= 0,
});

const IcCusto = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" stroke="none" /></svg>
);
const IcPercent = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M19 5 5 19" /><circle cx="7.5" cy="7.5" r="2.5" /><circle cx="16.5" cy="16.5" r="2.5" /></svg>
);
const IcPeso = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5" /><path d="M12 12v9" /></svg>
);

function Cabecalho() {
  return (
    <div className="space-y-4">
      <TendenciasTabs />
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight text-[#141a4d]">
          Custos · eficiência mês a mês
        </h1>
        <p className="mt-1 text-sm text-slate-500">Custo total, custo logístico e R$ por kg faturado</p>
      </div>
    </div>
  );
}

export default async function CustosTendenciaPage() {
  const [faturamento, custos, efetivo] = await Promise.all([
    getSerieTendencias(12),
    serieCustosMensais(12),
    serieEfetivoMensal(12),
  ]);

  // Espinha = meses fechados com faturamento (onde as razões de eficiência
  // fazem sentido). Custo/folha vêm por lookup; 0 se o mês não tiver.
  const custosPorMes = new Map(custos.map((c) => [c.mes, c]));
  const folhaPorMes = new Map(efetivo.map((e) => [e.mes, e.folhaTotal]));

  const entradas: EntradaCustoMes[] = faturamento.map((f) => ({
    mes: f.mes,
    fixos: custosPorMes.get(f.mes)?.fixos ?? 0,
    variaveis: custosPorMes.get(f.mes)?.variaveis ?? 0,
    salario: folhaPorMes.get(f.mes) ?? 0,
    vendaLiquida: f.vendaLiquida,
    pesoFaturado: f.pesoFaturado,
  }));
  const pontos = montarCustosMensais(entradas);

  if (pontos.length === 0) {
    return (
      <div className="space-y-8">
        <Cabecalho />
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Sem histórico para comparar — sem meses fechados com faturamento (o Winthor só responde de
            dentro da rede da empresa) ou custos ainda não lançados.
          </p>
        </Card>
      </div>
    );
  }

  const rotulos = pontos.map((p) => rotuloMes(p.mes));
  const atual = pontos[pontos.length - 1];
  const ant = pontos[pontos.length - 2] ?? atual;
  const temAnt = pontos.length >= 2;

  const vTotal = pontos.map((p) => p.custoTotal);
  const vLog = pontos.map((p) => p.custoLogistico);
  const vKg = pontos.map((p) => p.rsPorKg);
  const vVar = pontos.map((p) => p.variaveis);

  const series: SeriePainel[] = [
    { nome: "Custo total", cor: CORES.venda, valores: vTotal, abs: vTotal.map(formatBRL) },
    { nome: "Custo logístico", cor: "#c2820a", valores: vLog, abs: vLog.map((t) => formatPercent(t)) },
    { nome: "R$ por kg faturado", cor: "#8b5cf6", valores: vKg, abs: vKg.map(rsKg) },
    { nome: "Custos variáveis", cor: CORES.pdv, valores: vVar, abs: vVar.map(formatBRL) },
  ];

  // Composição do último mês.
  const comp = [
    { label: "Salário (efetivo)", valor: atual.salario },
    { label: "Custos fixos", valor: atual.fixos },
    { label: "Custos variáveis", valor: atual.variaveis },
  ];
  const maxComp = Math.max(1, ...comp.map((c) => c.valor));

  // Top categorias de custo variável do último mês (do lançamento por nome).
  const lancUltimo = await listarLancamentosDoMes(atual.mes);
  const totalVar = somaLancamentos(lancUltimo, "variavel");
  const topVar = lancUltimo
    .filter((l) => l.tipo === "variavel")
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 6);
  const maxVar = Math.max(1, ...topVar.map((l) => l.valor));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Cabecalho />
        <span className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600">
          {rotulos.length > 1 ? `${rotulos[0]} – ${rotulos[rotulos.length - 1]}` : rotulos[0]} · meses fechados
        </span>
      </div>

      {/* KPIs — último mês fechado + variação */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard icone={IcCusto} nome="Custo total" valor={formatBRL(atual.custoTotal)} delta={deltaCustoPct(temAnt ? variacaoPercentual(atual.custoTotal, ant.custoTotal) : 0, temAnt)} valores={vTotal} cor={CORES.venda} />
        <KpiCard icone={IcPercent} nome="Custo logístico" valor={atual.custoLogistico > 0 ? formatPercent(atual.custoLogistico) : "—"} delta={deltaCustoPP(temAnt ? variacaoPP(atual.custoLogistico, ant.custoLogistico) : 0, temAnt && atual.custoLogistico > 0)} valores={vLog} cor="#c2820a" />
        <KpiCard icone={IcPeso} nome="R$ por kg faturado" valor={atual.rsPorKg > 0 ? rsKg(atual.rsPorKg) : "—"} delta={deltaCustoPct(temAnt ? variacaoPercentual(atual.rsPorKg, ant.rsPorKg) : 0, temAnt && atual.rsPorKg > 0)} valores={vKg} cor="#8b5cf6" />
      </div>

      <Card className="p-6">
        <div className="mb-4">
          <SectionTitle>Evolução mensal</SectionTitle>
          <p className="text-xs text-slate-400">Custo total, eficiência (logístico e R$/kg) e variáveis, {rotulos[0]} a {rotulos[rotulos.length - 1]}.</p>
        </div>
        <EvolucaoChart rotulos={rotulos} series={series} />
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-6">
          <SectionTitle>Composição — {rotulos[rotulos.length - 1]}</SectionTitle>
          <div className="mt-3 space-y-3">
            {comp.map((c) => (
              <div key={c.label} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm text-slate-600">{c.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
                  <div className="h-full rounded-md bg-[#2a327f]" style={{ width: `${Math.max(4, (c.valor / maxComp) * 100)}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-[#141a4d]">{formatBRL(c.valor)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-sm font-semibold text-slate-500">Total</span>
              <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold tabular-nums text-[#141a4d]">{formatBRL(atual.custoTotal)}</span>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <SectionTitle>Top custos variáveis — {rotulos[rotulos.length - 1]}</SectionTitle>
          <div className="mt-3 space-y-3">
            {topVar.length === 0 && <p className="text-sm text-slate-500">Sem custos variáveis lançados no mês.</p>}
            {topVar.map((l) => (
              <div key={l.id} className="flex items-center gap-3">
                <span className="w-32 shrink-0 truncate text-sm text-slate-600" title={l.nome}>{l.nome}</span>
                <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
                  <div className="h-full rounded-md bg-amber-400" style={{ width: `${Math.max(4, (l.valor / maxVar) * 100)}%` }} />
                </div>
                <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-[#141a4d]">{formatBRL(l.valor)}</span>
              </div>
            ))}
            {topVar.length > 0 && (
              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-sm font-semibold text-slate-500">Total variáveis</span>
                <span className="font-semibold tabular-nums text-[#141a4d]">{formatBRL(totalVar)}</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Custo total = salário do efetivo + custos fixos + variáveis. Custo logístico = custo ÷ venda líquida.
        Só meses fechados (com faturamento consolidado). p.p. = pontos percentuais.
      </p>
    </div>
  );
}

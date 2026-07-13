import { getSerieTendencias } from "@/data/faturamento-mensal";
import {
  taxaDevolucaoMensal, resumoPeriodo, variacaoPercentual, variacaoPP, media,
  topPorDevolucao, indice,
} from "@/domain/tendencias";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { PageHeader, Card, SectionTitle } from "@/components/ui";
import {
  CORES, KpiCard, EvolucaoChart, Legenda, RankingBars, ComparativoRow,
  type Delta, type SerieChart,
} from "./widgets";
import { ExportButton } from "./export-button";

const MES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const rotuloMes = (mes: string) => {
  const [ano, m] = mes.split("-").map(Number);
  return `${MES_ABREV[m - 1]}/${String(ano).slice(2)}`;
};

// Variação formatada com sinal (− U+2212), a partir de uma fração / de p.p.
const pctComSinal = (frac: number) => `${frac >= 0 ? "+" : "−"}${formatPercent(Math.abs(frac))}`;
const ppComSinal = (pp: number) =>
  `${pp >= 0 ? "+" : "−"}${Math.abs(pp).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;
const numBR = (v: number, casas = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });

// Ícones (traço, no estilo do menu).
const IcTaxa = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7v6h6" /><path d="M3 13a9 9 0 1 0 3-6.7L3 9" /></svg>
);
const IcVenda = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v20" /><path d="M17 5.5A4 4 0 0 0 13 4h-1.5a3.5 3.5 0 0 0 0 7h1a3.5 3.5 0 0 1 0 7H11a4 4 0 0 1-4-1.5" /></svg>
);
const IcPeso = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5" /><path d="M12 12v9" /></svg>
);

export default async function TendenciasPage() {
  const serie = await getSerieTendencias(12);

  if (serie.length === 0) {
    return (
      <div>
        <PageHeader title="Tendências" subtitle="Evolução mês a mês · Winthor" />
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Sem histórico disponível — sem conexão com o Winthor (o banco só responde de dentro da
            rede da empresa) ou ainda não há meses fechados.
          </p>
        </Card>
      </div>
    );
  }

  const rotulos = serie.map((p) => rotuloMes(p.mes));
  const atual = serie[serie.length - 1];
  const ant = serie[serie.length - 2] ?? atual;

  // Séries mensais
  const vVenda = serie.map((p) => p.vendaLiquida);
  const vValor = serie.map((p) => p.valorDevolucao);
  const vPeso = serie.map((p) => p.pesoDevolucao);
  const vTaxa = serie.map((p) => taxaDevolucaoMensal(p)); // 0..1

  const taxaAtual = taxaDevolucaoMensal(atual);
  const taxaAnt = taxaDevolucaoMensal(ant);

  // KPIs — valor do último mês fechado + variação vs mês anterior.
  const deltaVenda = variacaoPercentual(atual.vendaLiquida, ant.vendaLiquida);
  const deltaValor = variacaoPercentual(atual.valorDevolucao, ant.valorDevolucao);
  const deltaPeso = variacaoPercentual(atual.pesoDevolucao, ant.pesoDevolucao);
  const deltaTaxaPP = variacaoPP(taxaAtual, taxaAnt);

  const dTaxa: Delta = { texto: ppComSinal(deltaTaxaPP), subindo: taxaAtual > taxaAnt, positivo: taxaAtual < taxaAnt };
  const dVenda: Delta = { texto: pctComSinal(deltaVenda), subindo: deltaVenda > 0, positivo: deltaVenda > 0 };
  const dValor: Delta = { texto: pctComSinal(deltaValor), subindo: deltaValor > 0, positivo: deltaValor < 0 };
  const dPeso: Delta = { texto: pctComSinal(deltaPeso), subindo: deltaPeso > 0, positivo: deltaPeso < 0 };

  // Gráfico indexado (cada série normalizada pelo próprio pico).
  const series: SerieChart[] = [
    { nome: "Venda líquida", cor: CORES.venda, indices: indice(vVenda), abs: vVenda.map(formatBRL) },
    { nome: "Valor devolução", cor: CORES.devolucao, indices: indice(vValor), abs: vValor.map(formatBRL) },
    { nome: "Peso devolvido", cor: CORES.peso, indices: indice(vPeso), abs: vPeso.map(formatKg) },
    { nome: "Taxa de devolução", cor: CORES.taxa, indices: indice(vTaxa), abs: vTaxa.map((t) => formatPercent(t)) },
  ];

  const resumo = resumoPeriodo(serie);

  const top5 = topPorDevolucao(serie, 5).map((p) => ({
    rotulo: rotuloMes(p.mes), valor: p.valorDevolucao, abs: formatBRL(p.valorDevolucao),
  }));

  // Comparativos: último mês vs média dos 12 meses.
  const mediaVenda = media(vVenda), mediaTaxa = media(vTaxa), mediaPeso = media(vPeso);
  const cVenda = variacaoPercentual(atual.vendaLiquida, mediaVenda);
  const cPeso = variacaoPercentual(atual.pesoDevolucao, mediaPeso);
  const cTaxaPP = variacaoPP(taxaAtual, mediaTaxa);

  // Exportação CSV.
  const cabecalho = ["Mês", "Venda líquida", "Valor devolução", "Devolução avulsa", "Peso devolvido (kg)", "NFs devolvidas", "Taxa devolução (%)"];
  const linhasCsv = serie.map((p) => [
    p.mes.slice(0, 7),
    numBR(p.vendaLiquida), numBR(p.valorDevolucao), numBR(p.valorDevolucaoAvulsa),
    numBR(p.pesoDevolucao, 0), String(p.devolvidas), numBR(taxaDevolucaoMensal(p) * 100),
  ]);

  const periodo = `${rotulos[0]} – ${rotulos[rotulos.length - 1]}`;

  return (
    <div className="space-y-8">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight text-[#141a4d]">Tendências</h1>
          <p className="mt-1 text-sm text-slate-500">Últimos {serie.length} meses fechados · Filial 1</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600">{periodo}</span>
          <span className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600">Filial 1</span>
          <ExportButton cabecalho={cabecalho} linhas={linhasCsv} nomeArquivo={`tendencias-${serie[0].mes.slice(0, 7)}_a_${atual.mes.slice(0, 7)}.csv`} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icone={IcTaxa} nome="Taxa de devolução" valor={formatPercent(taxaAtual)} delta={dTaxa} valores={vTaxa} cor={CORES.taxa} />
        <KpiCard icone={IcVenda} nome="Venda líquida" valor={formatBRL(atual.vendaLiquida)} delta={dVenda} valores={vVenda} cor={CORES.venda} />
        <KpiCard icone={IcVenda} nome="Valor devolvido" valor={formatBRL(atual.valorDevolucao)} delta={dValor} valores={vValor} cor={CORES.devolucao} />
        <KpiCard icone={IcPeso} nome="Peso devolvido" valor={formatKg(atual.pesoDevolucao)} delta={dPeso} valores={vPeso} cor={CORES.peso} />
      </div>

      {/* Gráfico principal */}
      <Card className="p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionTitle>Evolução mensal</SectionTitle>
            <p className="text-xs text-slate-400">Índice — cada indicador em % do seu maior mês, para comparar a evolução. Valor exato ao passar o mouse.</p>
          </div>
          <Legenda series={series} />
        </div>
        <EvolucaoChart rotulos={rotulos} series={series} />
      </Card>

      {/* Resumo · Ranking · Comparativos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="p-6">
          <SectionTitle>Resumo do período</SectionTitle>
          <dl className="mt-1 divide-y divide-slate-100">
            {([
              ["Venda líquida total", formatBRL(resumo.vendaLiquidaTotal)],
              ["Valor devolvido total", formatBRL(resumo.valorDevolucaoTotal)],
              ["Peso devolvido total", formatKg(resumo.pesoDevolucaoTotal)],
              ["Taxa média de devolução", formatPercent(resumo.taxaMedia)],
            ] as const).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between py-3">
                <dt className="text-sm text-slate-500">{k}</dt>
                <dd className="text-sm font-semibold tabular-nums text-[#141a4d]">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <Card className="p-6">
          <SectionTitle>Top 5 meses por devolução</SectionTitle>
          <div className="mt-2"><RankingBars itens={top5} /></div>
        </Card>

        <Card className="p-6">
          <SectionTitle>Comparativo · vs média 12 meses</SectionTitle>
          <div className="mt-1 divide-y divide-slate-100">
            <ComparativoRow icone={IcVenda} nome="Venda líquida" base="vs média 12 meses" cor={CORES.venda} valores={vVenda}
              delta={{ texto: pctComSinal(cVenda), subindo: cVenda > 0, positivo: cVenda > 0 }} />
            <ComparativoRow icone={IcTaxa} nome="Taxa de devolução" base="vs média 12 meses" cor={CORES.taxa} valores={vTaxa}
              delta={{ texto: ppComSinal(cTaxaPP), subindo: taxaAtual > mediaTaxa, positivo: taxaAtual < mediaTaxa }} />
            <ComparativoRow icone={IcPeso} nome="Peso devolvido" base="vs média 12 meses" cor={CORES.peso} valores={vPeso}
              delta={{ texto: pctComSinal(cPeso), subindo: cPeso > 0, positivo: cPeso < 0 }} />
          </div>
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Fonte: rotina 111 (líquido), foto congelada de cada mês fechado. Taxa = valor devolvido ÷ venda faturada.
        p.p. = pontos percentuais.
      </p>
    </div>
  );
}

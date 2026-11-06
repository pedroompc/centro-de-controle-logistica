import { getSerieTendencias } from "@/data/faturamento-mensal";
import {
  taxaDevolucaoMensal, resumoPeriodo, media,
  topPorDevolucao,
} from "@/domain/tendencias";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { compararPct, compararTaxa } from "@/domain/comparacao";
import { PageHeader, Card, SectionTitle } from "@/components/ui";
import { CORES, KpiCard, RankingBars, ComparativoRow } from "./widgets";
import { EvolucaoChart, type SeriePainel } from "./evolucao-chart";
import { CompararMeses, type MesComparavel } from "./comparar-meses";
import { ExportButton } from "./export-button";
import { BarraTendencias } from "./barra";
import { janelaTendencias, mesesFechados } from "@/domain/tendencias";

const MES_ABREV = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
const rotuloMes = (mes: string) => {
  const [ano, m] = mes.split("-").map(Number);
  return `${MES_ABREV[m - 1]}/${String(ano).slice(2)}`;
};

// Variação formatada com sinal (− U+2212), a partir de uma fração / de p.p.
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
// Vitrine de loja — representa o PDV (ponto de venda) atendido.
const IcPdv = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 9.5 4.5 4h15L21 9.5" /><path d="M4 9.5v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9" /><path d="M3 9.5a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0 3 0" /></svg>
);

export default async function TendenciasPage({ searchParams }: { searchParams: Promise<{ mes?: string; de?: string; ate?: string }> }) {
  // Janela: padrão = últimos 12 meses fechados; com período, os meses dele.
  const j = janelaTendencias(await searchParams, mesesFechados(new Date(), 12));
  const noJanela = new Set(j.meses);
  const serie = j.qtd > 0 ? (await getSerieTendencias(j.qtd)).filter((p) => noJanela.has(p.mes)) : [];

  if (serie.length === 0) {
    return (
      <div>
        <PageHeader title="Tendências" subtitle="Evolução mês a mês · Winthor" />
        <BarraTendencias periodo={j.periodo} base="/tendencias" />
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
  const vAtend = serie.map((p) => p.atendimentos);

  const taxaAtual = taxaDevolucaoMensal(atual);
  const taxaAnt = taxaDevolucaoMensal(ant);

  // KPIs — valor do último mês fechado + variação vs mês anterior.
  // Mais venda e mais PDVs = bom; devolução (valor, peso, taxa) subindo = ruim.
  const dTaxa = compararTaxa(taxaAtual, taxaAnt, false);
  const dAtend = compararPct(atual.atendimentos, ant.atendimentos, true);
  const dVenda = compararPct(atual.vendaLiquida, ant.vendaLiquida, true);
  const dValor = compararPct(atual.valorDevolucao, ant.valorDevolucao, false);
  const dPeso = compararPct(atual.pesoDevolucao, ant.pesoDevolucao, false);

  // Um painel por indicador, cada um na sua unidade real (sem índice).
  const series: SeriePainel[] = [
    { nome: "PDVs atendidos", cor: CORES.pdv, valores: vAtend, abs: vAtend.map((v) => v.toLocaleString("pt-BR")) },
    { nome: "Venda líquida", cor: CORES.venda, valores: vVenda, abs: vVenda.map(formatBRL) },
    { nome: "Valor devolução", cor: CORES.devolucao, valores: vValor, abs: vValor.map(formatBRL) },
    { nome: "Peso devolvido", cor: CORES.peso, valores: vPeso, abs: vPeso.map((p) => formatKg(p)) },
    { nome: "Taxa de devolução", cor: CORES.taxa, valores: vTaxa, abs: vTaxa.map((t) => formatPercent(t)) },
  ];

  const mesesComparaveis: MesComparavel[] = serie.map((p, i) => ({
    rotulo: rotulos[i],
    vendaLiquida: p.vendaLiquida,
    valorDevolucao: p.valorDevolucao,
    pesoDevolucao: p.pesoDevolucao,
    taxa: vTaxa[i],
  }));

  const resumo = resumoPeriodo(serie);

  const top5 = topPorDevolucao(serie, 5).map((p) => ({
    rotulo: rotuloMes(p.mes), valor: p.valorDevolucao, abs: formatBRL(p.valorDevolucao),
  }));

  // Comparativos: último mês vs média dos 12 meses.
  const mediaVenda = media(vVenda), mediaTaxa = media(vTaxa), mediaPeso = media(vPeso);
  const cVenda = compararPct(atual.vendaLiquida, mediaVenda, true);
  const cPeso = compararPct(atual.pesoDevolucao, mediaPeso, false);
  const cTaxa = compararTaxa(taxaAtual, mediaTaxa, false);

  // Exportação CSV.
  const cabecalho = ["Mês", "PDVs atendidos", "Venda líquida", "Valor devolução", "Devolução avulsa", "Peso devolvido (kg)", "NFs devolvidas", "Taxa devolução (%)"];
  const linhasCsv = serie.map((p) => [
    p.mes.slice(0, 7),
    String(p.atendimentos),
    numBR(p.vendaLiquida), numBR(p.valorDevolucao), numBR(p.valorDevolucaoAvulsa),
    numBR(p.pesoDevolucao, 0), String(p.devolvidas), numBR(taxaDevolucaoMensal(p) * 100),
  ]);

  const periodo = `${rotulos[0]} – ${rotulos[rotulos.length - 1]}`;

  return (
    <div className="space-y-8">
      <BarraTendencias periodo={j.periodo} base="/tendencias" />

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight text-[#141a4d]">Tendências · Faturamento</h1>
          <p className="mt-1 text-sm text-slate-500">{serie.length} {serie.length === 1 ? "mês fechado" : "meses fechados"} · Filial 1</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600">{periodo}</span>
          <span className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600">Filial 1</span>
          <ExportButton cabecalho={cabecalho} linhas={linhasCsv} nomeArquivo={`tendencias-${serie[0].mes.slice(0, 7)}_a_${atual.mes.slice(0, 7)}.csv`} />
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard icone={IcPdv} nome="PDVs atendidos" valor={atual.atendimentos.toLocaleString("pt-BR")} delta={dAtend} valores={vAtend} cor={CORES.pdv} />
        <KpiCard icone={IcTaxa} nome="Taxa de devolução" valor={formatPercent(taxaAtual)} delta={dTaxa} valores={vTaxa} cor={CORES.taxa} />
        <KpiCard icone={IcVenda} nome="Venda líquida" valor={formatBRL(atual.vendaLiquida)} delta={dVenda} valores={vVenda} cor={CORES.venda} />
        <KpiCard icone={IcVenda} nome="Valor devolvido" valor={formatBRL(atual.valorDevolucao)} delta={dValor} valores={vValor} cor={CORES.devolucao} />
        <KpiCard icone={IcPeso} nome="Peso devolvido" valor={formatKg(atual.pesoDevolucao)} delta={dPeso} valores={vPeso} cor={CORES.peso} />
      </div>

      {/* Gráfico principal */}
      <Card className="p-6">
        <div className="mb-4">
          <SectionTitle>Evolução mensal</SectionTitle>
          <p className="text-xs text-slate-400">Cada indicador na sua unidade, {rotulos[0]} a {rotulos[rotulos.length - 1]}. Passe o mouse para ver o mês.</p>
        </div>
        <EvolucaoChart rotulos={rotulos} series={series} />
      </Card>

      {/* Comparar dois meses */}
      <CompararMeses meses={mesesComparaveis} />

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
            <ComparativoRow icone={IcVenda} nome="Venda líquida" base="vs média 12 meses" cor={CORES.venda}
              delta={cVenda} />
            <ComparativoRow icone={IcTaxa} nome="Taxa de devolução" base="vs média 12 meses" cor={CORES.taxa}
              delta={cTaxa} />
            <ComparativoRow icone={IcPeso} nome="Peso devolvido" base="vs média 12 meses" cor={CORES.peso}
              delta={cPeso} />
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

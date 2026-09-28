import { serieDescarregoMensal } from "@/data/descarregamento-mensal";
import {
  pesoMedioPorCarro,
  receitaMediaPorCarro,
  tipoPredominante,
} from "@/domain/descarregamento-tendencia";
import { ROTULO_TIPO } from "@/domain/descarregamento";
import { variacaoPercentual } from "@/domain/tendencias";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { Card, SectionTitle } from "@/components/ui";
import { CORES, KpiCard, type Delta } from "../widgets";
import { EvolucaoChart, type SeriePainel } from "../evolucao-chart";
import { TendenciasTabs } from "../tabs";
import { MixTipoChart } from "./mix-tipo-chart";

const MES_ABREV = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const rotuloMes = (mes: string) => {
  const [ano, m] = mes.split("-").map(Number);
  return `${MES_ABREV[m - 1]}/${String(ano).slice(2)}`;
};

const inteiro = new Intl.NumberFormat("pt-BR");
const pctComSinal = (frac: number) => `${frac >= 0 ? "+" : "−"}${formatPercent(Math.abs(frac))}`;
const pesoPorCarro = (v: number) => `${formatKg(v)}/carro`;

// "Mais é melhor" para o pátio: subir fica NEUTRO (slate) e cair ganha cor (rose),
// pela regra de identidade do site (verde nunca; só o ruim é destacado).
const deltaBom = (frac: number): Delta => ({
  texto: pctComSinal(frac),
  subindo: frac > 0,
  positivo: frac >= 0,
});

const IcCaminhao = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h11v9H3z" /><path d="M14 9h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></svg>
);
const IcPeso = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5" /><path d="M12 12v9" /></svg>
);
const IcReceita = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2v20" /><path d="M17 5.5A4 4 0 0 0 13 4h-1.5a3.5 3.5 0 0 0 0 7h1a3.5 3.5 0 0 1 0 7H11a4 4 0 0 1-4-1.5" /></svg>
);
const IcCaixa = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="M4 7.5 12 12l8-4.5" /><path d="M12 12v9" /><path d="m8 5.2 8 4.6" /></svg>
);
const IcEficiencia = (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20a8 8 0 1 1 8-8" /><path d="M12 12l4-2.5" /><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" /></svg>
);

function Cabecalho() {
  return (
    <div className="space-y-4">
      <TendenciasTabs />
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tracking-tight text-[#141a4d]">
          Descarrego · evolução mensal
        </h1>
        <p className="mt-1 text-sm text-slate-500">Carros, tipo, peso e receita — mês a mês</p>
      </div>
    </div>
  );
}

export default async function DescarregoTendenciaPage() {
  const serie = await serieDescarregoMensal(12);

  if (serie.length === 0) {
    return (
      <div className="space-y-8">
        <Cabecalho />
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Ainda não há lançamentos de descarrego no período. Registre os totais diários em
            Receitas para o comparativo começar a se formar.
          </p>
        </Card>
      </div>
    );
  }

  const rotulos = serie.map((p) => rotuloMes(p.mes));
  const atual = serie[serie.length - 1];
  const ant = serie[serie.length - 2] ?? atual;
  const temAnterior = serie.length >= 2;

  // O último mês da série é o corrente? Então é parcial (mês em andamento).
  const parcial = atual.mes === primeiroDiaDoMes();

  // Séries mensais.
  const vCarros = serie.map((p) => p.carros);
  const vCaixas = serie.map((p) => p.caixas);
  const vPeso = serie.map((p) => p.pesoKg);
  const vReceita = serie.map((p) => p.receita);
  const vPesoCarro = serie.map((p) => pesoMedioPorCarro(p));

  // Deltas do último mês vs o anterior (0 quando ainda não há dois meses).
  const dCarros = deltaBom(temAnterior ? variacaoPercentual(atual.carros, ant.carros) : 0);
  const dCaixas = deltaBom(temAnterior ? variacaoPercentual(atual.caixas, ant.caixas) : 0);
  const dPeso = deltaBom(temAnterior ? variacaoPercentual(atual.pesoKg, ant.pesoKg) : 0);
  const dReceita = deltaBom(temAnterior ? variacaoPercentual(atual.receita, ant.receita) : 0);
  const dPesoCarro = deltaBom(
    temAnterior ? variacaoPercentual(pesoMedioPorCarro(atual), pesoMedioPorCarro(ant)) : 0,
  );

  const series: SeriePainel[] = [
    { nome: "Carros descarregados", cor: CORES.pdv, valores: vCarros, abs: vCarros.map((v) => inteiro.format(v)) },
    { nome: "Caixas (volume)", cor: "#f5b301", valores: vCaixas, abs: vCaixas.map((v) => inteiro.format(v)) },
    { nome: "Peso descarregado", cor: CORES.venda, valores: vPeso, abs: vPeso.map((v) => formatKg(v)) },
    { nome: "Receita de descarrego", cor: "#c2820a", valores: vReceita, abs: vReceita.map(formatBRL) },
    { nome: "Peso médio por carro", cor: "#8b5cf6", valores: vPesoCarro, abs: vPesoCarro.map(pesoPorCarro) },
  ];

  const pred = tipoPredominante(atual);
  const periodo = serie.length > 1 ? `${rotulos[0]} – ${rotulos[rotulos.length - 1]}` : rotulos[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <Cabecalho />
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600">{periodo}</span>
          {parcial && (
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-700">
              {rotulos[rotulos.length - 1]} em andamento
            </span>
          )}
        </div>
      </div>

      {/* KPIs — último mês + variação vs mês anterior */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard icone={IcCaminhao} nome="Carros descarregados" valor={inteiro.format(atual.carros)} delta={dCarros} valores={vCarros} cor={CORES.pdv} />
        <KpiCard icone={IcCaixa} nome="Caixas (volume)" valor={inteiro.format(atual.caixas)} delta={dCaixas} valores={vCaixas} cor="#f5b301" />
        <KpiCard icone={IcPeso} nome="Peso descarregado" valor={formatKg(atual.pesoKg)} delta={dPeso} valores={vPeso} cor={CORES.venda} />
        <KpiCard icone={IcReceita} nome="Receita de descarrego" valor={formatBRL(atual.receita)} delta={dReceita} valores={vReceita} cor="#c2820a" />
        <KpiCard icone={IcEficiencia} nome="Peso médio por carro" valor={pesoPorCarro(pesoMedioPorCarro(atual))} delta={dPesoCarro} valores={vPesoCarro} cor="#8b5cf6" />
      </div>

      {/* Destaque do mês: tipo predominante */}
      {pred.tipo && (
        <Card className="p-6">
          <SectionTitle>Tipo que mais descarreguei — {rotulos[rotulos.length - 1]}</SectionTitle>
          <p className="mt-2 text-sm text-slate-600">
            <span className="font-bold text-[#141a4d]">{ROTULO_TIPO[pred.tipo]}</span> lidera com{" "}
            <span className="font-semibold tabular-nums">{inteiro.format(pred.carros)}</span> carros —{" "}
            <span className="font-semibold tabular-nums">{formatPercent(pred.fracao)}</span> dos carros detalhados do mês.
            Receita média de <span className="font-semibold tabular-nums">{formatBRL(receitaMediaPorCarro(atual))}</span>/carro.
          </p>
        </Card>
      )}

      {/* Evolução por indicador */}
      <Card className="p-6">
        <div className="mb-4">
          <SectionTitle>Evolução mensal</SectionTitle>
          <p className="text-xs text-slate-400">
            Cada indicador na sua unidade, {periodo}. Passe o mouse para ver o mês.
          </p>
        </div>
        <EvolucaoChart rotulos={rotulos} series={series} />
      </Card>

      {/* Mix por tipo */}
      <Card className="p-6">
        <div className="mb-4">
          <SectionTitle>Composição por tipo</SectionTitle>
          <p className="text-xs text-slate-400">
            Participação de cada tipo nos carros do mês (100% = carros com tipo detalhado).
          </p>
        </div>
        <MixTipoChart pontos={serie} rotulo={rotuloMes} />
      </Card>

      <p className="text-xs text-slate-400">
        Fonte: totais diários de descarregamento (Receitas). Peso médio por carro = peso ÷ carros do mês.
        {parcial && " O mês corrente ainda está em andamento — a comparação com o mês anterior é parcial."}
      </p>
    </div>
  );
}

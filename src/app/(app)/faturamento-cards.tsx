import { getResumoFaturamentoPeriodo } from "@/data/faturamento-mensal";
import { rotuloCurto, type Periodo } from "@/domain/periodo";
import { compararPct, compararTaxa } from "@/domain/comparacao";
import { ComparaPeriodos, type ItemComparacao } from "@/components/compara-periodos";
import { Suspense } from "react";
import { taxaDevolucao, percentualCustoLogistico, type ResumoFaturamento } from "@/domain/faturamento";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { StatCard, HeroStat, Card, SectionTitle } from "@/components/ui";

function Heading() {
  return (
    <h2 className="mb-4 font-[family-name:var(--font-sora)] text-lg font-extrabold tracking-tight text-[#141a4d]">
      Faturamento
    </h2>
  );
}

/**
 * Winthor fora: os números são da última foto do mês, não os ao vivo — podem
 * divergir uns reais da 111. Uma linha só, porque é algo a corrigir (rede).
 */
export function AvisoFoto() {
  return (
    <p className="mb-3 text-xs font-medium text-amber-700" title="O Winthor não respondeu; a foto se atualiza sozinha quando ele voltar.">
      Winthor fora agora · mostrando a última foto do mês
    </p>
  );
}

/** Linha de um detalhamento chave→valor. */
function Linha({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-[#141a4d]">{valor}</span>
    </div>
  );
}

type Medida = (r: ResumoFaturamento) => number;

/**
 * Comparações de um card. Assíncrono e em Suspense próprio: o número do
 * período aparece na hora e as comparações chegam quando o Winthor responde
 * (as leituras são memoizadas por request — todos os cards dividem as mesmas).
 */
async function Chips({ atual, medida, cmp, maiorEhBom, taxa = false }: { atual: number; medida: Medida; cmp: Periodo; maiorEhBom: boolean; taxa?: boolean }) {
  const b = await getResumoFaturamentoPeriodo(cmp.de, cmp.ate).catch(() => null);
  const c = !b ? null : taxa ? compararTaxa(atual, medida(b), maiorEhBom) : compararPct(atual, medida(b), maiorEhBom);
  const itens: ItemComparacao[] = [{ c, referencia: `vs ${rotuloCurto(cmp)}` }];
  return <ComparaPeriodos itens={itens} />;
}

function ChipsEsperando() {
  return <span className="inline-block h-3 w-32 animate-pulse rounded bg-slate-100" />;
}

function comparacoes(atual: number, medida: Medida, cmp: Periodo | null, maiorEhBom: boolean, taxa = false) {
  if (!cmp) return undefined; // comparação desligada: só o número
  return (
    <Suspense fallback={<ChipsEsperando />}>
      <Chips atual={atual} medida={medida} cmp={cmp} maiorEhBom={maiorEhBom} taxa={taxa} />
    </Suspense>
  );
}

/**
 * Cards de faturamento (rotina 111 do Winthor) do período — a visão geral no
 * topo do dashboard, com variação vs período anterior e vs ano passado.
 * Componente assíncrono: deve ficar dentro de um <Suspense> para não travar o
 * resto da página enquanto o Oracle responde.
 */
export async function FaturamentoCards({
  periodo,
  custoTotal,
  comparar,
}: {
  periodo: Periodo;
  custoTotal: number | null;
  /** Período escolhido em "Comparar"; null = cards só com o número. */
  comparar: Periodo | null;
}) {
  // Dispara a comparação já (memoizada), sem esperar por ela.
  if (comparar) void getResumoFaturamentoPeriodo(comparar.de, comparar.ate).catch(() => null);
  const r = await getResumoFaturamentoPeriodo(periodo.de, periodo.ate);

  if (!r) {
    return (
      <div>
        <Heading />
        <Card className="p-6">
          <p className="text-sm text-slate-500">
            Faturamento indisponível — sem conexão com o Winthor. O banco só responde de
            dentro da rede da empresa.
          </p>
        </Card>
      </div>
    );
  }

  const taxaDevol = taxaDevolucao(r);
  const pctCusto = custoTotal === null ? null : percentualCustoLogistico(custoTotal, r.vendaLiquida);
  const cmp = (campo: "vendaFaturada" | "valorDevolucao" | "vendaLiquida" | "atendimentos" | "pesoFaturado" | "emitidas", maiorEhBom: boolean) =>
    comparacoes(r[campo], (x) => x[campo], comparar, maiorEhBom);

  return (
    <div>
      <Heading />
      {r.foto && <AvisoFoto />}

      {/* Herói = Venda faturada (headline pedido pela gerência) + o contraponto
          direto dele (o que voltou). A Venda líquida continua visível abaixo. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col lg:col-span-2">
          <div className="flex-1">
            <HeroStat label="Venda faturada" value={formatBRL(r.vendaFaturada)} />
          </div>
          {comparar && <div className="mt-1.5 px-1">{cmp("vendaFaturada", true)}</div>}
        </div>
        <StatCard label="Valor devolução" value={formatBRL(r.valorDevolucao)} hint="líquido · rotina 111" accent="red" extra={cmp("valorDevolucao", false)} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Venda líquida" value={formatBRL(r.vendaLiquida)} hint="faturada − devolução − avulsa" accent="navy" extra={cmp("vendaLiquida", true)} />
        <StatCard label="Entregas realizadas" value={`${r.atendimentos}`} hint="clientes atendidos no período" accent="navy" extra={cmp("atendimentos", true)} />
        <StatCard label="Peso faturado" value={formatKg(r.pesoFaturado)} accent="navy" extra={cmp("pesoFaturado", true)} />
        <StatCard label="NFs emitidas" value={`${r.emitidas}`} accent="navy" extra={cmp("emitidas", true)} />
        <StatCard
          label="Taxa de devolução"
          value={formatPercent(taxaDevol)}
          accent="red"
          extra={comparacoes(taxaDevol, taxaDevolucao, comparar, false, true)}
        />
        <StatCard label="Custo logístico" value={pctCusto === null ? "sem dado" : formatPercent(pctCusto)} accent="gold" />
      </div>
    </div>
  );
}

/** Fallback do <Suspense> dos cards, enquanto o Oracle responde. */
export function FaturamentoSkeleton() {
  return (
    <div>
      <Heading />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-[132px] animate-pulse rounded-2xl bg-slate-200/70 lg:col-span-2" />
        <div className="h-[132px] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

/**
 * Detalhamento do faturamento — os números crus puxados da rotina 111. Fica no
 * rodapé do dashboard. Reusa a mesma consulta (memoizada) dos cards do topo.
 */
export async function FaturamentoDetalhe({ periodo }: { periodo: Periodo }) {
  const r = await getResumoFaturamentoPeriodo(periodo.de, periodo.ate);
  if (!r) return null;

  return (
    <Card className="p-6">
      <SectionTitle>Detalhamento do período · Winthor</SectionTitle>
      <Linha label="NFs emitidas" valor={`${r.emitidas}`} />
      <Linha label="NFs devolvidas" valor={`${r.devolvidas}`} />
      <Linha label="Devolução avulsa" valor={`${formatBRL(r.valorDevolucaoAvulsa)} · ${r.devolvidasAvulsas} NFs`} />
      <Linha label="Clientes positivados" valor={`${r.positivados}`} />
      <Linha label="Peso faturado" valor={formatKg(r.pesoFaturado)} />
      <Linha label="Peso devolvido" valor={formatKg(r.pesoDevolucao)} />
    </Card>
  );
}

/** Fallback do <Suspense> do detalhamento no rodapé. */
export function FaturamentoDetalheSkeleton() {
  return <div className="h-[288px] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />;
}

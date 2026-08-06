import { getResumoFaturamentoDashboard } from "@/data/faturamento-mensal";
import { taxaDevolucao, percentualCustoLogistico } from "@/domain/faturamento";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { StatCard, HeroStat, Card, SectionTitle } from "@/components/ui";

function Heading() {
  return (
    <h2 className="mb-4 font-[family-name:var(--font-sora)] text-lg font-extrabold tracking-tight text-[#141a4d]">
      Faturamento
    </h2>
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

/**
 * Cards de faturamento (rotina 111 do Winthor) do mês corrente — a visão geral
 * no topo do dashboard. Componente assíncrono: deve ficar dentro de um
 * <Suspense> para não travar o resto da página enquanto o Oracle responde.
 */
export async function FaturamentoCards({ mes, custoTotalMes }: { mes: string; custoTotalMes: number }) {
  const r = await getResumoFaturamentoDashboard(mes);

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
  const pctCusto = percentualCustoLogistico(custoTotalMes, r.vendaLiquida);

  return (
    <div>
      <Heading />

      {/* Herói = Venda faturada (headline pedido pela gerência) + o contraponto
          direto dele (o que voltou). A Venda líquida continua visível abaixo. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <HeroStat label="Venda faturada" value={formatBRL(r.vendaFaturada)} />
        </div>
        <StatCard label="Valor devolução" value={formatBRL(r.valorDevolucao)} hint="líquido · rotina 111" accent="red" />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Venda líquida" value={formatBRL(r.vendaLiquida)} hint="faturada − devolução − avulsa" accent="navy" />
        <StatCard label="PDVs atendidos" value={`${r.atendimentos}`} hint="clientes atendidos no mês" accent="navy" />
        <StatCard label="Peso faturado" value={formatKg(r.pesoFaturado)} accent="navy" />
        <StatCard label="NFs emitidas" value={`${r.emitidas}`} accent="navy" />
        <StatCard label="Taxa de devolução" value={formatPercent(taxaDevol)} accent="red" />
        <StatCard label="Custo logístico" value={formatPercent(pctCusto)} accent="gold" />
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
export async function FaturamentoDetalhe({ mes }: { mes: string }) {
  const r = await getResumoFaturamentoDashboard(mes);
  if (!r) return null;

  return (
    <Card className="p-6">
      <SectionTitle>Detalhamento do mês · Winthor</SectionTitle>
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

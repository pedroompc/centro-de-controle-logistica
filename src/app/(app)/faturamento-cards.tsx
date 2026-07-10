import { getResumoFaturamentoMesAtual } from "@/data/faturamento";
import { taxaDevolucao, percentualCustoLogistico } from "@/domain/faturamento";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { StatCard, Card, SectionTitle } from "@/components/ui";

function Heading() {
  return (
    <div className="mb-4 flex items-center gap-2">
      <h2 className="font-[family-name:var(--font-sora)] text-lg font-extrabold tracking-tight text-[#141a4d]">
        Faturamento
      </h2>
      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        Winthor · Filial 1 · mês corrente
      </span>
    </div>
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
export async function FaturamentoCards({ custoTotalMes }: { custoTotalMes: number }) {
  const r = await getResumoFaturamentoMesAtual();

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Venda líquida" value={formatBRL(r.vendaLiquida)} hint="faturada − devolução" accent="gold" />
        <StatCard label="Valor devolução" value={formatBRL(r.valorDevolucao)} hint={`${r.devolvidas} NFs devolvidas`} accent="red" />
        <StatCard label="Peso faturado" value={formatKg(r.pesoFaturado)} hint="líquido de devolução" accent="navy" />
        <StatCard label="NFs emitidas" value={`${r.emitidas}`} hint={`${r.positivados} clientes positivados`} accent="navy" />
        <StatCard label="Taxa de devolução" value={formatPercent(taxaDevol)} hint="sobre a venda faturada" accent="red" />
        <StatCard label="Custo logístico" value={formatPercent(pctCusto)} hint="do mês ÷ venda líquida" accent="navy" />
      </div>
    </div>
  );
}

/** Fallback do <Suspense> dos cards, enquanto o Oracle responde. */
export function FaturamentoSkeleton() {
  return (
    <div>
      <Heading />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
export async function FaturamentoDetalhe() {
  const r = await getResumoFaturamentoMesAtual();
  if (!r) return null;

  return (
    <Card className="p-6">
      <SectionTitle>Detalhamento do mês · Winthor</SectionTitle>
      <Linha label="NFs emitidas" valor={`${r.emitidas}`} />
      <Linha label="NFs devolvidas" valor={`${r.devolvidas}`} />
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

import { getResumoFaturamentoPeriodo } from "@/data/faturamento-mensal";
import { getFaturadoEntregaRetira } from "@/data/faturamento";
import { lerEntregaRetira } from "@/data/telemetria";
import type { EntregaRetira } from "@/domain/telemetria";
import { rotuloCurto, paramsDoPeriodo, periodoAnoPassado, type Periodo } from "@/domain/periodo";
import { compararPct, compararTaxa } from "@/domain/comparacao";
import { ComparaPeriodos, type ItemComparacao } from "@/components/compara-periodos";
import { Suspense } from "react";
import Link from "next/link";
import {
  taxaDevolucaoLiquida, percentualCustoLogistico, liquidoEntregaRetira, taxaDevEntregaRetira,
  type ResumoFaturamento, type FaturadoEntregaRetira,
} from "@/domain/faturamento";
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

/** Aba Retira da página de Devoluções, no mesmo período e pela data da devolução (= o card). */
function hrefRetira(p: Periodo): string {
  const q = new URLSearchParams({ ...paramsDoPeriodo(p), base: "devolucao", aba: "retira" });
  return `/devolucoes?${q.toString()}`;
}

type LadoER = {
  lado: "entrega" | "retira";
  valor: number;
  /** Número em destaque no selo (ex.: "4,9%"). */
  selo: string;
  /** Texto curto ao lado do selo (ex.: "do faturado entrega"). */
  seloTexto: string;
  detalhe?: string;
  /** Bloco clicável: abre a lista detalhada. */
  href?: string;
};

const ESTILO_LADO = {
  entrega: { rotulo: "Entrega", caixa: "bg-amber-50 ring-amber-200/70", ponto: "bg-amber-400", selo: "bg-amber-400/90 text-[#141a4d]" },
  retira: { rotulo: "Retira", caixa: "bg-[#eef0fb] ring-[#1b2168]/10", ponto: "bg-[#1b2168]", selo: "bg-[#1b2168] text-white" },
} as const;

/** Dois blocos "Entrega | Retira" dentro de um card branco (devolução, venda líquida). */
function BlocosEntregaRetira({ lados, nota }: { lados: LadoER[]; nota?: string }) {
  return (
    <div className="mt-4">
      <div className="grid grid-cols-2 gap-2.5">
        {lados.map((l) => {
          const e = ESTILO_LADO[l.lado];
          const conteudo = (
            <>
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                <span className={`h-2 w-2 rounded-full ${e.ponto}`} />
                {e.rotulo}
              </p>
              <p className="mt-1.5 font-[family-name:var(--font-sora)] text-[clamp(0.95rem,5.2cqi,1.4rem)] font-extrabold leading-tight tracking-tight tabular-nums whitespace-nowrap text-[#141a4d]">
                {formatBRL(l.valor)}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-600">
                <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums ${e.selo}`}>{l.selo}</span>
                <span>{l.seloTexto}</span>
              </p>
              {l.detalhe && <p className="mt-1 text-xs tabular-nums text-slate-500">{l.detalhe}</p>}
              {l.href && <p className="mt-1.5 text-xs font-semibold text-[#1b2168] group-hover:underline">Ver clientes e NFs →</p>}
            </>
          );
          const cls = `rounded-xl px-3.5 py-3 ring-1 ${e.caixa}`;
          return l.href ? (
            <Link key={l.lado} href={l.href} className={`group block transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${cls}`}>
              {conteudo}
            </Link>
          ) : (
            <div key={l.lado} className={cls}>{conteudo}</div>
          );
        })}
      </div>
      {nota && <p className="mt-2 text-xs text-slate-500">{nota}</p>}
    </div>
  );
}

function DevolucaoEntregaRetira({ f, hrefRetira }: { f: FaturadoEntregaRetira; hrefRetira: string }) {
  const t = taxaDevEntregaRetira(f);
  return (
    <BlocosEntregaRetira
      lados={[
        { lado: "entrega", valor: f.devEntrega, selo: formatPercent(t.entrega), seloTexto: "da venda líquida entrega", detalhe: `${f.notasDevEntrega.toLocaleString("pt-BR")} NFs devolvidas` },
        { lado: "retira", valor: f.devRetira, selo: formatPercent(t.retira), seloTexto: "da venda líquida retira", detalhe: `${f.notasDevRetira.toLocaleString("pt-BR")} NFs devolvidas`, href: hrefRetira },
      ]}
    />
  );
}

/**
 * Dentro do card "Venda líquida": quanto foi ENTREGA (carga com motorista) e
 * quanto foi RETIRA (balcão), cada lado líquido da própria devolução. Barra
 * proporcional + valor, % e NFs de venda de cada lado.
 */
function EntregaRetiraFaixa({ f }: { f: FaturadoEntregaRetira }) {
  const l = liquidoEntregaRetira(f);
  const total = l.entrega + l.retira;
  if (total <= 0) return null;
  const p = { entrega: l.entrega / total, retira: l.retira / total };
  const lados = [
    { rotulo: "Líquido entrega", valor: l.entrega, pct: p.entrega, notas: f.notasEntrega, cor: "bg-amber-400" },
    { rotulo: "Líquido retira", valor: l.retira, pct: p.retira, notas: f.notasRetira, cor: "bg-white/45" },
  ];
  return (
    <div className="mt-5">
      <div className="flex h-2 overflow-hidden rounded-full bg-white/10" aria-hidden>
        <span className="h-full bg-amber-400" style={{ width: `${p.entrega * 100}%` }} />
        <span className="h-full bg-white/45" style={{ width: `${p.retira * 100}%` }} />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        {lados.map((l, i) => (
          <div key={l.rotulo} className={i === 1 ? "text-right" : ""}>
            <p className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55 ${i === 1 ? "justify-end" : ""}`}>
              <span className={`h-2 w-2 rounded-full ${l.cor}`} />
              {l.rotulo}
            </p>
            <p className="mt-1 font-[family-name:var(--font-sora)] text-lg font-bold tabular-nums text-white sm:text-xl">
              {formatBRL(l.valor)}
            </p>
            <p className="text-xs tabular-nums text-white/60">
              {formatPercent(l.pct)} · {l.notas.toLocaleString("pt-BR")} NFs
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Comparações de um card. Assíncrono e em Suspense próprio: o número do
 * período aparece na hora e as comparações chegam quando o Winthor responde
 * (as leituras são memoizadas por request — todos os cards dividem as mesmas).
 */
async function Chips({ atual, medida, refs, maiorEhBom, taxa = false }: { atual: number; medida: Medida; refs: Referencia[]; maiorEhBom: boolean; taxa?: boolean }) {
  const itens: ItemComparacao[] = await Promise.all(
    refs.map(async ({ periodo, semaforo }) => {
      const b = await getResumoFaturamentoPeriodo(periodo.de, periodo.ate).catch(() => null);
      const c = !b ? null : taxa ? compararTaxa(atual, medida(b), maiorEhBom) : compararPct(atual, medida(b), maiorEhBom);
      return { c, referencia: `vs ${rotuloCurto(periodo)}`, semaforo };
    }),
  );
  return <ComparaPeriodos itens={itens} />;
}

/** Comparação do card de entregas (mesma regra da Telemetria nos dois períodos). */
async function ChipsEntrega({ atual, refs }: { atual: number; refs: Referencia[] }) {
  const itens: ItemComparacao[] = await Promise.all(
    refs.map(async ({ periodo, semaforo }) => {
      const b = await lerEntregaRetira(periodo.de, periodo.ate).catch(() => null);
      return { c: b ? compararPct(atual, b.entregas, true) : null, referencia: `vs ${rotuloCurto(periodo)}`, semaforo };
    }),
  );
  return <ComparaPeriodos itens={itens} />;
}

/** Período contra o qual um card se compara; `semaforo` = verde/vermelho. */
type Referencia = { periodo: Periodo; semaforo: boolean };

/**
 * Referências dos cards: sempre o MESMO período do ano passado (semáforo) e,
 * se o usuário escolheu outra comparação em "Comparar", ela antes (neutra).
 */
export function referenciasFaturamento(comparar: Periodo | null, anoPassado: Periodo): Referencia[] {
  const outra = comparar && (comparar.de !== anoPassado.de || comparar.ate !== anoPassado.ate);
  return [...(outra ? [{ periodo: comparar, semaforo: false }] : []), { periodo: anoPassado, semaforo: true }];
}

/**
 * Entregas realizadas = cliente × dia que saiu de caminhão com motorista (bate
 * com a Telemetria); embaixo, o que foi retira/balcão. Sem a leitura (Winthor
 * fora), volta ao total de PDVs atendidos da 111.
 */
function CardEntregas({ er, atendimentos, refs }: { er: EntregaRetira | null; atendimentos: number; refs: Referencia[] }) {
  if (!er) {
    return <StatCard label="Entregas realizadas" value={`${atendimentos}`} hint="PDVs atendidos · sem separar retira" accent="navy" />;
  }
  const title = [
    `PDVs atendidos (vendas): ${er.vendidos}`,
    `Entrega (caminhão com motorista): ${er.entregas}`,
    `Retira / balcão: ${er.retira}`,
    er.soEntrega > 0 ? `${er.soEntrega} entrega(s) de simples remessa, sem venda` : null,
  ].filter(Boolean).join("\n");
  return (
    <StatCard
      label="Entregas realizadas"
      value={`${er.entregas}`}
      hint={`retira / balcão: ${er.retira}`}
      title={title}
      accent="navy"
      extra={
        <Suspense fallback={<ChipsEsperando />}>
          <ChipsEntrega atual={er.entregas} refs={refs} />
        </Suspense>
      }
    />
  );
}

function ChipsEsperando() {
  return <span className="inline-block h-3 w-32 animate-pulse rounded bg-slate-100" />;
}

function comparacoes(atual: number, medida: Medida, refs: Referencia[], maiorEhBom: boolean, taxa = false) {
  return (
    <Suspense fallback={<ChipsEsperando />}>
      <Chips atual={atual} medida={medida} refs={refs} maiorEhBom={maiorEhBom} taxa={taxa} />
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
  comparar,
}: {
  periodo: Periodo;
  /** Período escolhido em "Comparar"; null = só o "vs ano passado". */
  comparar: Periodo | null;
}) {
  const refs = referenciasFaturamento(comparar, periodoAnoPassado(periodo));
  // Dispara as comparações já (memoizadas), sem esperar por elas.
  for (const { periodo: p } of refs) {
    void getResumoFaturamentoPeriodo(p.de, p.ate).catch(() => null);
    void lerEntregaRetira(p.de, p.ate).catch(() => null);
  }
  const [r, er, fer] = await Promise.all([
    getResumoFaturamentoPeriodo(periodo.de, periodo.ate),
    lerEntregaRetira(periodo.de, periodo.ate).catch(() => null),
    getFaturadoEntregaRetira(periodo.de, periodo.ate),
  ]);

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

  const taxaDevol = taxaDevolucaoLiquida(r);
  const cmp = (campo: "valorDevolucao" | "vendaLiquida" | "pesoFaturado" | "emitidas", maiorEhBom: boolean) =>
    comparacoes(r[campo], (x) => x[campo], refs, maiorEhBom);

  return (
    <div>
      <Heading />
      {r.foto && <AvisoFoto />}

      {/* Herói = Venda líquida (a faturada bruta saiu em 26/11/2026 — tela mais
          limpa, pedido do Pedro) + o contraponto direto dela (o que voltou). */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col lg:col-span-2">
          <div className="flex-1">
            <HeroStat label="Venda líquida" value={formatBRL(r.vendaLiquida)}>
              {fer && !r.foto && <EntregaRetiraFaixa f={fer} />}
            </HeroStat>
          </div>
          <div className="mt-1.5 px-1">{cmp("vendaLiquida", true)}</div>
        </div>
        <StatCard
          label="Valor devolução"
          value={formatBRL(r.valorDevolucao)}
          hint="líquido · rotina 111"
          accent="red"
          extra={<>{cmp("valorDevolucao", false)}{fer && !r.foto && <DevolucaoEntregaRetira f={fer} hrefRetira={hrefRetira(periodo)} />}</>}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CardEntregas er={r.foto ? null : er} atendimentos={r.atendimentos} refs={refs} />
        <StatCard label="Peso faturado" value={formatKg(r.pesoFaturado)} accent="navy" extra={cmp("pesoFaturado", true)} />
        <StatCard label="NFs emitidas" value={`${r.emitidas}`} accent="navy" extra={cmp("emitidas", true)} />
        <StatCard
          label="Taxa de devolução"
          value={formatPercent(taxaDevol)}
          accent="red"
          extra={comparacoes(taxaDevol, taxaDevolucaoLiquida, refs, false, true)}
        />
      </div>
    </div>
  );
}

/**
 * Custo logístico (% da venda líquida) — fica na linha de custos do dashboard.
 * Reusa a leitura memoizada do faturamento; em Suspense próprio.
 */
export async function CardCustoLogistico({ periodo, custoTotal }: { periodo: Periodo; custoTotal: number | null /* bruto SEM o aluguel do galpão */ }) {
  const r = await getResumoFaturamentoPeriodo(periodo.de, periodo.ate).catch(() => null);
  const pct = custoTotal === null || !r ? null : percentualCustoLogistico(custoTotal, r.vendaLiquida);
  return <StatCard label="Custo logístico" value={pct === null ? "sem dado" : formatPercent(pct)} title="custo bruto sem o aluguel do galpão ÷ venda líquida" accent="gold" />;
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
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
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

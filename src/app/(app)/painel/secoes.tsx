"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatBRL, formatPercent, formatKg } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import type {
  DevolucaoPorMotorista,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  DevolucaoPorSetor,
  DevolucaoPorMotivo,
  SetorDevolucao,
  MotivoDetalhe,
} from "@/domain/devolucoes";
import { setorPredominante, motivoPredominante } from "@/domain/devolucoes-ui";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import { pesoMedioPorCarro, type PontoDescarregoMensal } from "@/domain/descarregamento-tendencia";
import { variacaoPercentual } from "@/domain/tendencias";
import type { DescarregamentoTipo } from "@/domain/types";
import type { ResumoAFaturar, ResumoReceitas, ResumoDescarregos, MesReceitaDetalhe } from "./painel-actions";
import { indicesMelhores, ehMelhorDaJanela, type IndicadoresRecebimento, type IndicadorComparavel } from "@/domain/recebimento";

// Cores dos tipos de descarrego no painel escuro (mesma família do mapa de mix).
const TIPO_COR_TV: Record<DescarregamentoTipo, string> = {
  batido: "#5b6fd6",
  paletizado: "#8b93e0",
  pal_rem: "#f5b301",
  volume: "#38bdf8",
};

/**
 * Progresso do mês (0..1): mês fechado = 1 (100%); mês corrente = fração de dias
 * decorridos; mês futuro = 0. Serve à barra do slide de Receitas — o mês corrente
 * mostra que ainda não fechou, então sua receita é parcial.
 */
function progressoDoMes(mes: string): number {
  const hoje = new Date();
  const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
  if (mes < mesAtual) return 1;
  if (mes > mesAtual) return 0;
  const [ano, m] = mes.split("-").map(Number);
  const diasNoMes = new Date(ano, m, 0).getDate();
  return Math.min(1, hoje.getDate() / diasNoMes);
}

// Chips de setor na paleta escura (o setorPill claro não contrasta no navy).
export const SETOR_COR: Record<SetorDevolucao, { barra: string; chip: string }> = {
  "Logística": { barra: "#4b57c4", chip: "bg-[#2a327f] text-indigo-100" },
  "Comercial": { barra: "#f5b301", chip: "bg-amber-400/20 text-amber-200" },
  "Faturamento": { barra: "#fb7185", chip: "bg-rose-400/20 text-rose-200" },
  "Não classificado": { barra: "#64748b", chip: "bg-slate-400/20 text-slate-200" },
};

const inteiro = new Intl.NumberFormat("pt-BR");

// ---------------------------------------------------------------------------
// Blocos genéricos

/** Variação vs mês anterior, já formatada, para o rodapé do KPI. */
export interface KpiDelta {
  texto: string; // ex.: "+8,2% vs Ago"
  subindo: boolean; // direção da seta
  positivo: boolean; // essa direção é boa? (cor: neutro se sim, rose se não)
}

export function Kpi({
  label,
  value,
  hint,
  tone = "white",
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "white" | "rose" | "amber" | "emerald";
  delta?: KpiDelta;
}) {
  const cor = { white: "text-white", rose: "text-rose-300", amber: "text-amber-300", emerald: "text-emerald-300" }[tone];
  return (
    <div className="@container rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</div>
      {/* Fonte fluida (cqi): encolhe em coluna estreita e nunca estoura a borda. */}
      <div className={`mt-1 font-[family-name:var(--font-sora)] text-[clamp(1.25rem,9cqi,2.25rem)] font-extrabold leading-none tabular-nums whitespace-nowrap ${cor}`}>
        {value}
      </div>
      {delta ? (
        <div className={`mt-2 flex items-center gap-1 text-sm font-bold tabular-nums ${delta.positivo ? "text-white/70" : "text-rose-300"}`}>
          <span>{delta.subindo ? "▲" : "▼"}</span>
          <span>{delta.texto}</span>
        </div>
      ) : hint ? (
        <div className="mt-1.5 text-xs text-white/40">{hint}</div>
      ) : null}
    </div>
  );
}

export function SetorBar({ porSetor }: { porSetor: DevolucaoPorSetor[] }) {
  const total = Math.max(1, porSetor.reduce((t, s) => t + s.valor, 0));
  if (porSetor.length === 0) return null;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {porSetor.map((s) => (
          <div key={s.setor} style={{ width: `${(s.valor / total) * 100}%`, background: SETOR_COR[s.setor].barra }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
        {porSetor.map((s) => (
          <span key={s.setor} className="inline-flex items-center gap-2 text-sm text-white/70">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SETOR_COR[s.setor].chip}`}>{s.setor}</span>
            <span className="font-semibold tabular-nums text-white">{((s.valor / total) * 100).toFixed(1)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export interface LinhaRanking {
  chave: string | number;
  nome: string;
  principal: string;
  secundario?: string;
  selo?: ReactNode; // etiqueta ao lado do nome (esquerda)
  seloDireita?: ReactNode; // etiqueta ao lado do valor (direita)
}

export function BigRanking({ linhas, denso = false, inicio = 0 }: { linhas: LinhaRanking[]; denso?: boolean; inicio?: number }) {
  return (
    <ul className="divide-y divide-white/10">
      {linhas.map((l, i) => (
        <li key={l.chave} className={`flex items-center gap-3.5 ${denso ? "py-2.5" : "py-3 xl:py-3.5"}`}>
          <span
            className={`flex shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-sora)] font-bold tabular-nums ${
              denso ? "h-8 w-8 text-sm" : "h-9 w-9 text-base xl:h-10 xl:w-10"
            } ${inicio + i === 0 ? "bg-amber-400 text-[#0a1650]" : "bg-white/10 text-white/55"}`}
          >
            {inicio + i + 1}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className={`truncate font-semibold text-white ${denso ? "text-lg" : "text-xl xl:text-2xl"}`} title={l.nome}>
              {l.nome}
            </span>
            {l.selo}
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            {l.seloDireita}
            <div className="text-right">
              <div className={`font-[family-name:var(--font-sora)] font-bold tabular-nums text-rose-300 ${denso ? "text-lg" : "text-xl xl:text-2xl"}`}>
                {l.principal}
              </div>
              {l.secundario && <div className="text-sm tabular-nums text-white/40">{l.secundario}</div>}
            </div>
          </div>
        </li>
      ))}
      {linhas.length === 0 && <li className="py-10 text-center text-white/40">Sem dados no período.</li>}
    </ul>
  );
}

/** Top 10 em duas colunas: 1–5 à esquerda, 6–10 à direita, com divisória. */
export function RankingDuasColunas({ linhas }: { linhas: LinhaRanking[] }) {
  const top = linhas.slice(0, 10);
  const esq = top.slice(0, 5);
  const dir = top.slice(5, 10);
  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-0">
      <div className="min-h-0 lg:pr-8">
        <BigRanking denso linhas={esq} />
      </div>
      {dir.length > 0 && (
        <div className="min-h-0 border-t border-white/15 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <BigRanking denso linhas={dir} inicio={5} />
        </div>
      )}
    </div>
  );
}

function SeloSetor({ setor }: { setor: SetorDevolucao }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${SETOR_COR[setor].chip}`}>{setor}</span>;
}

/** Colunas verticais simples (dia/semana/série) — SVG-less, só divs. */
export function MiniBarras({
  itens,
  cor = "#f5b301",
  formatarValor = (v: number) => inteiro.format(v),
  destaque = false,
}: {
  itens: { rotulo: string; valor: number }[];
  cor?: string;
  formatarValor?: (v: number) => string;
  destaque?: boolean; // rótulos maiores e mais claros (poucas barras, ex.: meses)
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  if (itens.length === 0) return <p className="py-10 text-center text-white/40">Sem lançamentos no período.</p>;
  const clsValor = destaque
    ? "text-base font-extrabold tabular-nums text-white xl:text-xl"
    : "text-xs font-semibold tabular-nums text-white/70";
  const clsRotulo = destaque
    ? "text-sm font-bold uppercase tracking-wide text-white xl:text-base"
    : "text-[0.65rem] text-white/40";
  return (
    <div className="flex h-full items-stretch gap-2">
      {itens.map((it, i) => (
        <div key={`${it.rotulo}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className={`shrink-0 whitespace-nowrap ${clsValor}`}>{formatarValor(it.valor)}</span>
          {/* área da barra: flex-1 dá altura definida, então o height % funciona */}
          <div className="flex w-full flex-1 items-end">
            <div className="w-full rounded-t-md transition-[height]" style={{ height: `${Math.max(2, (it.valor / max) * 100)}%`, background: cor }} />
          </div>
          <span className={`w-full shrink-0 truncate text-center font-[family-name:var(--font-sora)] ${clsRotulo}`} title={it.rotulo}>
            {it.rotulo}
          </span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seções de conteúdo (um "slide" cada)

/**
 * Devoluções · clientes e vendedores lado a lado, numa página só.
 *
 * Sem R$ exposto (decisão da diretoria): cada linha mostra a PARTICIPAÇÃO no
 * total devolvido (valor da linha ÷ total devolvido geral), não o valor. O nº de
 * notas continua — é contagem, não dinheiro.
 */
export function SecaoClientesVendedores({
  clientes,
  vendedores,
  totalDevolvido,
  clientesMotivos,
  vendedoresMotivos,
}: {
  clientes: DevolucaoPorCliente[];
  vendedores: DevolucaoPorVendedor[];
  totalDevolvido: number;
  clientesMotivos: Record<number, MotivoDetalhe[]>;
  vendedoresMotivos: Record<number, MotivoDetalhe[]>;
}) {
  const parte = (valor: number) => (totalDevolvido > 0 ? formatPercent(valor / totalDevolvido) : "—");
  // Chip do setor predominante (Comercial/Logística/...) — responde "é comercial
  // ou logístico?" para cada cliente/vendedor.
  const seloDe = (motivos: MotivoDetalhe[] | undefined) => {
    const sp = setorPredominante(motivos);
    return sp ? <SeloSetor setor={sp.setor} /> : undefined;
  };
  // Linha de detalhe: "N notas · <motivo predominante>" (motivo truncado p/ não poluir).
  const detalheDe = (notas: number, motivos: MotivoDetalhe[] | undefined) => {
    const mt = motivoPredominante(motivos);
    const curto = mt ? (mt.length > 26 ? `${mt.slice(0, 25)}…` : mt) : null;
    return curto ? `${notas} notas · ${curto}` : `${notas} notas`;
  };
  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-0">
      {/* Coluna clientes — separada da de vendedores por uma divisória. */}
      <div className="flex min-h-0 flex-col lg:pr-8">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
          <span className="h-4 w-1 rounded-full bg-amber-400" />
          Clientes que mais devolvem
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <BigRanking
            denso
            linhas={[...clientes].sort((a, b) => b.valor - a.valor).slice(0, 8).map((c) => ({
              chave: c.codcli,
              nome: c.nome,
              principal: parte(c.valor),
              secundario: detalheDe(c.notas, clientesMotivos[c.codcli]),
              seloDireita: seloDe(clientesMotivos[c.codcli]),
            }))}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-col border-t border-white/15 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
          <span className="h-4 w-1 rounded-full bg-amber-400" />
          Vendedores com mais devolução
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <BigRanking
            denso
            linhas={[...vendedores].sort((a, b) => b.valor - a.valor).slice(0, 8).map((v) => ({
              chave: v.codVendedor,
              nome: v.nome,
              principal: parte(v.valor),
              secundario: detalheDe(v.notas, vendedoresMotivos[v.codVendedor]),
              seloDireita: seloDe(vendedoresMotivos[v.codVendedor]),
            }))}
          />
        </div>
      </div>
    </div>
  );
}

const STAGE_MS = 7500; // tempo de cada etapa (por nota / por valor)
const MIN_ENTREGAS = 20; // piso p/ ranking em % (senão 1 entrega vira 100%)

function seloTipoMotorista(tipo: DevolucaoPorMotorista["tipo"]): ReactNode {
  if (tipo === "F") return <span className="shrink-0 rounded-full bg-[#2a327f] px-2 py-0.5 text-xs font-semibold text-indigo-100">Da casa</span>;
  if (tipo === "T") return <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-200">Terceirizado</span>;
  return null;
}

/**
 * Devoluções · motoristas que mais voltam. Duas etapas que se alternam sozinhas
 * (mesmo efeito do mapa): etapa 1 = taxa por NOTA (devolvidas/expedidas), etapa
 * 2 = taxa por VALOR (R$ devolvido/R$ expedido). Só motoristas com volume
 * mínimo (senão 1 entrega vira 100%).
 */
export function SecaoMotoristas({ motoristas }: { motoristas: DevolucaoPorMotorista[] }) {
  const [etapa, setEtapa] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setEtapa((e) => (e === 0 ? 1 : 0)), STAGE_MS);
    return () => clearInterval(t);
  }, []);

  const elegiveis = motoristas.filter((m) => m.expedidas >= MIN_ENTREGAS);

  const porNota = [...elegiveis].sort((a, b) => b.taxa - a.taxa).slice(0, 10);
  const porValor = elegiveis
    .filter((m) => m.valorExpedido > 0)
    .map((m) => ({ m, tx: m.valorDevolvido / m.valorExpedido }))
    .sort((a, b) => b.tx - a.tx)
    .slice(0, 10);

  const etapas = [
    {
      id: "nota",
      titulo: "Por nota",
      sub: "entregas voltadas ÷ entregas (%)",
      linhas: porNota.map((m) => ({
        chave: m.codMotorista,
        nome: m.nome,
        principal: formatPercent(m.taxa / 100),
        secundario: `${m.devolvidas} de ${m.expedidas} entregas`,
        selo: seloTipoMotorista(m.tipo),
      })),
    },
    {
      id: "valor",
      titulo: "Por valor",
      sub: "valor devolvido ÷ valor expedido (%)",
      linhas: porValor.map(({ m, tx }) => ({
        chave: m.codMotorista,
        nome: m.nome,
        principal: formatPercent(tx),
        secundario: `${m.devolvidas} de ${m.expedidas} entregas`,
        selo: seloTipoMotorista(m.tipo),
      })),
    },
  ];
  const atual = etapas[etapa];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex gap-1.5">
          {etapas.map((e, i) => (
            <span key={e.id} className={`h-1.5 rounded-full transition-all ${i === etapa ? "w-8 bg-amber-400" : "w-3 bg-white/20"}`} />
          ))}
        </div>
        <span className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">{atual.titulo}</span>
        <span className="text-xs text-white/45">{atual.sub}</span>
        <span className="ml-auto text-xs text-white/35">com {MIN_ENTREGAS}+ entregas</span>
      </div>
      <div key={atual.id} className="etapa-fade min-h-0 flex-1">
        <RankingDuasColunas linhas={atual.linhas} />
      </div>
      <style>{`
        @keyframes etapaFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .etapa-fade { animation: etapaFade 0.45s ease-out both; }
      `}</style>
    </div>
  );
}

/** Devoluções · motivos (participação no total devolvido, sem R$). */
export function SecaoMotivos({ porMotivo }: { porMotivo: DevolucaoPorMotivo[] }) {
  const totalDevolvido = porMotivo.reduce((s, m) => s + m.valor, 0);
  const parte = (valor: number) => (totalDevolvido > 0 ? formatPercent(valor / totalDevolvido) : "—");
  const top = [...porMotivo].sort((a, b) => b.valor - a.valor).slice(0, 10);
  return (
    <RankingDuasColunas
      linhas={top.map((m) => ({
        chave: `${m.motivo}-${m.setor}`,
        nome: m.motivo,
        principal: parte(m.valor),
        secundario: `${m.notas} notas`,
        selo: <SeloSetor setor={m.setor} />,
      }))}
    />
  );
}

/** A faturar · pedidos parados (topo por cidade e por RCA). */
export function SecaoAFaturar({ dados }: { dados: ResumoAFaturar }) {
  if (!dados.disponivel) {
    return <div className="flex h-full items-center justify-center text-lg text-white/40">Sem conexão com o Winthor.</div>;
  }
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Pedidos a faturar" value={inteiro.format(dados.totalPedidos)} tone="amber" hint="liberados/montados sem NF" />
        <Kpi label="Peso em carteira" value={formatKg(dados.pesoTotal)} />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-0">
        <div className="flex min-h-0 flex-col lg:pr-8">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
            <span className="h-4 w-1 rounded-full bg-amber-400" />
            Por cidade
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <BigRanking
              denso
              linhas={[...dados.topCidades].sort((a, b) => b.qtd - a.qtd).map((c) => ({ chave: c.chave, nome: c.nome, principal: inteiro.format(c.qtd), secundario: "pedidos" }))}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col border-t border-white/15 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
            <span className="h-4 w-1 rounded-full bg-amber-400" />
            Por região
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <BigRanking
              denso
              linhas={dados.porRegiao.map((r) => ({ chave: r.chave, nome: r.nome, principal: inteiro.format(r.qtd), secundario: "pedidos" }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Receitas · "por que cada mês rendeu isso". Em cima, o TRIMESTRE (o que os
 * cards não mostram: somas e razões do período). Embaixo, um card por mês com
 * receita, mix de descarrego, a equipe do recebimento e diversas.
 *
 * Cor: número em verde = melhor mês do trimestre naquele indicador (só entre
 * meses fechados). O resto fica branco — vermelho não aparece aqui.
 */
export function SecaoReceitas({
  detalhe,
  recebimento = [],
}: {
  dados?: ResumoReceitas;
  detalhe: MesReceitaDetalhe[];
  recebimento?: IndicadoresRecebimento[];
}) {
  const meses = detalhe.slice(-3); // o trimestre, lado a lado
  const recPorMes = new Map(recebimento.map((r) => [r.mes, r]));
  const janelaRec = meses.map((m) => recPorMes.get(m.mes)).filter((r): r is IndicadoresRecebimento => !!r);
  const fechado = (mes: string) => progressoDoMes(mes) >= 1;
  const melhoresDe = (valor: (m: MesReceitaDetalhe) => number) =>
    indicesMelhores(meses.map((m) => ({ valor: valor(m), fechado: fechado(m.mes) })), true);
  const melhorReceita = melhoresDe((m) => m.receita);
  const melhorCarros = melhoresDe((m) => m.carros);
  const melhorPeso = melhoresDe((m) => m.pesoKg);

  // Altura da barra = descargas. Volume usa as descargas (lançamentos), não as
  // caixas — senão 30 mil caixas esmagariam as colunas de carros.
  const qtdBarra = (m: MesReceitaDetalhe, t: DescarregamentoTipo) =>
    t === "volume" ? m.descargasVolume : m.porTipo[t];
  // Escala compartilhada — colunas comparáveis entre os meses.
  const sharedMaxTipo = Math.max(1, ...meses.flatMap((m) => TIPOS_DESCARREGAMENTO.map((t) => qtdBarra(m, t))));

  return (
    <div className="flex h-full flex-col gap-5">
      <ResumoTrimestre meses={meses} rec={janelaRec} />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Por que cada mês rendeu isso</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {TIPOS_DESCARREGAMENTO.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs text-white/50">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TIPO_COR_TV[t] }} />
                {ROTULO_TIPO[t]}
              </span>
            ))}
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-white/50">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              melhor do trimestre
            </span>
          </div>
        </div>

        {meses.length === 0 ? (
          <p className="py-10 text-center text-white/40">Sem meses para comparar.</p>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
            {meses.map((m, idx) => {
              const detalhados = TIPOS_DESCARREGAMENTO.reduce((s, t) => s + qtdBarra(m, t), 0);
              const prog = progressoDoMes(m.mes);
              const r = recPorMes.get(m.mes);
              return (
                <div key={m.mes} className="flex min-h-0 flex-col rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10">
                  {/* Cabeçalho do card: mês + situação, e a receita */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">{formatMesAno(m.mes)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${prog >= 1 ? "bg-white/10 text-white/50" : "bg-amber-400/15 text-amber-200"}`}>
                      {prog >= 1 ? "fechado" : `em andamento · ${Math.round(prog * 100)}%`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {melhorReceita.has(idx) && <PontoMelhor grande />}
                    <span className={`font-[family-name:var(--font-sora)] text-3xl font-extrabold tabular-nums ${melhorReceita.has(idx) ? "text-emerald-300" : "text-white"}`}>
                      {formatBRL(m.receita)}
                    </span>
                  </div>

                  {/* Descarrego: totais + mix por tipo */}
                  <TituloBloco titulo="Descarrego" direita={r && r.diasDescarrego > 0 ? `${r.diasDescarrego} dias` : undefined} />
                  <div className="mt-1 flex items-baseline gap-4 text-sm tabular-nums">
                    <Destacado melhor={melhorCarros.has(idx)}>{inteiro.format(m.carros)} carros</Destacado>
                    {m.caixas > 0 && <span className="font-semibold text-white/60">{inteiro.format(m.caixas)} cx</span>}
                    <Destacado melhor={melhorPeso.has(idx)} className="ml-auto">{formatKg(m.pesoKg)}</Destacado>
                  </div>
                  {detalhados > 0 ? (
                    <div className="mt-2 flex min-h-[5.5rem] flex-1 items-stretch gap-2">
                      {TIPOS_DESCARREGAMENTO.map((t) => {
                        const qtd = qtdBarra(m, t);
                        const unidade = t === "volume" ? "descargas" : "carros";
                        return (
                          <div key={t} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${ROTULO_TIPO[t]}: ${inteiro.format(qtd)} ${unidade}${m.pesoPorTipo[t] > 0 ? ` · ${formatKg(m.pesoPorTipo[t])}` : ""}`}>
                            <span className="shrink-0 text-sm font-extrabold tabular-nums text-white">{inteiro.format(qtd)}</span>
                            {m.pesoPorTipo[t] > 0 && (
                              <span className="-mt-1 w-full shrink-0 truncate text-center text-[0.7rem] font-semibold tabular-nums text-white/50">{formatKg(m.pesoPorTipo[t])}</span>
                            )}
                            <div className="flex w-full flex-1 items-end">
                              <div className="w-full rounded-t-md" style={{ height: `${Math.max(3, (qtd / sharedMaxTipo) * 100)}%`, background: TIPO_COR_TV[t] }} />
                            </div>
                            <span className="w-full truncate text-center text-[0.7rem] font-bold text-white/70">{ROTULO_TIPO[t]}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2 flex-1 text-xs font-semibold text-white/40">sem quebra por tipo</div>
                  )}

                  <BlocoRecebimento r={r} janela={janelaRec} />

                  {/* Diversas: uma linha só */}
                  <TituloBloco titulo="Diversas" direita={formatBRL(m.diversas)} />
                  <div className="mt-0.5 truncate text-xs text-white/45">
                    {m.materiais.length > 0
                      ? m.materiais.map((mat) => `${mat.material}${mat.kg > 0 ? ` · ${formatKg(mat.kg)}` : ""}`).join("  ·  ")
                      : "sem diversas"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Título de bloco dentro do card: rótulo à esquerda, fio fino, info à direita. */
function TituloBloco({ titulo, direita }: { titulo: string; direita?: string }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-white/45">{titulo}</span>
      <span className="h-px flex-1 bg-white/10" />
      {direita && <span className="text-xs font-semibold tabular-nums text-white/60">{direita}</span>}
    </div>
  );
}

/** Bolinha verde que acompanha o número campeão (cor nunca sozinha). */
function PontoMelhor({ grande = false }: { grande?: boolean }) {
  return <span aria-label="melhor do trimestre" className={`shrink-0 rounded-full bg-emerald-400 ${grande ? "h-2.5 w-2.5" : "h-1.5 w-1.5"}`} />;
}

function Destacado({ melhor, className = "", children }: { melhor: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${melhor ? "text-emerald-300" : "text-white/85"} ${className}`}>
      {melhor && <PontoMelhor />}
      {children}
    </span>
  );
}

/**
 * Linha de cima da tela de Receitas: o TRIMESTRE. Somas e razões do período
 * (receita, toneladas, R$ por tonelada, margem do recebimento), cada uma com uma
 * mini barra por mês — a barra do melhor mês em verde.
 */
function ResumoTrimestre({ meses, rec }: { meses: MesReceitaDetalhe[]; rec: IndicadoresRecebimento[] }) {
  if (meses.length === 0) return null;
  const rotulo = `${formatMesAno(meses[0].mes).slice(0, 3)}–${formatMesAno(meses[meses.length - 1].mes).slice(0, 3)}`;
  const receita = meses.reduce((t, m) => t + m.receita, 0);
  const peso = meses.reduce((t, m) => t + m.pesoKg, 0);
  const carros = meses.reduce((t, m) => t + m.carros, 0);
  const recDesc = rec.reduce((t, r) => t + r.receitaDescarrego, 0);
  const custo = rec.reduce((t, r) => t + r.custoPeriodo, 0);
  const pesoRec = rec.reduce((t, r) => t + r.pesoKg, 0);
  const porT = pesoRec > 0 ? recDesc / (pesoRec / 1000) : null;
  const custoT = pesoRec > 0 ? custo / (pesoRec / 1000) : null;
  const margem = recDesc > 0 ? (recDesc - custo) / recDesc : null;
  const fechado = (mes: string) => progressoDoMes(mes) >= 1;
  const temEquipe = rec.some((r) => r.equipe.total > 0);

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <TileTrimestre
        label={`Receita do trimestre · ${rotulo}`}
        valor={formatBRL(receita)}
        sub={`média de ${formatBRL(receita / meses.length)} por mês`}
        barras={meses.map((m) => ({ mes: m.mes, valor: m.receita, fechado: fechado(m.mes) }))}
      />
      <TileTrimestre
        label="Peso descarregado"
        valor={`${(peso / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} t`}
        sub={`${inteiro.format(carros)} carros · ${carros > 0 ? formatKg(peso / carros) : "—"} por carro`}
        barras={meses.map((m) => ({ mes: m.mes, valor: m.pesoKg, fechado: fechado(m.mes) }))}
      />
      <TileTrimestre
        label="Receita por tonelada"
        valor={porT === null ? "—" : formatBRL(porT)}
        sub={custoT === null || !temEquipe ? "só descarrego" : `custo da equipe: ${formatBRL(custoT)}/t`}
        barras={rec.map((r) => ({ mes: r.mes, valor: r.receitaPorTonelada, fechado: r.fracaoMes >= 1 }))}
      />
      <TileTrimestre
        label="Margem do recebimento"
        valor={margem === null || !temEquipe ? "—" : formatPercent(margem)}
        sub={temEquipe ? `${formatBRL(recDesc - custo)} de descarrego − equipe` : "sem equipe no cadastro"}
        barras={rec.map((r) => ({ mes: r.mes, valor: temEquipe ? r.margem : null, fechado: r.fracaoMes >= 1 }))}
      />
    </div>
  );
}

function TileTrimestre({
  label,
  valor,
  sub,
  barras,
}: {
  label: string;
  valor: string;
  sub: string;
  barras: { mes: string; valor: number | null; fechado: boolean }[];
}) {
  const melhores = indicesMelhores(barras, true);
  const max = Math.max(0, ...barras.map((b) => b.valor ?? 0));
  return (
    <div className="flex items-end justify-between gap-4 rounded-2xl bg-white/[0.06] px-5 py-3.5 ring-1 ring-white/10">
      <div className="min-w-0">
        <div className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</div>
        <div className="mt-1 font-[family-name:var(--font-sora)] text-2xl font-extrabold leading-none tabular-nums text-white xl:text-[1.75rem]">{valor}</div>
        <div className="mt-1.5 truncate text-xs text-white/45">{sub}</div>
      </div>
      {/* Mini barras: um mês por barra, mesma escala; melhor mês em verde. */}
      <div className="flex h-12 shrink-0 items-end gap-1.5" aria-hidden>
        {barras.map((b, i) => (
          <div key={b.mes} className="flex h-full w-5 flex-col items-center justify-end gap-1" title={`${formatMesAno(b.mes)}`}>
            <div
              className={`w-full rounded-t ${melhores.has(i) ? "bg-emerald-400" : "bg-white/25"}`}
              style={{ height: `${max > 0 && b.valor !== null && b.valor > 0 ? Math.max(8, (b.valor / max) * 100) : 4}%` }}
            />
            <span className="text-[0.6rem] font-semibold uppercase text-white/40">{formatMesAno(b.mes).slice(0, 1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * KPI comparativo do painel escuro: valor grande + variação vs o mês anterior.
 * "Mais é melhor" (descarrego): subir fica neutro (branco), cair ganha rose.
 */
function KpiComp({ label, value, frac, temAnt, prevLabel }: { label: string; value: string; frac: number; temAnt: boolean; prevLabel: string }) {
  const subindo = frac >= 0;
  return (
    <div className="@container rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className="mt-1 font-[family-name:var(--font-sora)] text-[clamp(1.25rem,9cqi,2.25rem)] font-extrabold leading-none tabular-nums whitespace-nowrap text-amber-300">{value}</div>
      {temAnt ? (
        <div className={`mt-2 flex items-center gap-1 text-sm font-bold tabular-nums ${subindo ? "text-white/75" : "text-rose-300"}`}>
          <span>{subindo ? "▲" : "▼"}</span>
          <span>{`${frac >= 0 ? "+" : "−"}${formatPercent(Math.abs(frac))}`}</span>
          <span className="font-normal text-white/35">vs {prevLabel}</span>
        </div>
      ) : (
        <div className="mt-2 text-xs text-white/35">sem mês anterior</div>
      )}
    </div>
  );
}

/** Descarregamento · comparação vs mês anterior + dia a dia do mês corrente. */
export function SecaoDescarregos({ dados, serie, mesLabel }: { dados: ResumoDescarregos; serie: PontoDescarregoMensal[]; mesLabel: string }) {
  // Rótulo = dia/mês (dd/mm) para ficar claro que o eixo é a data.
  const porDia = dados.porDia.map((d) => ({ rotulo: `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`, valor: d.descarregos }));

  const atual = serie.length > 0 ? serie[serie.length - 1] : null;
  const ant = serie.length > 1 ? serie[serie.length - 2] : null;
  const temAnt = Boolean(atual && ant);
  const prevLabel = ant ? formatMesAno(ant.mes).slice(0, 3) : "";
  const carros = atual?.carros ?? dados.totalMes;
  const caixas = atual?.caixas ?? 0;
  const peso = atual?.pesoKg ?? 0;
  const pesoCarro = atual ? pesoMedioPorCarro(atual) : 0;
  const dCarros = temAnt ? variacaoPercentual(atual!.carros, ant!.carros) : 0;
  const dCaixas = temAnt ? variacaoPercentual(atual!.caixas, ant!.caixas) : 0;
  const dPeso = temAnt ? variacaoPercentual(atual!.pesoKg, ant!.pesoKg) : 0;
  const dPesoCarro = temAnt ? variacaoPercentual(pesoMedioPorCarro(atual!), pesoMedioPorCarro(ant!)) : 0;

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiComp label="Carros no mês" value={inteiro.format(carros)} frac={dCarros} temAnt={temAnt} prevLabel={prevLabel} />
        <KpiComp label="Caixas (volume)" value={inteiro.format(caixas)} frac={dCaixas} temAnt={temAnt} prevLabel={prevLabel} />
        <KpiComp label="Peso total" value={formatKg(peso)} frac={dPeso} temAnt={temAnt} prevLabel={prevLabel} />
        <KpiComp label="Peso por carro" value={`${formatKg(pesoCarro)}/carro`} frac={dPesoCarro} temAnt={temAnt} prevLabel={prevLabel} />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-h-0 flex-col">
          <div className="mb-1 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Descarregos por dia · {mesLabel}</div>
          <div className="mb-3 text-xs text-white/45">quantidade em cima · data (dia/mês) embaixo</div>
          <div className="min-h-0 flex-1">
            <MiniBarras itens={porDia} cor="#f5b301" destaque />
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Por semana</div>
          <ul className="divide-y divide-white/10">
            {dados.porSemana.map((s) => (
              <li key={s.rotulo} className="flex items-center justify-between py-3">
                <span className="text-lg text-white/80">{s.rotulo}</span>
                <span className="font-[family-name:var(--font-sora)] text-2xl font-bold tabular-nums text-white">{inteiro.format(s.descarregos)}</span>
              </li>
            ))}
            {dados.porSemana.length === 0 && <li className="py-8 text-center text-white/40">Sem lançamentos.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// --- Recebimento (dentro do card do mês, na tela de Receitas) ---------------

function LinhaRec({ rotulo, valor, melhor = false }: { rotulo: string; valor: string; melhor?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <span className="truncate text-xs text-white/50">{rotulo}</span>
      <span className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums ${melhor ? "text-emerald-300" : "text-white"}`}>
        {melhor && <PontoMelhor />}
        {valor}
      </span>
    </div>
  );
}

/**
 * Produtividade e custo da equipe de descarga no mês do card. Médias da EQUIPE
 * (peso do mês ÷ pessoas do cargo), não por pessoa. Verde = melhor do trimestre.
 * "Resultado" = receita de descarrego − custo da equipe.
 */
function BlocoRecebimento({ r, janela }: { r?: IndicadoresRecebimento; janela: IndicadoresRecebimento[] }) {
  if (!r) return null;
  const equipe =
    r.equipe.total > 0
      ? `${r.equipe.ajudantes} aj · ${r.equipe.conferentes} conf · ${formatBRL(r.equipe.custo)}${r.equipeEstimada ? " · est." : ""}`
      : undefined;
  if (r.equipe.total === 0)
    return (
      <>
        <TituloBloco titulo="Recebimento" />
        <div className="mt-1 text-xs font-semibold text-white/40">sem equipe no setor Recebimento do cadastro</div>
      </>
    );
  const melhor = (chave: IndicadorComparavel) => ehMelhorDaJanela(janela, r.mes, chave);
  const kg = (v: number | null) => (v === null ? "—" : formatKg(v));
  const pct = (v: number | null, casas = 1) => (v === null ? "—" : formatPercent(v, casas));
  return (
    <>
      <TituloBloco titulo="Recebimento" direita={equipe} />
      <div className="mt-1 grid grid-cols-2 gap-x-5">
        <div>
          <LinhaRec rotulo="Kg por ajudante" valor={kg(r.kgPorAjudante)} melhor={melhor("kgPorAjudante")} />
          <LinhaRec rotulo="Por ajudante / dia" valor={kg(r.kgPorAjudanteDia)} melhor={melhor("kgPorAjudanteDia")} />
          <LinhaRec rotulo="Custo / fat. líquido" valor={pct(r.custoSobreFaturamento, 2)} melhor={melhor("custoSobreFaturamento")} />
          <LinhaRec rotulo="Custo / descarrego" valor={pct(r.custoSobreDescarrego)} melhor={melhor("custoSobreDescarrego")} />
        </div>
        <div>
          <LinhaRec rotulo="Carros por conferente" valor={r.carrosPorConferente === null ? "—" : inteiro.format(Math.round(r.carrosPorConferente))} melhor={melhor("carrosPorConferente")} />
          <LinhaRec rotulo="Kg por conferente" valor={kg(r.kgPorConferente)} melhor={melhor("kgPorConferente")} />
          <LinhaRec rotulo="Custo por tonelada" valor={r.custoPorTonelada === null ? "—" : formatBRL(r.custoPorTonelada)} melhor={melhor("custoPorTonelada")} />
          <LinhaRec rotulo="Resultado" valor={formatBRL(r.resultado)} melhor={melhor("resultado")} />
        </div>
      </div>
    </>
  );
}

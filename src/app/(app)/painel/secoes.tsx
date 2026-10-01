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
import type { IndicadoresRecebimento } from "@/domain/recebimento";

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
 * Receitas · KPIs por origem + comparação mês a mês com os DRIVERS (carros por
 * tipo, peso e diversas por material) — para explicar POR QUE um mês rendeu mais
 * que o outro. R$ da receita é mantido (exceção acordada do painel).
 */
export function SecaoReceitas({ dados, detalhe }: { dados: ResumoReceitas; detalhe: MesReceitaDetalhe[] }) {
  const origens = [
    { rotulo: "Descarrego", valor: dados.descarregamento },
    { rotulo: "Totais diários", valor: dados.diarios },
    { rotulo: "Diversas", valor: dados.diversas },
  ];
  const meses = detalhe.slice(-4); // últimos meses, lado a lado
  // Altura da barra = descargas. Volume usa as descargas (lançamentos), não as
  // caixas — senão 30 mil caixas esmagariam as colunas de carros.
  const qtdBarra = (m: MesReceitaDetalhe, t: DescarregamentoTipo) =>
    t === "volume" ? m.descargasVolume : m.porTipo[t];
  // Escala compartilhada — colunas comparáveis entre os meses.
  const sharedMaxTipo = Math.max(1, ...meses.flatMap((m) => TIPOS_DESCARREGAMENTO.map((t) => qtdBarra(m, t))));

  return (
    <div className="flex h-full flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Receita do mês" value={formatBRL(dados.totalMes)} tone="emerald" />
        {origens.map((o) => (
          <Kpi key={o.rotulo} label={o.rotulo} value={formatBRL(o.valor)} />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Por que cada mês rendeu isso</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {TIPOS_DESCARREGAMENTO.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs text-white/50">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TIPO_COR_TV[t] }} />
                {ROTULO_TIPO[t]}
              </span>
            ))}
          </div>
        </div>

        {meses.length === 0 ? (
          <p className="py-10 text-center text-white/40">Sem meses para comparar.</p>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
            {meses.map((m) => {
              const detalhados = TIPOS_DESCARREGAMENTO.reduce((s, t) => s + qtdBarra(m, t), 0);
              const prog = progressoDoMes(m.mes);
              return (
                <div key={m.mes} className="flex min-h-0 flex-col rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10">
                  <div className="text-xs font-bold uppercase tracking-wide text-white/50">{formatMesAno(m.mes)}</div>
                  <div className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-emerald-300 xl:text-3xl">{formatBRL(m.receita)}</div>
                  {/* Barra = progresso do mês (fechado = 100%). */}
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-emerald-400" style={{ width: `${prog * 100}%` }} />
                  </div>
                  <div className="mt-1 text-[0.65rem] font-bold uppercase tracking-wide text-white/40">
                    {prog >= 1 ? "mês fechado · 100%" : `mês em andamento · ${Math.round(prog * 100)}%`}
                  </div>

                  <div className="mt-3 flex items-baseline justify-between text-sm">
                    <span className="font-bold uppercase tracking-wide text-white/60">Descarrego</span>
                    <span className="font-bold tabular-nums text-white/85">
                      {inteiro.format(m.carros)} carros{m.caixas > 0 ? ` · ${inteiro.format(m.caixas)} cx` : ""} · {formatKg(m.pesoKg)}
                    </span>
                  </div>
                  {detalhados > 0 ? (
                    <div className="mt-3 flex min-h-[7rem] flex-1 items-stretch gap-2.5">
                      {TIPOS_DESCARREGAMENTO.map((t) => {
                        const qtd = qtdBarra(m, t);
                        const unidade = t === "volume" ? "descargas" : "carros";
                        const caixas = t === "volume" && m.caixas > 0 ? ` · ${inteiro.format(m.caixas)} cx` : "";
                        return (
                          <div key={t} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                            <span className="shrink-0 text-sm font-extrabold tabular-nums text-white">{inteiro.format(qtd)}</span>
                            {/* Peso do tipo logo abaixo da quantidade; some quando o mês só tem total do dia (sem essa quebra). */}
                            {m.pesoPorTipo[t] > 0 && (
                              <span className="-mt-1 w-full shrink-0 truncate text-center text-xs font-semibold tabular-nums text-white/60">{formatKg(m.pesoPorTipo[t])}</span>
                            )}
                            <div className="flex w-full flex-1 items-end">
                              <div className="w-full rounded-t-md" style={{ height: `${Math.max(2, (qtd / sharedMaxTipo) * 100)}%`, background: TIPO_COR_TV[t] }} title={`${ROTULO_TIPO[t]}: ${inteiro.format(qtd)} ${unidade}${caixas}${m.pesoPorTipo[t] > 0 ? ` · ${formatKg(m.pesoPorTipo[t])}` : ""}`} />
                            </div>
                            <span className="w-full truncate text-center text-xs font-bold text-white/85" title={ROTULO_TIPO[t]}>{ROTULO_TIPO[t]}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-3 flex-1 text-xs font-semibold text-white/40">sem quebra por tipo</div>
                  )}

                  <div className="pt-4">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-bold uppercase tracking-wide text-white/60">Diversas</span>
                      <span className="font-bold tabular-nums text-white/85">{formatBRL(m.diversas)}</span>
                    </div>
                    {m.materiais.length > 0 ? (
                      <div className="mt-1.5 space-y-0.5">
                        {m.materiais.map((mat) => (
                          <div key={mat.material} className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="min-w-0 truncate font-semibold text-white/70" title={mat.material}>{mat.material}</span>
                            <span className="shrink-0 font-semibold tabular-nums text-white/50">{mat.kg > 0 ? formatKg(mat.kg) : "—"}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-1 text-xs font-semibold text-white/40">sem diversas</div>
                    )}
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

// --- Recebimento -------------------------------------------------------------

type LinhaRecebimento = {
  rotulo: string;
  detalhe?: string;
  valor: (r: IndicadoresRecebimento) => number | null;
  fmt: (v: number) => string;
  extra?: (r: IndicadoresRecebimento) => string | null; // número secundário, menor, ao lado
  maiorEhBom?: boolean; // destaca o melhor mês da linha
};

const fmtInt = (v: number) => Math.round(v).toLocaleString("pt-BR");
const fmtDec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

// Linhas que andam juntas dividem a mesma linha (valor + extra) — a tabela tem
// que caber inteira no palco de uma TV 1080p.
const LINHAS_RECEBIMENTO: LinhaRecebimento[] = [
  { rotulo: "Kg por ajudante", detalhe: "e por dia de descarrego", valor: (r) => r.kgPorAjudante, fmt: (v) => formatKg(v), extra: (r) => (r.kgPorAjudanteDia === null ? null : `${formatKg(r.kgPorAjudanteDia)}/dia`), maiorEhBom: true },
  { rotulo: "Por conferente", detalhe: "carros e kg conferidos", valor: (r) => r.carrosPorConferente, fmt: (v) => `${fmtInt(v)} carros`, extra: (r) => (r.kgPorConferente === null ? null : formatKg(r.kgPorConferente)), maiorEhBom: true },
  { rotulo: "Custo / faturamento líquido", valor: (r) => r.custoSobreFaturamento, fmt: (v) => formatPercent(v, 2), maiorEhBom: false },
  { rotulo: "Custo / receita de descarrego", valor: (r) => r.custoSobreDescarrego, fmt: (v) => formatPercent(v), maiorEhBom: false },
  { rotulo: "Custo por tonelada", valor: (r) => r.custoPorTonelada, fmt: (v) => formatBRL(v), maiorEhBom: false },
  { rotulo: "Resultado", detalhe: "descarrego − custo da equipe", valor: (r) => r.resultado, fmt: (v) => formatBRL(v), maiorEhBom: true },
  { rotulo: "Dias de descarrego", detalhe: "e carros por dia", valor: (r) => r.diasDescarrego, fmt: fmtInt, extra: (r) => (r.carrosPorDia === null ? null : `${fmtDec(r.carrosPorDia)} carros/dia`) },
  { rotulo: "Equipe", detalhe: "ajudantes · conferentes", valor: (r) => r.equipe.total, fmt: fmtInt, extra: (r) => `${r.equipe.ajudantes} · ${r.equipe.conferentes}` },
  { rotulo: "Custo da equipe", detalhe: "folha do mês", valor: (r) => r.equipe.custo, fmt: (v) => formatBRL(v) },
];

/**
 * Recebimento mês a mês — uma tabela (linhas = indicadores, colunas = meses)
 * para a equipe comparar o mês na tela com os anteriores. O melhor mês de cada
 * linha fica em verde (só entre meses fechados — o corrente é parcial).
 */
export function SecaoRecebimento({ serie }: { serie: IndicadoresRecebimento[] }) {
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl ring-1 ring-white/10">
        <table className="w-full table-fixed text-left">
          <thead>
            <tr className="bg-white/[0.06] text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/45">
              <th className="w-[30%] px-5 py-3">Indicador</th>
              {serie.map((r) => (
                <th key={r.mes} className="px-5 py-3 text-right">
                  {formatMesAno(r.mes)}
                  {r.fracaoMes < 1 && <span className="ml-1 normal-case tracking-normal text-amber-300">em andamento</span>}
                  {r.equipeEstimada && <span className="ml-1 normal-case tracking-normal text-white/35">· equipe estimada</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LINHAS_RECEBIMENTO.map((l) => {
              const fechados = serie.filter((r) => r.fracaoMes >= 1).map(l.valor).filter((v): v is number => v !== null);
              const melhor =
                l.maiorEhBom === undefined || fechados.length < 2
                  ? null
                  : l.maiorEhBom ? Math.max(...fechados) : Math.min(...fechados);
              return (
                <tr key={l.rotulo} className="border-t border-white/[0.06]">
                  <td className="px-5 py-1.5">
                    <div className="font-semibold text-white/85">{l.rotulo}</div>
                    {l.detalhe && <div className="text-xs text-white/35">{l.detalhe}</div>}
                  </td>
                  {serie.map((r) => {
                    const v = l.valor(r);
                    const destaque = melhor !== null && v === melhor && r.fracaoMes >= 1;
                    const extra = v === null ? null : l.extra?.(r);
                    return (
                      <td key={r.mes} className={`px-5 py-1.5 text-right font-[family-name:var(--font-sora)] text-lg font-bold tabular-nums xl:text-xl ${destaque ? "text-emerald-300" : "text-white"}`}>
                        {v === null ? <span className="text-white/25">—</span> : l.fmt(v)}
                        {extra && <span className="ml-2 font-sans text-sm font-medium text-white/40">{extra}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-white/35">
        Médias da equipe (peso do mês ÷ pessoas do cargo), não por pessoa. Peso = lançamentos de descarrego. Custo = folha
        dos ativos do setor Recebimento; no mês em andamento entra proporcional aos dias corridos.
      </p>
    </div>
  );
}

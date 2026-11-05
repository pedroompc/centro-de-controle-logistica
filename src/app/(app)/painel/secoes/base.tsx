"use client";

import { ValorVivo, deltaNoFormato, numeroDoTexto } from "@/components/movimento";
import type { ReactNode } from "react";
import type { DevolucaoPorSetor, SetorDevolucao } from "@/domain/devolucoes";
import type { Comparacao } from "@/domain/comparacao";

/**
 * Progresso do mês (0..1): mês fechado = 1 (100%); mês corrente = fração de dias
 * decorridos; mês futuro = 0. Serve à barra do slide de Receitas — o mês corrente
 * mostra que ainda não fechou, então sua receita é parcial.
 */
export function progressoDoMes(mes: string): number {
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

export const inteiro = new Intl.NumberFormat("pt-BR");

// ---------------------------------------------------------------------------
// Blocos genéricos

/** Variação vs mês anterior, já formatada, para o rodapé do KPI. */
export interface KpiDelta {
  texto: string; // ex.: "+8,2% vs Ago"
  subindo: boolean; // direção da seta
  positivo: boolean; // essa direção é boa? (cor: neutro se sim, rose se não)
  // Exceção pedida pelo Pedro: devolução caindo fica verde (não neutra) na TV.
  verdeSeBom?: boolean;
}

export function Kpi({
  label,
  value,
  hint,
  tone = "white",
  delta,
  detalhe,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "white" | "rose" | "amber" | "emerald";
  delta?: KpiDelta;
  detalhe?: string; // linha extra abaixo da variação (ex.: peso devolvido)
}) {
  const cor = { white: "text-white", rose: "text-rose-300", amber: "text-amber-300", emerald: "text-emerald-300" }[tone];
  return (
    <div className="@container rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</div>
      {/* Fonte fluida (cqi): encolhe em coluna estreita e nunca estoura a borda. */}
      <div className={`mt-1 font-[family-name:var(--font-sora)] text-[clamp(1.25rem,9cqi,2.25rem)] font-extrabold leading-none tabular-nums whitespace-nowrap ${cor}`}>
        {/* Número que muda no refresh brilha em âmbar e mostra a variação. */}
        <ValorVivo valor={numeroDoTexto(value)} texto={value} formatarDelta={(d) => deltaNoFormato(value, d)} />
      </div>
      {delta ? (
        <div className={`mt-2 flex items-center gap-1 text-sm font-bold tabular-nums ${delta.positivo ? (delta.verdeSeBom ? "text-emerald-300" : "text-white/70") : "text-rose-300"}`}>
          <span>{delta.subindo ? "▲" : "▼"}</span>
          <span>{delta.texto}</span>
        </div>
      ) : hint ? (
        <div className="mt-1.5 text-xs text-white/40">{hint}</div>
      ) : null}
      {detalhe && <div className="mt-1 truncate text-xs font-semibold tabular-nums text-white/55">{detalhe}</div>}
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

export function SeloSetor({ setor }: { setor: SetorDevolucao }) {
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
 * KPI do painel escuro com valor âmbar e a variação vs mês anterior embaixo
 * (regra única de `@/domain/comparacao`): direção ruim em rose, boa neutra.
 */
export function KpiTV({ label, value, c, prevLabel, sub }: { label: string; value: string; c: Comparacao | null; prevLabel: string; sub?: string }) {
  return (
    <div className="@container rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className="mt-1 font-[family-name:var(--font-sora)] text-[clamp(1.25rem,9cqi,2.25rem)] font-extrabold leading-none tabular-nums whitespace-nowrap text-amber-300">{value}</div>
      {c ? (
        <div className={`mt-2 flex items-center gap-1 text-sm font-bold tabular-nums ${c.positivo ? "text-white/75" : "text-rose-300"}`}>
          <span>{c.subindo ? "▲" : "▼"}</span>
          <span>{c.texto}</span>
          <span className="font-normal text-white/35">vs {prevLabel}</span>
        </div>
      ) : (
        <div className="mt-2 truncate text-xs text-white/35">{sub ?? "\u00a0"}</div>
      )}
    </div>
  );
}

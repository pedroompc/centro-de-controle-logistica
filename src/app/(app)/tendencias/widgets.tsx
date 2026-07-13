import type { ReactNode } from "react";
import { Card } from "@/components/ui";

// Paleta validada (dataviz, light): venda azul, devolução vermelho, peso laranja,
// taxa violeta; verde/vermelho para variação boa/ruim.
export const CORES = {
  venda: "#2563eb",
  devolucao: "#e11d48",
  peso: "#d97706",
  taxa: "#7c3aed",
  positivo: "#059669",
  negativo: "#dc2626",
} as const;

export interface Delta {
  texto: string; // já formatado com sinal, ex.: "−29%" ou "+12,7%" ou "−1,9 p.p."
  subindo: boolean; // o valor cresceu? (direção da seta)
  positivo: boolean; // essa direção é boa? (cor)
}

function Seta({ subindo }: { subindo: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      {subindo ? <path d="M8 13V3M8 3l-4 4M8 3l4 4" /> : <path d="M8 3v10M8 13l-4-4M8 13l4-4" />}
    </svg>
  );
}

/** Barrinhas (sparkline) — último mês em destaque, demais esmaecidos. */
export function MiniBars({ valores, cor }: { valores: number[]; cor: string }) {
  const max = Math.max(0, ...valores) || 1;
  const n = valores.length;
  const W = 108, H = 34, gap = 2.5;
  const bw = (W - gap * (n - 1)) / n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[34px] w-[108px] shrink-0" aria-hidden="true">
      {valores.map((v, i) => {
        const h = Math.max(2, (v / max) * (H - 2));
        return (
          <rect key={i} x={i * (bw + gap)} y={H - h} width={bw} height={h} rx="1.4"
            fill={cor} opacity={i === n - 1 ? 1 : 0.28} />
        );
      })}
    </svg>
  );
}

export function KpiCard({ icone, nome, valor, delta, valores, cor }: {
  icone: ReactNode; nome: string; valor: string; delta: Delta; valores: number[]; cor: string;
}) {
  const deltaCor = delta.positivo ? CORES.positivo : CORES.negativo;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${cor}14`, color: cor }}>{icone}</span>
          <span className="text-sm font-medium text-slate-500">{nome}</span>
        </div>
        <MiniBars valores={valores} cor={cor} />
      </div>
      <p className="mt-3 font-[family-name:var(--font-sora)] text-[26px] font-extrabold leading-none tracking-tight text-[#141a4d]">
        {valor}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: deltaCor }}>
        <Seta subindo={delta.subindo} />
        {delta.texto}
        <span className="font-normal text-slate-400">vs mês anterior</span>
      </p>
    </Card>
  );
}

export interface SerieChart { nome: string; cor: string; indices: number[]; abs: string[] }

/**
 * Gráfico de barras agrupadas INDEXADO: cada série é normalizada pelo seu próprio
 * pico (0–100%), então as barras comparam a evolução de cada indicador entre os
 * meses numa escala única e honesta. Valor absoluto vai no tooltip de cada barra.
 */
export function EvolucaoChart({ rotulos, series }: { rotulos: string[]; series: SerieChart[] }) {
  const W = 1040, H = 300, padL = 40, padR = 14, padTop = 12, padBottom = 30;
  const plotW = W - padL - padR, plotH = H - padTop - padBottom;
  const y0 = padTop + plotH;
  const nMeses = rotulos.length;
  const groupW = plotW / nMeses;
  const cluster = groupW * 0.72;
  const nS = series.length;
  const barGap = 2;
  const barW = (cluster - barGap * (nS - 1)) / nS;
  const linhas = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Evolução mensal indexada">
      {linhas.map((t) => {
        const y = y0 - t * plotH;
        return (
          <g key={t}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#eef1f6" strokeWidth="1" />
            <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{t * 100}%</text>
          </g>
        );
      })}
      {rotulos.map((rot, gi) => {
        const gx = padL + gi * groupW + (groupW - cluster) / 2;
        return (
          <g key={gi}>
            {series.map((s, si) => {
              const idx = s.indices[gi] ?? 0;
              const h = Math.max(1.5, idx * plotH);
              const x = gx + si * (barW + barGap);
              return (
                <rect key={si} x={x} y={y0 - h} width={barW} height={h} rx="2.5" fill={s.cor}>
                  <title>{`${rot} · ${s.nome}: ${s.abs[gi]}`}</title>
                </rect>
              );
            })}
            <text x={padL + gi * groupW + groupW / 2} y={H - 10} textAnchor="middle" fontSize="10.5" fill="#64748b">{rot}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Legenda de séries (marca colorida + nome; texto em tinta neutra). */
export function Legenda({ series }: { series: { nome: string; cor: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {series.map((s) => (
        <span key={s.nome} className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.cor }} />
          {s.nome}
        </span>
      ))}
    </div>
  );
}

/** Ranking horizontal: top meses por valor de devolução. */
export function RankingBars({ itens }: { itens: { rotulo: string; valor: number; abs: string }[] }) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="space-y-3">
      {itens.map((it, i) => (
        <div key={it.rotulo} className="flex items-center gap-3">
          <span className="w-12 shrink-0 text-xs font-medium text-slate-500">{it.rotulo}</span>
          <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
            <div className="flex h-full items-center rounded-md"
              style={{ width: `${Math.max(6, (it.valor / max) * 100)}%`, backgroundColor: i === 0 ? CORES.devolucao : "#f2647d" }} />
          </div>
          <span className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums text-[#141a4d]">{it.abs}</span>
        </div>
      ))}
    </div>
  );
}

/** Linha de indicador comparativo: nome, mini-barras, variação com seta/cor. */
export function ComparativoRow({ icone, nome, base, delta, valores, cor }: {
  icone: ReactNode; nome: string; base: string; delta: Delta; valores: number[]; cor: string;
}) {
  const deltaCor = delta.positivo ? CORES.positivo : CORES.negativo;
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${cor}14`, color: cor }}>{icone}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-[#141a4d]">{nome}</p>
        <p className="text-xs text-slate-400">{base}</p>
      </div>
      <MiniBars valores={valores} cor={cor} />
      <span className="flex w-20 shrink-0 items-center justify-end gap-1 text-sm font-bold tabular-nums" style={{ color: deltaCor }}>
        <Seta subindo={delta.subindo} />{delta.texto}
      </span>
    </div>
  );
}

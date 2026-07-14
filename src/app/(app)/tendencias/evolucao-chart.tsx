"use client";

import { useRef, useState, type MouseEvent } from "react";

export interface SerieChart { nome: string; cor: string; indices: number[]; abs: string[] }

/**
 * Barras agrupadas indexadas (0–100% do pico de cada série), interativo: ao
 * passar o mouse num mês, ele é destacado, os demais esmaecem e um tooltip
 * mostra os valores absolutos das 4 séries daquele mês.
 */
export function EvolucaoChart({ rotulos, series }: { rotulos: string[]; series: SerieChart[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  const W = 1040, H = 300, padL = 40, padR = 14, padTop = 12, padBottom = 30;
  const plotW = W - padL - padR, plotH = H - padTop - padBottom;
  const y0 = padTop + plotH;
  const n = rotulos.length;
  const groupW = plotW / n;
  const cluster = groupW * 0.72;
  const barGap = 2;
  const barW = (cluster - barGap * (series.length - 1)) / series.length;
  const linhas = [0, 0.25, 0.5, 0.75, 1];

  function mover(e: MouseEvent, gi: number) {
    const r = ref.current?.getBoundingClientRect();
    if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    setHover(gi);
  }

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full select-none" role="img" aria-label="Evolução mensal indexada">
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
          const ativo = hover === null || hover === gi;
          const gx = padL + gi * groupW + (groupW - cluster) / 2;
          return (
            <g key={gi}>
              {hover === gi && (
                <rect x={padL + gi * groupW} y={padTop} width={groupW} height={plotH} rx="6" fill="#f1f5f9" />
              )}
              {series.map((s, si) => {
                const h = Math.max(1.5, (s.indices[gi] ?? 0) * plotH);
                return (
                  <rect key={si} x={gx + si * (barW + barGap)} y={y0 - h} width={barW} height={h} rx="2.5"
                    fill={s.cor} opacity={ativo ? 1 : 0.28} style={{ transition: "opacity .12s" }} />
                );
              })}
              <text x={padL + gi * groupW + groupW / 2} y={H - 10} textAnchor="middle" fontSize="10.5"
                fill={hover === gi ? "#141a4d" : "#64748b"} fontWeight={hover === gi ? 700 : 400}>{rot}</text>
            </g>
          );
        })}
        {/* Alvos de hover (por cima, invisíveis) */}
        {rotulos.map((_, gi) => (
          <rect key={gi} x={padL + gi * groupW} y={padTop} width={groupW} height={plotH}
            fill="transparent" onMouseMove={(e) => mover(e, gi)} />
        ))}
      </svg>

      {hover !== null && (
        <div
          className="pointer-events-none absolute z-10 w-52 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          style={{ left: pos.x, top: pos.y, transform: "translate(-50%, calc(-100% - 14px))" }}
        >
          <p className="mb-2 text-xs font-bold text-[#141a4d]">{rotulos[hover]}</p>
          <div className="space-y-1.5">
            {series.map((s) => (
              <div key={s.nome} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.cor }} />
                <span className="flex-1 text-slate-500">{s.nome}</span>
                <span className="font-semibold tabular-nums text-[#141a4d]">{s.abs[hover]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

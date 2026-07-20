"use client";

import { useState } from "react";

export interface SeriePainel {
  nome: string;
  cor: string;
  valores: number[]; // valores reais, na unidade do indicador
  abs: string[]; // os mesmos valores já formatados p/ exibição
}

const W = 340, H = 150;
const PAD_L = 10, PAD_R = 12, PAD_TOP = 34, PAD_BOTTOM = 22;
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_TOP - PAD_BOTTOM;

/**
 * Um painel por indicador, cada um na sua própria escala e unidade real.
 *
 * Substituiu um gráfico de barras agrupadas que indexava cada série pelo próprio
 * pico: 4 séries × 12 meses viravam 48 barras, e "100%" significava um mês
 * diferente em cada série — alturas lado a lado que convidavam a uma comparação
 * que não existia. Tendência no tempo pede linha, e unidades diferentes pedem
 * painéis separados em vez de um eixo comum inventado.
 */
export function EvolucaoChart({ rotulos, series }: { rotulos: string[]; series: SeriePainel[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {series.map((s) => (
        <Painel key={s.nome} rotulos={rotulos} serie={s} />
      ))}
    </div>
  );
}

function Painel({ rotulos, serie }: { rotulos: string[]; serie: SeriePainel }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = serie.valores.length;

  const min = Math.min(...serie.valores);
  const max = Math.max(...serie.valores);
  const span = max - min || 1;
  // 10% de folga em cima e embaixo para a linha não encostar nas bordas.
  const x = (i: number) => PAD_L + (n === 1 ? PLOT_W / 2 : (i * PLOT_W) / (n - 1));
  const y = (v: number) => PAD_TOP + PLOT_H - ((v - min) / span) * PLOT_H * 0.8 - PLOT_H * 0.1;

  const linha = serie.valores.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const ultimo = n - 1;
  const foco = hover ?? ultimo;

  return (
    <div
      className="rounded-xl bg-slate-50/70 p-3"
      onMouseLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label={`${serie.nome}: de ${serie.abs[0]} em ${rotulos[0]} a ${serie.abs[ultimo]} em ${rotulos[ultimo]}`}
      >
        {/* Cabeçalho: nome à esquerda, valor do mês em foco à direita */}
        <text x={PAD_L} y={14} fontSize="12" fill="#64748b">{serie.nome}</text>
        <text x={W - PAD_R} y={14} textAnchor="end" fontSize="13" fontWeight="700" fill="#141a4d">
          {serie.abs[foco]}
        </text>
        <text x={W - PAD_R} y={27} textAnchor="end" fontSize="10.5" fill="#94a3b8">
          {rotulos[foco]}
        </text>

        <path d={linha} fill="none" stroke={serie.cor} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {/* Guia vertical + ponto no mês sob o cursor */}
        {hover !== null && (
          <line
            x1={x(hover)} y1={PAD_TOP} x2={x(hover)} y2={PAD_TOP + PLOT_H}
            stroke="#cbd5e1" strokeWidth="1" strokeDasharray="3 3"
          />
        )}
        <circle
          cx={x(foco)} cy={y(serie.valores[foco])} r="4.5"
          fill={serie.cor} stroke="#ffffff" strokeWidth="2"
        />

        <text x={PAD_L} y={H - 6} fontSize="10" fill="#94a3b8">{rotulos[0]}</text>
        <text x={W - PAD_R} y={H - 6} textAnchor="end" fontSize="10" fill="#94a3b8">{rotulos[ultimo]}</text>

        {/* Faixas invisíveis de hover, cada uma centrada no seu ponto */}
        {rotulos.map((rot, i) => {
          const passo = n > 1 ? PLOT_W / (n - 1) : PLOT_W;
          const esq = Math.max(PAD_L, x(i) - passo / 2);
          const dir = Math.min(PAD_L + PLOT_W, x(i) + passo / 2);
          return (
            <rect
              key={i}
              x={esq}
              y={PAD_TOP}
              width={dir - esq}
              height={PLOT_H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            >
              <title>{`${rot}: ${serie.abs[i]}`}</title>
            </rect>
          );
        })}
      </svg>
    </div>
  );
}

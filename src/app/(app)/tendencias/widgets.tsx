import type { ReactNode } from "react";
import { Card } from "@/components/ui";

/**
 * Paleta semântica, não categórica: navy = operação normal, âmbar = devolução
 * (o que se quer vigiar). Antes eram quatro hues que só distinguiam séries num
 * plot compartilhado; com um painel por indicador, o título já faz esse trabalho
 * e a cor ficou livre para significar algo.
 *
 * Tons da identidade do site, ajustados para passar nas checagens de dataviz —
 * o navy da marca (#181d55, L 0.27) fica fora da faixa de luminosidade; #3d47a8
 * é o mais próximo dele que passa. Par validado: ΔE 35,5 normal / 34+ sob CVD.
 */
export const CORES = {
  venda: "#3d47a8",
  devolucao: "#c2820a",
  peso: "#c2820a",
  taxa: "#c2820a",
  // Status (bom/ruim da variação) — reservados, não são "mais uma cor de série".
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
              style={{ width: `${Math.max(6, (it.valor / max) * 100)}%`, backgroundColor: i === 0 ? CORES.devolucao : "#e0a63f" }} />
          </div>
          <span className="w-28 shrink-0 text-right text-xs font-semibold tabular-nums text-[#141a4d]">{it.abs}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Linha de indicador comparativo: ícone, nome e variação com seta/cor.
 *
 * Sem mini-barras de propósito. Este card vive numa coluna de 1/3, e as barrinhas
 * (108px fixos) espremiam o nome até sobrar "Ven…". As mesmas séries já aparecem
 * como sparkline nos KpiCard do topo, então nada se perde ao tirá-las daqui.
 */
export function ComparativoRow({ icone, nome, base, delta, cor }: {
  icone: ReactNode; nome: string; base: string; delta: Delta; cor: string;
}) {
  const deltaCor = delta.positivo ? CORES.positivo : CORES.negativo;
  return (
    <div className="flex items-center gap-3 py-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${cor}14`, color: cor }}>{icone}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-[#141a4d]">{nome}</p>
        <p className="text-xs text-slate-400">{base}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-sm font-bold tabular-nums" style={{ color: deltaCor }}>
        <Seta subindo={delta.subindo} />{delta.texto}
      </span>
    </div>
  );
}

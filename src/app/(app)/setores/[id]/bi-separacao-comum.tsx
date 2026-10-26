import type { ReactNode } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import type { Turno } from "@/domain/types";

export const n0 = (v: number) => Math.round(v).toLocaleString("pt-BR");
export const n1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
export const t1 = (kg: number) => `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} t`;
export const ou = <T,>(v: T | null | undefined, f: (x: T) => string) => (v === null || v === undefined ? "—" : f(v));
export const brl = (v: number | null) => ou(v, formatBRL);
export const pct = (v: number | null, casas = 1) => ou(v, (x) => formatPercent(x, casas));
export const sinalPct = (v: number | null) => ou(v, (x) => `${x > 0 ? "+" : ""}${formatPercent(x, 1)}`);
export const varRel = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : a / b - 1);

// Grades que se ajustam à largura (tela, janela ou zoom) sem quebrar em breakpoint fixo.
export const GRADE_CARDS = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,8.5rem),1fr))] gap-3";
export const GRADE_MENU = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3";
/** Visão "TV": ocupa a altura do palco em tela larga; fora dela, flui na altura natural. */
export const VISAO = "grid grid-cols-[minmax(0,1fr)] gap-3 xl:h-full xl:min-h-0";
/** Duas colunas lado a lado só em tela larga; abaixo, uma coluna que encolhe com a tela. */
export const DUAS_COLUNAS = "grid grid-cols-[minmax(0,1fr)] gap-4 xl:min-h-0";

// Turno sem verde (verde é só receita) — mesma família das etiquetas da equipe.
export const COR_TURNO: Record<Turno, string> = { manha: "#fcd34d", tarde: "#fb923c", noite: "#818cf8" };

/** Alerta curto de dado (uma linha), só quando há algo a corrigir. */
export function Aviso({ children }: { children: ReactNode }) {
  return <div className="rounded-xl bg-amber-400/10 px-3 py-2 text-xs text-amber-100/90 ring-1 ring-amber-400/30">{children}</div>;
}

/** Tabela compacta no escuro. */
export function Tabela({ cab, linhas, alinhar }: { cab: ReactNode[]; linhas: ReactNode[][]; alinhar?: ("l" | "r")[] }) {
  const cls = (i: number) => (alinhar?.[i] === "l" || (!alinhar && i === 0) ? "text-left" : "text-right");
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-sm">
      <thead className="sticky top-0 bg-[#121a5a] text-[0.62rem] uppercase tracking-[0.12em] text-white/40">
        <tr>
          {cab.map((c, i) => (
            <th key={i} className={`py-2 pr-2 font-semibold ${cls(i)}`}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {linhas.map((l, j) => (
          <tr key={j} className="border-t border-white/[0.06]">
            {l.map((c, i) => (
              <td key={i} className={`py-1.5 pr-2 tabular-nums ${cls(i)} ${i === 0 ? "text-white" : "text-white/75"}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      </table>
    </div>
  );
}

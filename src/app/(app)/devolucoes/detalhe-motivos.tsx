"use client";

import { setorPill } from "@/domain/devolucoes-ui";
import { formatBRL } from "@/domain/format";
import type { MotivoDetalhe } from "@/domain/devolucoes";

/** Lista de motivos (valor + quantidade) de uma entidade — corpo dos drill-downs. */
export default function DetalheMotivos({ motivos }: { motivos: MotivoDetalhe[] }) {
  if (motivos.length === 0) {
    return <p className="px-4 py-4 text-center text-xs text-slate-400">Sem motivos registrados.</p>;
  }
  const maxNotas = Math.max(1, ...motivos.map((m) => m.notas));
  return (
    <div className="space-y-2 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Motivos da devolução ({motivos.length})
      </p>
      {motivos.map((m, i) => (
        <div key={`${m.motivo}-${i}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[#141a4d]" title={m.motivo}>{m.motivo}</span>
              <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:inline-flex ${setorPill(m.setor)}`}>
                {m.setor}
              </span>
            </span>
            <span className="flex shrink-0 items-baseline gap-3 tabular-nums">
              <span className="text-slate-700">
                <b className="text-slate-800">{m.notas}</b> <span className="text-[10px] text-slate-400">notas</span>
              </span>
              <span className="w-24 text-right font-semibold text-[#141a4d]">{formatBRL(m.valor)}</span>
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-amber-400" style={{ width: `${(m.notas / maxNotas) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

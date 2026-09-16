"use client";

import { useMemo, useState } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { formatBRL } from "@/domain/format";
import { filtrarPorBusca } from "@/domain/devolucoes-ui";
import type { BairroDevolucao } from "@/domain/devolucoes-mapa";
import { IconePredio, IconeBusca } from "./icons";

/**
 * Devolução por bairro na Região Metropolitana do Recife (cidade + bairro),
 * pela data da devolução (bate com o 111). Mostra o R$ devolvido, nº de notas
 * e o motivo predominante (o de maior R$) — sem taxa, que no bairro engana.
 */
export default function TabelaBairrosRMR({ bairros }: { bairros: BairroDevolucao[] }) {
  const [busca, setBusca] = useState("");
  const lista = useMemo(
    () => filtrarPorBusca(bairros, busca, (b) => [b.bairro, b.cidade, b.motivo]),
    [bairros, busca],
  );
  const lider = bairros[0] ?? null; // já ordenado por R$ devolvido desc

  const campoBusca = (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <IconeBusca />
      </span>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar bairro, cidade ou motivo…"
        aria-label="Buscar bairro, cidade ou motivo"
        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50 sm:w-72"
      />
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconePredio />}
        title="Devolução por bairro · RMR"
        context={`${lista.length} bairros · por R$ devolvido`}
        right={campoBusca}
      />
      {lider && (
        <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
          Maior volume:{" "}
          <span className="font-semibold text-[#141a4d]">{lider.bairro}</span>{" "}
          <span className="text-slate-400">({lider.cidade})</span> —{" "}
          {formatBRL(lider.devolvido)} · motivo{" "}
          <span className="font-medium text-slate-600">{lider.motivo}</span>.
        </p>
      )}

      {/* Desktop: tabela */}
      <div className="hidden max-h-[30rem] overflow-y-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-center font-semibold">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Bairro</th>
              <th className="px-3 py-2.5 text-left font-semibold">Motivo predominante</th>
              <th className="px-3 py-2.5 text-right font-semibold">Notas</th>
              <th className="px-3 py-2.5 text-right font-semibold">Devolvido</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
                  {busca ? `Nenhum bairro para "${busca}".` : "Sem devolução por bairro na RMR no período."}
                </td>
              </tr>
            ) : (
              lista.map((b, i) => (
                <tr key={`${b.cidade}|${b.bairro}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="max-w-[240px] truncate text-[#141a4d]">{b.bairro}</div>
                    <div className="text-[10px] text-slate-400">{b.cidade}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="max-w-[260px] truncate text-slate-600" title={b.motivo}>{b.motivo}</div>
                    <div className="text-[10px] tabular-nums text-slate-400">{formatBRL(b.motivoValor)}</div>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">{b.notas}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#141a4d]">{formatBRL(b.devolvido)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {lista.length === 0 ? (
          <li className="py-10 text-center text-sm text-slate-400">
            {busca ? `Nenhum bairro para "${busca}".` : "Sem devolução por bairro na RMR no período."}
          </li>
        ) : (
          lista.map((b, i) => (
            <li key={`${b.cidade}|${b.bairro}`} className="px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[#141a4d]">{b.bairro}</p>
                  <p className="text-[10px] text-slate-400">{b.cidade}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-semibold tabular-nums text-[#141a4d]">{formatBRL(b.devolvido)}</p>
                  <p className="text-[11px] tabular-nums text-slate-500">{b.notas} notas</p>
                </div>
              </div>
              <p className="mt-1.5 pl-[1.9rem] text-xs text-slate-500">
                <span className="text-slate-400">motivo:</span> {b.motivo}{" "}
                <span className="tabular-nums text-slate-400">({formatBRL(b.motivoValor)})</span>
              </p>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

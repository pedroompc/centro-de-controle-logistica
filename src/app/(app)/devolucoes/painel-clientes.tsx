"use client";

import { useState, useMemo } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { filtrarPorBusca } from "@/domain/devolucoes-ui";
import { formatBRL } from "@/domain/format";
import type { DevolucaoPorCliente } from "@/domain/devolucoes";
import { IconePredio, IconeBusca } from "./icons";

export default function PainelClientes({ clientes }: { clientes: DevolucaoPorCliente[] }) {
  const [busca, setBusca] = useState("");
  const lista = useMemo(
    () => filtrarPorBusca(clientes, busca, (c) => [c.nome, c.codcli]),
    [clientes, busca],
  );
  const maxNotas = Math.max(1, ...clientes.map((c) => c.notas));

  const campoBusca = (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <IconeBusca />
      </span>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar cliente…"
        aria-label="Buscar cliente"
        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50 sm:w-48"
      />
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconePredio />}
        title="Clientes que mais devolvem"
        context={`${lista.length} clientes · por nº de notas`}
        right={campoBusca}
      />
      {/* Desktop: tabela */}
      <div className="hidden max-h-[28rem] overflow-y-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-center font-semibold">#</th>
              <th className="px-3 py-2.5 text-left font-semibold">Cliente</th>
              <th className="min-w-[160px] px-3 py-2.5 text-right font-semibold">Notas</th>
              <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-sm text-slate-400">
                  {busca ? `Nenhum cliente para "${busca}".` : "Sem devoluções no período."}
                </td>
              </tr>
            ) : (
              lista.map((c, i) => (
                <tr key={c.codcli} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-400">{i + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="max-w-[280px] truncate text-[#141a4d]">{c.nome}</div>
                    <div className="text-[10px] text-slate-400">Cód. {c.codcli}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(c.notas / maxNotas) * 100}%` }} />
                      </div>
                      <span className="w-12 text-right font-semibold tabular-nums text-[#141a4d]">{c.notas}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#141a4d]">{formatBRL(c.valor)}</td>
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
            {busca ? `Nenhum cliente para "${busca}".` : "Sem devoluções no período."}
          </li>
        ) : (
          lista.map((c, i) => (
            <li key={c.codcli} className="flex items-center gap-2.5 px-4 py-3">
              <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-400">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[#141a4d]">{c.nome}</p>
                <p className="text-[10px] text-slate-400">Cód. {c.codcli}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums text-[#141a4d]">{formatBRL(c.valor)}</p>
                <p className="text-[11px] tabular-nums text-slate-500">{c.notas} notas</p>
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

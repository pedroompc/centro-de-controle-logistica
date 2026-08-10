"use client";

import { useState, useMemo } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { filtrarPorBusca, ordenarMotoristas, corTaxa } from "@/domain/devolucoes-ui";
import type { ColunaMotorista, Direcao } from "@/domain/devolucoes-ui";
import { formatBRL, formatPercent } from "@/domain/format";
import { piorMotorista } from "@/domain/devolucoes";
import type { DevolucaoPorMotorista } from "@/domain/devolucoes";
import { IconeCaminhao, IconeUsuario, IconeBusca, IconeChevronCima, IconeChevronBaixo } from "./icons";

type Sort = { col: ColunaMotorista; dir: Direcao };

function Th({
  col, rotulo, sort, onSort,
}: {
  col: ColunaMotorista; rotulo: string; sort: Sort; onSort: (c: ColunaMotorista) => void;
}) {
  const ativo = sort.col === col;
  return (
    <th
      onClick={() => onSort(col)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSort(col);
        }
      }}
      tabIndex={0}
      aria-sort={ativo ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className="cursor-pointer select-none px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
    >
      <span className="inline-flex items-center gap-1">
        {rotulo}
        {ativo ? (
          sort.dir === "asc" ? (
            <IconeChevronCima className="h-3 w-3 text-amber-500" />
          ) : (
            <IconeChevronBaixo className="h-3 w-3 text-amber-500" />
          )
        ) : (
          <IconeChevronBaixo className="h-3 w-3 opacity-20" />
        )}
      </span>
    </th>
  );
}

export default function TabelaMotoristas({ motoristas }: { motoristas: DevolucaoPorMotorista[] }) {
  const [busca, setBusca] = useState("");
  const [sort, setSort] = useState<Sort>({ col: "taxa", dir: "desc" });

  function onSort(col: ColunaMotorista) {
    setSort((p) => (p.col === col ? { col, dir: p.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" }));
  }

  const filtrados = useMemo(
    () => filtrarPorBusca(motoristas, busca, (m) => [m.nome, m.codMotorista]),
    [motoristas, busca],
  );
  const lista = useMemo(() => ordenarMotoristas(filtrados, sort.col, sort.dir), [filtrados, sort]);
  const pior = useMemo(() => piorMotorista(filtrados), [filtrados]);

  const campoBusca = (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <IconeBusca />
      </span>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar motorista…"
        aria-label="Buscar motorista"
        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50 sm:w-56"
      />
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconeCaminhao />}
        title="Taxa de devolução por motorista"
        context={`${lista.length} motoristas · ordene pelas colunas`}
        right={campoBusca}
      />
      {pior && (
        <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
          Maior taxa (com 50+ entregas):{" "}
          <span className="font-semibold text-rose-600">{pior.nome}</span> —{" "}
          {formatPercent(pior.taxa / 100)} ({pior.devolvidas} de {pior.expedidas}).
        </p>
      )}
      {/* Mobile: ordenação (as colunas clicáveis não existem no card) */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 md:hidden">
        <label className="text-xs font-medium text-slate-400">Ordenar por</label>
        <select
          value={sort.col}
          onChange={(e) => setSort({ col: e.target.value as ColunaMotorista, dir: "desc" })}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
        >
          <option value="taxa">Taxa de devolução</option>
          <option value="valorDevolvido">Valor devolvido</option>
          <option value="expedidas">Entregas</option>
          <option value="devolvidas">Devolvidas</option>
        </select>
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="w-10 px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">#</th>
              <th className="min-w-[180px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Motorista</th>
              <Th col="expedidas" rotulo="Entregas" sort={sort} onSort={onSort} />
              <Th col="devolvidas" rotulo="Devolvidas" sort={sort} onSort={onSort} />
              <Th col="taxa" rotulo="Taxa" sort={sort} onSort={onSort} />
              <Th col="valorDevolvido" rotulo="Valor devolvido" sort={sort} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-400">
                  {busca ? `Nenhum motorista para "${busca}".` : "Sem entregas em carga no período."}
                </td>
              </tr>
            ) : (
              lista.map((m, i) => (
                <tr key={m.codMotorista} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="px-3 py-3 text-center font-mono text-xs text-slate-400">{i + 1}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="shrink-0 rounded-lg bg-[#eef0fb] p-1.5 text-[#1b2168]">
                        <IconeUsuario />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium leading-none text-[#141a4d]">{m.nome}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">Cód. {m.codMotorista}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-500">{m.expedidas}</td>
                  <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-600">{m.devolvidas}</td>
                  <td className={`px-3 py-3 text-right text-base font-bold tabular-nums ${corTaxa(m.taxa)}`}>
                    {formatPercent(m.taxa / 100)}
                  </td>
                  <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#141a4d]">{formatBRL(m.valorDevolvido)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {lista.length === 0 ? (
          <li className="py-12 text-center text-sm text-slate-400">
            {busca ? `Nenhum motorista para "${busca}".` : "Sem entregas em carga no período."}
          </li>
        ) : (
          lista.map((m, i) => (
            <li key={m.codMotorista} className="px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-400">{i + 1}</span>
                <div className="shrink-0 rounded-lg bg-[#eef0fb] p-1.5 text-[#1b2168]">
                  <IconeUsuario />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium leading-tight text-[#141a4d]">{m.nome}</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Cód. {m.codMotorista}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-lg font-bold leading-none tabular-nums ${corTaxa(m.taxa)}`}>
                    {formatPercent(m.taxa / 100)}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">taxa</p>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4 pl-[3.25rem] text-xs text-slate-500">
                <span>
                  Entregas <b className="tabular-nums text-slate-700">{m.expedidas}</b>
                </span>
                <span>
                  Devolvidas <b className="tabular-nums text-slate-700">{m.devolvidas}</b>
                </span>
                <span className="ml-auto tabular-nums font-semibold text-[#141a4d]">
                  {formatBRL(m.valorDevolvido)}
                </span>
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

"use client";

import { useState, useMemo, Fragment, type ReactNode } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { filtrarPorBusca } from "@/domain/devolucoes-ui";
import { formatBRL } from "@/domain/format";
import type { MotivoDetalhe } from "@/domain/devolucoes";
import DetalheMotivos from "./detalhe-motivos";
import { IconeBusca, IconeChevronCima, IconeChevronBaixo } from "./icons";

export interface ItemRanking {
  cod: number;
  nome: string;
  notas: number;
  valor: number;
}

/**
 * Ranking genérico (cliente/vendedor) por nº de notas devolvidas, com busca por
 * nome/código e drill-down por motivo (clique numa linha abre a quebra).
 */
export default function PainelRanking({
  icon,
  tone = "navy",
  title,
  unidade,
  unidadePlural,
  buscaPlaceholder,
  itens,
  motivos,
}: {
  icon: ReactNode;
  tone?: "navy" | "gold";
  title: string;
  unidade: string; // singular, ex.: "cliente" / "vendedor"
  unidadePlural: string; // ex.: "clientes" / "vendedores"
  buscaPlaceholder: string;
  itens: ItemRanking[];
  motivos: Record<number, MotivoDetalhe[]>;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const lista = useMemo(
    () => filtrarPorBusca(itens, busca, (x) => [x.nome, x.cod]),
    [itens, busca],
  );
  const maxNotas = Math.max(1, ...itens.map((x) => x.notas));
  const lider = itens[0] ?? null; // query já ordena por nº de notas desc
  const temMotivos = (cod: number) => (motivos[cod]?.length ?? 0) > 0;
  const toggle = (cod: number) => setAberto((a) => (a === cod ? null : cod));

  const campoBusca = (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <IconeBusca />
      </span>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder={buscaPlaceholder}
        aria-label={buscaPlaceholder}
        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50 sm:w-56"
      />
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={icon}
        tone={tone}
        title={title}
        context={`${lista.length} ${unidadePlural} · clique para ver os motivos`}
        right={campoBusca}
      />
      {lider && (
        <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
          Quem mais volta:{" "}
          <span className="font-semibold text-[#141a4d]">{lider.nome}</span> —{" "}
          {lider.notas} notas ({formatBRL(lider.valor)}).
        </p>
      )}

      {/* Desktop: tabela */}
      <div className="hidden max-h-[30rem] overflow-y-auto md:block">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-2.5 text-center font-semibold">#</th>
              <th className="px-3 py-2.5 text-left font-semibold capitalize">{unidade}</th>
              <th className="min-w-[160px] px-3 py-2.5 text-right font-semibold">Notas</th>
              <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
              <th className="w-10 px-3 py-2.5" aria-label="Motivos" />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-10 text-center text-sm text-slate-400">
                  {busca ? `Nenhum ${unidade} para "${busca}".` : "Sem devoluções no período."}
                </td>
              </tr>
            ) : (
              lista.map((x, i) => {
                const expansivel = temMotivos(x.cod);
                const estaAberto = aberto === x.cod;
                return (
                  <Fragment key={x.cod}>
                    <tr
                      onClick={expansivel ? () => toggle(x.cod) : undefined}
                      aria-expanded={expansivel ? estaAberto : undefined}
                      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/50 ${estaAberto ? "bg-amber-50/40" : ""} ${expansivel ? "cursor-pointer" : ""}`}
                    >
                      <td className="px-3 py-2.5 text-center font-mono text-xs text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2.5">
                        <div className="max-w-[280px] truncate text-[#141a4d]">{x.nome}</div>
                        <div className="text-[10px] text-slate-400">Cód. {x.cod}</div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
                            <div className="h-full rounded-full bg-amber-400" style={{ width: `${(x.notas / maxNotas) * 100}%` }} />
                          </div>
                          <span className="w-12 text-right font-semibold tabular-nums text-[#141a4d]">{x.notas}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-[#141a4d]">{formatBRL(x.valor)}</td>
                      <td className="px-3 py-2.5 text-center text-slate-400">
                        {expansivel ? (
                          estaAberto ? <IconeChevronCima className="mx-auto h-4 w-4" /> : <IconeChevronBaixo className="mx-auto h-4 w-4" />
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                    </tr>
                    {estaAberto && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={5} className="p-0">
                          <DetalheMotivos motivos={motivos[x.cod] ?? []} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {lista.length === 0 ? (
          <li className="py-10 text-center text-sm text-slate-400">
            {busca ? `Nenhum ${unidade} para "${busca}".` : "Sem devoluções no período."}
          </li>
        ) : (
          lista.map((x, i) => {
            const expansivel = temMotivos(x.cod);
            const estaAberto = aberto === x.cod;
            return (
              <li key={x.cod} className={estaAberto ? "bg-amber-50/40" : ""}>
                <div
                  onClick={expansivel ? () => toggle(x.cod) : undefined}
                  className={`flex items-center gap-2.5 px-4 py-3 ${expansivel ? "cursor-pointer" : ""}`}
                >
                  <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[#141a4d]">{x.nome}</p>
                    <p className="text-[10px] text-slate-400">Cód. {x.cod}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-semibold tabular-nums text-[#141a4d]">{formatBRL(x.valor)}</p>
                    <p className="text-[11px] tabular-nums text-slate-500">{x.notas} notas</p>
                  </div>
                  {expansivel && (
                    estaAberto
                      ? <IconeChevronCima className="h-4 w-4 shrink-0 text-slate-400" />
                      : <IconeChevronBaixo className="h-4 w-4 shrink-0 text-slate-400" />
                  )}
                </div>
                {estaAberto && <DetalheMotivos motivos={motivos[x.cod] ?? []} />}
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}

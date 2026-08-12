"use client";

import { useState } from "react";
import {
  corDaEscala,
  valorMetrica,
  colorivel,
  tetoMetrica,
  topCidade,
  rankingMetrica,
  COR_NEUTRA,
  COR_RAMPA_MIN,
  COR_RAMPA_MAX,
} from "@/domain/devolucoes-mapa";
import type { CidadeDevolucao, Metrica } from "@/domain/devolucoes-mapa";
import { formatBRL, formatPercent } from "@/domain/format";

export interface MunicipioMapa {
  ibge: string;
  nome: string;
  d: string; // path SVG
  dados: CidadeDevolucao | null; // devolução da cidade, se houver
}

// Altura do viewBox impressa por scripts/gen-geo-pe.mjs (Task 2). Largura fixa 1000.
const VIEWBOX = "0 0 1000 341";

// Rótulo do valor de uma cidade, na métrica ativa.
const rotulo = (c: CidadeDevolucao, m: Metrica) =>
  m === "taxa" ? formatPercent(c.taxa) : formatBRL(c.devolvido);

export function MapaDevolucoes({
  municipios,
  cidades,
}: {
  municipios: MunicipioMapa[];
  cidades: CidadeDevolucao[]; // todas as cidades com dado (colorível ou não)
}) {
  const [metrica, setMetrica] = useState<Metrica>("valor");
  const [hover, setHover] = useState<MunicipioMapa | null>(null);
  const [selecionado, setSelecionado] = useState<string | null>(null);

  const teto = tetoMetrica(cidades, metrica);
  const ranking = rankingMetrica(cidades, metrica);
  const top = topCidade(cidades, metrica);
  const ativo = hover ? hover.dados : (cidades.find((c) => c.ibge === selecionado) ?? null);

  const legenda =
    metrica === "taxa" ? "volume baixo / sem dado" : "sem devolução / sem dado";

  return (
    <div>
      {/* Toggle da métrica + headline da líder */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs font-semibold">
          <button
            onClick={() => setMetrica("valor")}
            className={`rounded-md px-3 py-1.5 transition ${metrica === "valor" ? "bg-[#181d55] text-white" : "text-slate-500 hover:text-slate-700"}`}
          >
            Valor R$
          </button>
          <button
            onClick={() => setMetrica("taxa")}
            className={`rounded-md px-3 py-1.5 transition ${metrica === "taxa" ? "bg-[#181d55] text-white" : "text-slate-500 hover:text-slate-700"}`}
          >
            Taxa %
          </button>
        </div>
        {top && (
          <span className="text-xs text-slate-500">
            {metrica === "taxa" ? "Maior taxa" : "Maior volume"}:{" "}
            <strong className="text-rose-600">{top.cidade}</strong> · {rotulo(top, metrica)}
          </span>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="relative">
          <svg viewBox={VIEWBOX} className="h-auto w-full" role="img" aria-label="Mapa de devolução por cidade de Pernambuco">
            {municipios.map((m) => {
              const d = m.dados;
              const fill = d ? corDaEscala(valorMetrica(d, metrica), colorivel(d, metrica), teto) : COR_NEUTRA;
              const destaque = selecionado === m.ibge || hover?.ibge === m.ibge;
              return (
                <path
                  key={m.ibge}
                  d={m.d}
                  fill={fill}
                  stroke={destaque ? "#141a4d" : "#ffffff"}
                  strokeWidth={destaque ? 1.6 : 0.4}
                  onMouseEnter={() => setHover(m)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => m.dados && setSelecionado((s) => (s === m.ibge ? null : m.ibge))}
                  className="cursor-pointer transition-[stroke-width]"
                />
              );
            })}
          </svg>

          {ativo && (
            <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs shadow-md ring-1 ring-slate-200">
              <div className="font-semibold text-[#141a4d]">{ativo.cidade}</div>
              <div className="tabular-nums text-slate-600">
                devolvido {formatBRL(ativo.devolvido)} · taxa {formatPercent(ativo.taxa)}
              </div>
              <div className="tabular-nums text-slate-400">faturado {formatBRL(ativo.faturado)}</div>
            </div>
          )}

          <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-500">
            <span>menor</span>
            <div
              className="h-2 flex-1 rounded-full"
              style={{ backgroundImage: `linear-gradient(to right, ${COR_RAMPA_MIN}, ${COR_RAMPA_MAX})` }}
            />
            <span>maior</span>
            <span className="ml-2 inline-flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded-sm" style={{ background: COR_NEUTRA }} />
              {legenda}
            </span>
          </div>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold text-[#141a4d]">
            {metrica === "taxa" ? "Maiores taxas" : "Maiores volumes (R$)"}
          </h3>
          {ranking.length === 0 ? (
            <p className="text-sm text-slate-400">Sem cidades com devolução no período.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ranking.slice(0, 12).map((c) => {
                const on = selecionado === c.ibge;
                return (
                  <li key={c.ibge}>
                    <button
                      onClick={() => setSelecionado((s) => (s === c.ibge ? null : c.ibge))}
                      className={`flex w-full items-baseline justify-between gap-3 px-1 py-2 text-left transition ${on ? "bg-amber-50" : "hover:bg-slate-50"}`}
                    >
                      <span className="truncate text-sm text-[#141a4d]" title={c.cidade}>{c.cidade}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-rose-600">{rotulo(c, metrica)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

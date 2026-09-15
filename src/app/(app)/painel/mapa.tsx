"use client";

import { useEffect, useState } from "react";
import {
  corDaEscala,
  rankingMetrica,
  tetoMetrica,
  COR_NEUTRA,
  COR_RAMPA_MIN,
  COR_RAMPA_MAX,
} from "@/domain/devolucoes-mapa";
import type { CidadeDevolucao } from "@/domain/devolucoes-mapa";
import { formatBRL, formatPercent } from "@/domain/format";

// Mesmo viewBox impresso por scripts/gen-geo-pe.mjs usado no mapa interativo.
const VIEWBOX = "0 0 1000 341";

interface Geo {
  ibge: string;
  nome: string;
  d: string;
}

/**
 * Mapa de PE para o Modo TV: grande, sem interação, sempre na métrica de VALOR
 * (R$ devolvido) — a leitura de "onde está o volume" à distância. Reusa a
 * geometria carregada sob demanda e as funções puras do domínio do mapa.
 */
export default function TvMapa({ cidades }: { cidades: CidadeDevolucao[] }) {
  const [geo, setGeo] = useState<Geo[] | null>(null);

  useEffect(() => {
    let vivo = true;
    import("@/data/geo/pe-municipios.json").then((mod) => {
      if (!vivo) return;
      setGeo((mod.default ?? mod) as Geo[]);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const teto = tetoMetrica(cidades, "valor");
  const ranking = rankingMetrica(cidades, "valor");
  const totalDevolvido = cidades.reduce((s, c) => s + c.devolvido, 0);
  const porIbge = new Map(cidades.map((c) => [c.ibge, c]));

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="flex flex-col justify-center">
        {geo ? (
          <svg
            viewBox={VIEWBOX}
            className="h-auto w-full drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            role="img"
            aria-label="Mapa de devolução por cidade de Pernambuco"
          >
            {geo.map((g) => {
              const d = porIbge.get(g.ibge);
              const fill = d ? corDaEscala(d.devolvido, d.devolvido > 0, teto) : COR_NEUTRA;
              return <path key={g.ibge} d={g.d} fill={fill} stroke="#0a1650" strokeWidth={0.4} />;
            })}
          </svg>
        ) : (
          <p className="py-16 text-center text-lg text-white/40">Carregando mapa…</p>
        )}
        <div className="mt-4 flex items-center gap-3 text-sm text-white/60">
          <span>menos</span>
          <div
            className="h-2.5 flex-1 rounded-full"
            style={{ backgroundImage: `linear-gradient(to right, ${COR_RAMPA_MIN}, ${COR_RAMPA_MAX})` }}
          />
          <span>mais</span>
          <span className="ml-3 inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: COR_NEUTRA }} />
            sem devolução
          </span>
        </div>
      </div>

      <div className="flex flex-col justify-center">
        <div className="mb-4">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
            Total devolvido · PE
          </div>
          <div className="font-[family-name:var(--font-sora)] text-4xl font-extrabold tabular-nums text-rose-300 xl:text-5xl">
            {formatBRL(totalDevolvido)}
          </div>
        </div>
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
          Maiores volumes (R$)
        </div>
        <ul className="mt-2 divide-y divide-white/10">
          {ranking.slice(0, 8).map((c, i) => (
            <li key={c.ibge} className="flex items-center gap-3 py-2.5">
              <span className="w-6 shrink-0 text-center font-mono text-sm text-white/35">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate text-lg font-medium text-white xl:text-xl" title={c.cidade}>
                {c.cidade}
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-[family-name:var(--font-sora)] text-lg font-bold tabular-nums text-rose-300 xl:text-xl">
                  {formatBRL(c.devolvido)}
                </span>
                <span className="block text-xs tabular-nums text-white/40">taxa {formatPercent(c.taxa)}</span>
              </span>
            </li>
          ))}
          {ranking.length === 0 && (
            <li className="py-8 text-center text-white/40">Sem devolução por cidade no período.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

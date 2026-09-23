"use client";

import { useEffect, useState } from "react";
import {
  corDaEscala,
  rankingMetrica,
  tetoMetrica,
  totalMetrica,
  COR_NEUTRA,
  COR_RAMPA_MIN,
  COR_RAMPA_MAX,
} from "@/domain/devolucoes-mapa";
import type { CidadeDevolucao } from "@/domain/devolucoes-mapa";
import { formatPercent } from "@/domain/format";

// Mesmo viewBox impresso por scripts/gen-geo-pe.mjs usado no mapa interativo.
const VIEWBOX = "0 0 1000 341";

// Tempo que cada card de cidade fica no ar antes de passar para a próxima.
const CARD_MS = 4200;

interface Geo {
  ibge: string;
  nome: string;
  d: string;
}

/**
 * Mapa de PE para o Modo TV: grande, sem interação, sempre na métrica de VALOR
 * (R$ devolvido) — a leitura de "onde está o volume" à distância. Reusa a
 * geometria carregada sob demanda e as funções puras do domínio do mapa.
 *
 * Números em R$ não são expostos no card (decisão da diretoria: painel de
 * logística mostra %): por cidade exibimos a participação no faturamento geral,
 * a taxa de devolução e o motivo predominante. `faturamentoGeral` é a venda
 * faturada total do mês (denominador da participação).
 */
export default function TvMapa({ cidades, faturamentoGeral }: { cidades: CidadeDevolucao[]; faturamentoGeral: number }) {
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
  const taxaGeralPE = totalMetrica(cidades, "taxa"); // devolvido / faturado de PE
  // Faturado total de PE = soma das cidades. Numerador e denominador vêm da MESMA
  // fonte, então o "peso em PE" de todas as cidades soma exatamente 100%.
  const totalFaturadoPE = cidades.reduce((s, c) => s + c.faturado, 0);
  const porIbge = new Map(cidades.map((c) => [c.ibge, c]));

  // Card rotativo: passa por cada cidade (maior volume → menor), uma a cada
  // CARD_MS, em loop. A cidade em foco também acende no mapa. Passar o mouse
  // numa cidade PAUSA a rotação e mostra essa cidade no card do lado.
  const [idx, setIdx] = useState(0);
  const [hoverIbge, setHoverIbge] = useState<string | null>(null);
  useEffect(() => {
    if (ranking.length <= 1 || hoverIbge) return;
    const t = setInterval(() => setIdx((i) => i + 1), CARD_MS);
    return () => clearInterval(t);
  }, [ranking.length, hoverIbge]);

  const cidadeAtual = ranking.length > 0 ? ranking[idx % ranking.length] : null;
  const hovered = hoverIbge ? porIbge.get(hoverIbge) ?? null : null;
  const exibida = hovered ?? cidadeAtual; // hover manda; senão a da rotação
  const focoIbge = hovered ? hovered.ibge : cidadeAtual?.ibge ?? null;

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
              const foco = focoIbge === g.ibge;
              return (
                <path
                  key={g.ibge}
                  d={g.d}
                  fill={fill}
                  stroke={foco ? "#ffffff" : "#0a1650"}
                  strokeWidth={foco ? 2 : 0.4}
                  onMouseEnter={() => setHoverIbge(g.ibge)}
                  onMouseLeave={() => setHoverIbge((h) => (h === g.ibge ? null : h))}
                  className="cursor-pointer transition-[stroke-width]"
                  style={foco ? { filter: "drop-shadow(0 0 6px rgba(255,255,255,0.7))" } : undefined}
                />
              );
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

      <div className="flex min-h-0 flex-col justify-center">
        <div className="mb-4 shrink-0">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-white/45">
            Taxa de devolução · PE
          </div>
          <div className="font-[family-name:var(--font-sora)] text-4xl font-extrabold tabular-nums text-rose-300 xl:text-5xl">
            {formatPercent(taxaGeralPE)}
          </div>
        </div>

        {exibida ? (
          // Card da cidade em foco (sob o cursor, ou a da rotação automática).
          <div key={exibida.ibge} className="card-fade rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/10 xl:p-7">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                {hovered ? "sob o cursor" : `Cidade ${(idx % ranking.length) + 1} de ${ranking.length}`}
              </div>
              <div className="text-xs tabular-nums text-white/35">por volume</div>
            </div>
            <div className="mt-1 truncate font-[family-name:var(--font-sora)] text-3xl font-extrabold text-white xl:text-4xl" title={exibida.cidade}>
              {exibida.cidade}
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-3">
                <span className="text-sm uppercase tracking-wide text-white/50">Peso em Pernambuco</span>
                <span className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tabular-nums text-white xl:text-4xl">
                  {formatPercent(totalFaturadoPE > 0 ? exibida.faturado / totalFaturadoPE : 0)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-3">
                <span className="text-sm uppercase tracking-wide text-white/50">Do faturamento geral</span>
                <span className="font-[family-name:var(--font-sora)] text-2xl font-bold tabular-nums text-white/80 xl:text-3xl">
                  {formatPercent(faturamentoGeral > 0 ? exibida.faturado / faturamentoGeral : 0)}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-3">
                <span className="text-sm uppercase tracking-wide text-white/50">Taxa de devolução</span>
                <span className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tabular-nums text-rose-300 xl:text-4xl">{formatPercent(exibida.taxa)}</span>
              </div>
              <div>
                <div className="text-sm uppercase tracking-wide text-white/50">Motivo predominante</div>
                <div className="mt-1 min-w-0 truncate text-xl font-semibold text-amber-200 xl:text-2xl" title={exibida.motivo}>{exibida.motivo}</div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/40">Sem devolução por cidade no período.</p>
        )}
      </div>

      <style>{`
        @keyframes cardFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .card-fade { animation: cardFade 0.45s ease-out both; }
      `}</style>
    </div>
  );
}

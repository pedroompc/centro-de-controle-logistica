"use client";

import { useEffect, useState } from "react";
import { corDaEscala, COR_NEUTRA, COR_RAMPA_MIN, COR_RAMPA_MAX } from "@/domain/devolucoes-mapa";
import type { CidadeDevolucao, BairroDevolucao } from "@/domain/devolucoes-mapa";
import { classificarRegiao } from "@/domain/pe-regioes";
import { formatPercent } from "@/domain/format";

const CARD_MS = 4200; // tempo de cada card de bairro

interface Geo {
  ibge: string;
  nome: string;
  d: string;
}

const inteiro = new Intl.NumberFormat("pt-BR");

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

// Caixa que envolve os traçados da RMR — vira o viewBox (zoom na região).
function calcularViewBox(paths: Geo[]): string {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const re = /-?\d+(?:\.\d+)?/g;
  for (const p of paths) {
    const nums = p.d.match(re)?.map(Number) ?? [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i], y = nums[i + 1];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return "0 0 1000 341";
  const pad = Math.max((maxX - minX), (maxY - minY)) * 0.04;
  return `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`;
}

/**
 * Mapa apenas da RMR (recorte da geometria de PE, com zoom). Colore os
 * municípios por R$ devolvido (mesma base do mapa de PE) e passa um card por
 * BAIRRO ao lado, mostrando notas entregues / devolvidas e o motivo
 * predominante. O município do bairro em foco acende no mapa. Passar o mouse
 * num município PAUSA a rotação e mostra o card da cidade (igual ao mapa de PE).
 */
export default function MapaRMR({ cidades, bairros }: { cidades: CidadeDevolucao[]; bairros: BairroDevolucao[] }) {
  const [geo, setGeo] = useState<Geo[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [hoverIbge, setHoverIbge] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    import("@/data/geo/pe-municipios.json").then((mod) => {
      if (!vivo) return;
      const todos = (mod.default ?? mod) as Geo[];
      setGeo(todos.filter((g) => classificarRegiao(g.nome, "PE") === "RMR"));
    });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    if (bairros.length <= 1 || hoverIbge) return;
    const t = setInterval(() => setIdx((i) => i + 1), CARD_MS);
    return () => clearInterval(t);
  }, [bairros.length, hoverIbge]);

  const porIbge = new Map(cidades.map((c) => [c.ibge, c]));
  const teto = geo
    ? geo.reduce((m, g) => Math.max(m, porIbge.get(g.ibge)?.devolvido ?? 0), 0)
    : 0;
  const bairro = bairros.length > 0 ? bairros[idx % bairros.length] : null;
  const hovered = hoverIbge ? porIbge.get(hoverIbge) ?? null : null; // hover manda; senão o bairro da rotação
  const ibgeFoco = hovered
    ? hovered.ibge
    : geo?.find((g) => norm(g.nome) === norm(bairro?.cidade ?? ""))?.ibge;

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="flex min-h-0 flex-col justify-center">
        {geo ? (
          <svg viewBox={calcularViewBox(geo)} className="h-full max-h-full w-full drop-shadow-[0_8px_24px_rgba(0,0,0,0.35)]" role="img" aria-label="Mapa de devolução da Região Metropolitana do Recife">
            {geo.map((g) => {
              const d = porIbge.get(g.ibge);
              const fill = d ? corDaEscala(d.devolvido, d.devolvido > 0, teto) : COR_NEUTRA;
              const foco = ibgeFoco === g.ibge;
              return (
                <path
                  key={g.ibge}
                  d={g.d}
                  fill={fill}
                  stroke={foco ? "#ffffff" : "#0a1650"}
                  strokeWidth={foco ? 1.4 : 0.5}
                  onMouseEnter={() => setHoverIbge(g.ibge)}
                  onMouseLeave={() => setHoverIbge((h) => (h === g.ibge ? null : h))}
                  className="cursor-pointer transition-[stroke-width]"
                  style={foco ? { filter: "drop-shadow(0 0 5px rgba(255,255,255,0.7))" } : undefined}
                />
              );
            })}
          </svg>
        ) : (
          <p className="py-16 text-center text-lg text-white/40">Carregando mapa…</p>
        )}
        <div className="mt-3 flex items-center gap-3 text-sm text-white/60">
          <span>menos</span>
          <div className="h-2.5 flex-1 rounded-full" style={{ backgroundImage: `linear-gradient(to right, ${COR_RAMPA_MIN}, ${COR_RAMPA_MAX})` }} />
          <span>mais</span>
        </div>
      </div>

      <div className="flex min-h-0 flex-col justify-center">
        {hovered ? (
          // Card do município sob o cursor.
          <div key={`cidade|${hovered.ibge}`} className="card-fade rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/10 xl:p-7">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">sob o cursor</div>
            <div className="mt-1 truncate font-[family-name:var(--font-sora)] text-3xl font-extrabold text-white xl:text-4xl" title={hovered.cidade}>
              {hovered.cidade}
            </div>

            <div className="mt-6 space-y-4">
              <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-3">
                <span className="text-sm uppercase tracking-wide text-white/50">Notas entregues / devolvidas</span>
                <NotasPar entregues={hovered.notasEntregues} devolvidas={hovered.notasDevolvidas} />
              </div>
              <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-3">
                <span className="text-sm uppercase tracking-wide text-white/50">Taxa de devolução</span>
                <span className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tabular-nums text-rose-300 xl:text-4xl">{formatPercent(hovered.taxa)}</span>
              </div>
              <div>
                <div className="text-sm uppercase tracking-wide text-white/50">Motivo predominante</div>
                <div className="mt-1 min-w-0 truncate text-xl font-semibold text-amber-200 xl:text-2xl" title={hovered.motivo}>{hovered.motivo}</div>
              </div>
            </div>
          </div>
        ) : bairro ? (
          <div key={`${bairro.cidade}|${bairro.bairro}`} className="card-fade rounded-2xl bg-white/[0.06] p-6 ring-1 ring-white/10 xl:p-7">
            <div className="flex items-baseline justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
                Bairro {(idx % bairros.length) + 1} de {bairros.length}
              </div>
              <div className="text-xs tabular-nums text-white/35">por devolução</div>
            </div>
            <div className="mt-1 truncate font-[family-name:var(--font-sora)] text-3xl font-extrabold text-white xl:text-4xl" title={bairro.bairro}>
              {bairro.bairro}
            </div>
            <div className="text-sm text-white/45">{bairro.cidade}</div>

            <div className="mt-6 space-y-4">
              <div className="flex items-baseline justify-between gap-3 border-b border-white/10 pb-3">
                <span className="text-sm uppercase tracking-wide text-white/50">Notas entregues / devolvidas</span>
                <NotasPar entregues={bairro.notasFaturadas} devolvidas={bairro.notas} />
              </div>
              <div>
                <div className="text-sm uppercase tracking-wide text-white/50">Motivo predominante</div>
                <div className="mt-1 min-w-0 truncate text-xl font-semibold text-amber-200 xl:text-2xl" title={bairro.motivo}>{bairro.motivo}</div>
              </div>
            </div>
          </div>
        ) : (
          <p className="text-white/40">Sem devolução por bairro na RMR no período.</p>
        )}
      </div>

      <style>{`
        @keyframes cardFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .card-fade { animation: cardFade 0.45s ease-out both; }
      `}</style>
    </div>
  );
}

/** "entregues / devolvidas" — devolvidas em rosa, como no mapa de PE. */
function NotasPar({ entregues, devolvidas }: { entregues: number; devolvidas: number }) {
  return (
    <span className="font-[family-name:var(--font-sora)] text-3xl font-extrabold tabular-nums text-white xl:text-4xl">
      {inteiro.format(entregues)}
      <span className="text-white/40"> / </span>
      <span className="text-rose-300">{inteiro.format(devolvidas)}</span>
    </span>
  );
}

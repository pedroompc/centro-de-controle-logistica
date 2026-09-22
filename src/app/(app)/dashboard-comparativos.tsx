"use client";

import { useState } from "react";

// Regra de identidade do site: variação boa/neutra fica slate; só a ruim ganha
// cor (rose). Verde nunca (reservado a receita). A direção vem da seta.
const COR_POS = "#64748b"; // slate-500
const COR_NEG = "#e11d48"; // rose-600

export interface SerieMes {
  rotulo: string;
  display: string;
  sub?: string; // linha secundária (ex.: "78 pes.")
  deltaTexto: string | null;
  deltaSubindo: boolean;
  deltaPositivo: boolean;
}

export interface LinhaComparativa {
  chave: string;
  label: string;
  valorDisplay: string;
  sub?: string; // chip à direita (ex.: pessoas)
  barra?: number; // 0..1 (largura da barra); ausente = sem barra
  deltaTexto: string | null; // vs mês anterior; null = sem base
  deltaSubindo: boolean;
  deltaPositivo: boolean;
  serie: SerieMes[]; // drill-down mês a mês (mais antigo → mais novo)
  destaque?: boolean; // linha em destaque (ex.: Total)
}

function Seta({ subindo }: { subindo: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
      {subindo ? <path d="M8 13V3M8 3l-4 4M8 3l4 4" /> : <path d="M8 3v10M8 13l-4-4M8 13l4-4" />}
    </svg>
  );
}

function DeltaBadge({ texto, subindo, positivo }: { texto: string | null; subindo: boolean; positivo: boolean }) {
  if (!texto) return <span className="text-xs text-slate-300" title="sem mês anterior para comparar">—</span>;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums" style={{ color: positivo ? COR_POS : COR_NEG }}>
      <Seta subindo={subindo} />
      {texto}
    </span>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#eef0fb] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#1b2168]">
      <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
      </svg>
      {children}
    </span>
  );
}

function Chevron({ aberto }: { aberto: boolean }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${aberto ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m4 6 4 4 4-4" />
    </svg>
  );
}

/**
 * Lista comparativa: cada item mostra o valor do mês, a variação vs o mês
 * anterior e, ao clicar, abre uma seção com o item mês a mês. Uma linha aberta
 * por vez (acordeão).
 */
export function ListaComparativa({ linhas, tone = "gold" }: { linhas: LinhaComparativa[]; tone?: "gold" | "navy" }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const barCor = tone === "gold" ? "bg-amber-400" : "bg-[#2a327f]";

  if (linhas.length === 0) return <p className="text-sm text-slate-400">Sem dados para exibir.</p>;

  return (
    <ul className="space-y-1.5">
      {linhas.map((l) => {
        const estaAberto = aberto === l.chave;
        return (
          <li key={l.chave} className={l.destaque ? "border-t border-slate-100 pt-2" : ""}>
            <button
              type="button"
              onClick={() => setAberto((a) => (a === l.chave ? null : l.chave))}
              className="flex w-full items-center gap-3 rounded-lg px-1 py-1.5 text-left transition hover:bg-slate-50"
              aria-expanded={estaAberto}
            >
              <span className={`w-24 shrink-0 truncate text-sm sm:w-36 ${l.destaque ? "font-semibold text-[#141a4d]" : "text-slate-600"}`} title={l.label}>
                {l.label}
              </span>
              {l.barra != null ? (
                <span className="hidden h-5 min-w-0 flex-1 overflow-hidden rounded-md bg-slate-100 sm:block">
                  <span className={`block h-full rounded-md ${barCor}`} style={{ width: `${Math.max(2, Math.round(l.barra * 100))}%` }} />
                </span>
              ) : (
                <span className="hidden flex-1 sm:block" />
              )}
              <span className={`ml-auto shrink-0 text-right text-sm tabular-nums sm:ml-0 sm:w-28 ${l.destaque ? "font-extrabold text-[#141a4d]" : "font-semibold text-[#141a4d]"}`}>
                {l.valorDisplay}
              </span>
              {l.sub != null && <span className="hidden shrink-0 sm:inline-flex"><Chip>{l.sub}</Chip></span>}
              <span className="w-20 shrink-0 text-right">
                <DeltaBadge texto={l.deltaTexto} subindo={l.deltaSubindo} positivo={l.deltaPositivo} />
              </span>
              <Chevron aberto={estaAberto} />
            </button>

            {estaAberto && (
              <div className="mx-1 mb-1 mt-1 rounded-lg bg-slate-50 p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {l.label} · mês a mês
                </div>
                <ul className="divide-y divide-slate-100">
                  {[...l.serie].reverse().map((s) => (
                    <li key={s.rotulo} className="flex items-center gap-3 py-1.5">
                      <span className="w-14 shrink-0 text-xs font-medium text-slate-500">{s.rotulo}</span>
                      <span className="flex-1 text-sm font-semibold tabular-nums text-[#141a4d]">
                        {s.display}
                        {s.sub && <span className="ml-2 text-xs font-normal text-slate-400">{s.sub}</span>}
                      </span>
                      <span className="w-20 shrink-0 text-right">
                        <DeltaBadge texto={s.deltaTexto} subindo={s.deltaSubindo} positivo={s.deltaPositivo} />
                      </span>
                    </li>
                  ))}
                </ul>
                {l.serie.length <= 1 && (
                  <p className="mt-2 text-xs text-slate-400">Ainda sem mês anterior para comparar — o histórico cresce a cada mês.</p>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

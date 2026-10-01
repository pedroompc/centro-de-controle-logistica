"use client";

/**
 * Peças de BI das abas do Recebimento: gráficos com hover (tooltip) e clique,
 * chips de filtro e controle segmentado. Sem biblioteca de gráfico — divs e SVG
 * com a mesma linguagem visual do site (navy, âmbar; verde = melhor).
 */
import { useState, type ReactNode } from "react";

// --- Controles ---------------------------------------------------------------

export function Chip({ ativo, onClick, children, title }: { ativo: boolean; onClick: () => void; children: ReactNode; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-pressed={ativo}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        ativo ? "bg-[#141a4d] text-white shadow-sm" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

export function Segmentado<T extends string | number>({ opcoes, valor, onChange }: { opcoes: { valor: T; rotulo: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
      {opcoes.map((o) => (
        <button
          key={String(o.valor)}
          type="button"
          onClick={() => onChange(o.valor)}
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            o.valor === valor ? "bg-white text-[#141a4d] shadow-sm ring-1 ring-slate-200" : "text-slate-500 hover:text-[#141a4d]"
          }`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Rótulo pequeno de bloco de filtro. */
export function RotuloFiltro({ children }: { children: ReactNode }) {
  return <span className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-slate-400">{children}</span>;
}

function Tooltip({ esquerda, children }: { esquerda: number; children: ReactNode }) {
  // Prende o tooltip dentro do gráfico nas pontas.
  const x = Math.min(88, Math.max(12, esquerda));
  return (
    <div
      className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 -translate-y-[calc(100%+6px)] whitespace-nowrap rounded-lg bg-[#141a4d] px-3 py-2 text-xs text-white shadow-lg"
      style={{ left: `${x}%` }}
    >
      {children}
    </div>
  );
}

// --- Barras ------------------------------------------------------------------

export interface ItemBarra {
  chave: string;
  rotulo: string; // embaixo da barra
  valor: number | null;
  detalhe?: string; // linha extra no tooltip
  melhor?: boolean; // verde
  parcial?: boolean; // hachurado (mês em andamento)
  cor?: string; // sobrepõe a cor da barra (ex.: dia forte em âmbar)
}

/**
 * Barras verticais com tooltip no hover e seleção no clique. `referencia`
 * desenha uma linha tracejada (ex.: média, dia forte).
 */
export function GraficoBarras({
  itens,
  fmt,
  altura = 220,
  selecionado,
  onSelect,
  referencia,
  rotuloValor = true,
  cor = "#2a327f",
}: {
  itens: ItemBarra[];
  fmt: (v: number) => string;
  altura?: number;
  selecionado?: string | null;
  onSelect?: (chave: string) => void;
  referencia?: { valor: number; rotulo: string };
  rotuloValor?: boolean;
  cor?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const valores = itens.map((i) => i.valor ?? 0);
  const max = Math.max(1e-9, ...valores.map(Math.abs), referencia?.valor ?? 0) * 1.08;
  const denso = itens.length > 16;
  return (
    <div className="relative" style={{ height: altura }} onMouseLeave={() => setHover(null)}>
      {hover !== null && itens[hover] && (
        <Tooltip esquerda={((hover + 0.5) / itens.length) * 100}>
          <div className="font-semibold">{itens[hover].rotulo}</div>
          <div className="text-amber-300">{itens[hover].valor === null ? "sem dado" : fmt(itens[hover].valor!)}</div>
          {itens[hover].detalhe && <div className="text-white/60">{itens[hover].detalhe}</div>}
        </Tooltip>
      )}
      <div className="absolute inset-x-0 bottom-6 top-0">
        {referencia && referencia.valor > 0 && (
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-amber-400" style={{ bottom: `${(referencia.valor / max) * 100}%` }}>
            <span className="absolute -top-5 right-0 rounded bg-amber-50 px-1.5 text-[0.65rem] font-semibold text-amber-700">
              {referencia.rotulo}: {fmt(referencia.valor)}
            </span>
          </div>
        )}
        <div className={`flex h-full items-end ${denso ? "gap-[3px]" : "gap-3"}`}>
          {itens.map((it, i) => {
            const v = it.valor ?? 0;
            const sel = selecionado === it.chave;
            const fundo = it.melhor ? "#10b981" : (it.cor ?? cor);
            return (
              <button
                key={it.chave}
                type="button"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onClick={() => onSelect?.(it.chave)}
                className={`group relative flex h-full flex-1 flex-col items-center justify-end ${onSelect ? "cursor-pointer" : "cursor-default"}`}
                aria-label={`${it.rotulo}: ${it.valor === null ? "sem dado" : fmt(it.valor)}`}
              >
                {rotuloValor && !denso && it.valor !== null && (
                  <span className={`mb-1 text-xs font-bold tabular-nums ${it.melhor ? "text-emerald-600" : "text-[#141a4d]"}`}>{fmt(it.valor)}</span>
                )}
                <div
                  className={`w-full rounded-t-md transition ${hover === i ? "brightness-110" : ""} ${sel ? "ring-2 ring-amber-400 ring-offset-2" : ""}`}
                  style={{
                    height: `${Math.max(1.5, (Math.abs(v) / max) * 100)}%`,
                    background: it.parcial
                      ? `repeating-linear-gradient(135deg, ${fundo}, ${fundo} 5px, ${fundo}99 5px, ${fundo}99 10px)`
                      : v < 0
                        ? "#e11d48"
                        : fundo,
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className={`absolute inset-x-0 bottom-0 flex h-5 ${denso ? "gap-[3px]" : "gap-3"}`}>
        {itens.map((it, i) => (
          <span key={it.chave} className={`flex-1 whitespace-nowrap text-center text-[0.65rem] font-semibold ${denso ? "overflow-visible" : "truncate"} ${selecionado === it.chave ? "text-[#141a4d]" : "text-slate-400"}`}>
            {denso && i % Math.ceil(itens.length / 12) !== 0 ? "" : it.rotulo}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Linhas ------------------------------------------------------------------

export interface SerieLinha {
  nome: string;
  cor: string;
  valores: (number | null)[];
  tracejada?: boolean;
}

/**
 * Linhas no mesmo eixo (mesma unidade), com crosshair e tooltip mostrando todas
 * as séries no ponto. Legenda sempre visível.
 */
export function GraficoLinhas({ rotulos, series, fmt, altura = 240 }: { rotulos: string[]; series: SerieLinha[]; fmt: (v: number) => string; altura?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const todos = series.flatMap((s) => s.valores.filter((v): v is number => v !== null));
  const min = Math.min(0, ...todos);
  const max = Math.max(1e-9, ...todos);
  const pad = (max - min) * 0.08;
  const lo = min < 0 ? min - pad : 0;
  const hi = max + pad;
  const W = 1000;
  const H = 1000;
  const x = (i: number) => (rotulos.length <= 1 ? W / 2 : (i / (rotulos.length - 1)) * W);
  const y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
  const grades = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + (hi - lo) * f);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4">
        {series.map((s) => (
          <span key={s.nome} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="h-0.5 w-5 rounded" style={{ background: s.cor, borderTop: s.tracejada ? `2px dashed ${s.cor}` : undefined }} />
            {s.nome}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="relative w-20 shrink-0" style={{ height: altura }}>
          {grades.map((g) => (
            <span key={g} className="absolute right-0 -translate-y-1/2 text-[0.65rem] tabular-nums text-slate-400" style={{ top: `${(y(g) / H) * 100}%` }}>
              {fmt(g)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height: altura }} onMouseLeave={() => setHover(null)}>
          {hover !== null && (
            <Tooltip esquerda={(x(hover) / W) * 100}>
              <div className="mb-1 font-semibold">{rotulos[hover]}</div>
              {series.map((s) => (
                <div key={s.nome} className="flex items-center justify-between gap-4">
                  <span className="inline-flex items-center gap-1.5 text-white/70">
                    <span className="h-2 w-2 rounded-full" style={{ background: s.cor }} />
                    {s.nome}
                  </span>
                  <span className="font-semibold tabular-nums">{s.valores[hover] === null ? "—" : fmt(s.valores[hover]!)}</span>
                </div>
              ))}
            </Tooltip>
          )}
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
            {grades.map((g) => (
              <line key={g} x1={0} x2={W} y1={y(g)} y2={y(g)} stroke={g === 0 ? "#94a3b8" : "#e2e8f0"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />}
            {series.map((s) => {
              const pts = s.valores.map((v, i) => (v === null ? null : `${x(i)},${y(v)}`)).filter(Boolean).join(" ");
              return (
                <polyline
                  key={s.nome}
                  points={pts}
                  fill="none"
                  stroke={s.cor}
                  strokeWidth={2.5}
                  strokeDasharray={s.tracejada ? "6 5" : undefined}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>
          {/* Pontos no hover (HTML para não deformar com o viewBox) */}
          {hover !== null &&
            series.map((s) =>
              s.valores[hover] === null ? null : (
                <span
                  key={s.nome}
                  className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white"
                  style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(s.valores[hover]!) / H) * 100}%`, background: s.cor }}
                />
              ),
            )}
          {/* Faixas de hover: uma por ponto */}
          <div className="absolute inset-0 flex">
            {rotulos.map((r, i) => (
              <div key={r + i} className="h-full flex-1" onMouseEnter={() => setHover(i)} />
            ))}
          </div>
        </div>
      </div>
      <div className="ml-[5.5rem] mt-1 flex justify-between text-[0.65rem] font-semibold text-slate-400">
        {rotulos.map((r, i) => (
          <span key={r + i} className={rotulos.length > 12 && i % 2 ? "invisible" : ""}>
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Mini sparkline (barras) -------------------------------------------------

export function Faisca({ valores, melhores }: { valores: (number | null)[]; melhores?: Set<number> }) {
  const max = Math.max(1e-9, ...valores.map((v) => Math.abs(v ?? 0)));
  return (
    <div className="flex h-8 items-end gap-1" aria-hidden>
      {valores.map((v, i) => (
        <div
          key={i}
          className={`w-2.5 rounded-sm ${melhores?.has(i) ? "bg-emerald-500" : "bg-slate-300"}`}
          style={{ height: `${v === null ? 6 : Math.max(10, (Math.abs(v) / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Cores validadas no validador da skill dataviz contra a superfície escura do BI
// (#1c2163): linha âmbar, piora rose, melhora neutra (sem verde — regra do site).
const COR_LINHA = "#c2820a";
const COR_RUIM = "#e05a74";
const COR_BOA = "#7f8bd6";

export interface SerieEvolucao {
  nome: string;
  rotulos: string[]; // "Out/26"
  valores: number[];
  textos: string[]; // valores formatados
  parcial: boolean[]; // mês aberto: ponto vazado
  hrefs?: (string | null)[]; // clicar no mês leva o BI para ele
}

const W = 320, H = 132;
const PAD_L = 8, PAD_R = 8, PAD_T = 12, PAD_B = 20;
const PW = W - PAD_L - PAD_R, PH = H - PAD_T - PAD_B;

/** Um painel por indicador, cada um na própria escala (nunca dois eixos). */
export function PainelEvolucao({ s }: { s: SerieEvolucao }) {
  const [hover, setHover] = useState<number | null>(null);
  const router = useRouter();
  const n = s.valores.length;
  const ultimo = n - 1;
  const foco = hover ?? ultimo;
  const min = Math.min(...s.valores), max = Math.max(...s.valores);
  const span = max - min || Math.abs(max) || 1;
  const x = (i: number) => PAD_L + (n === 1 ? PW / 2 : (i * PW) / (n - 1));
  const y = (v: number) => PAD_T + PH - ((v - min) / span) * PH * 0.8 - PH * 0.1;
  // Linha cheia entre meses fechados; tracejada até o mês aberto.
  const fechados = s.parcial[ultimo] ? n - 1 : n;
  const caminho = (de: number, ate: number) =>
    s.valores.slice(de, ate).map((v, k) => `${k ? "L" : "M"}${x(de + k).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");

  return (
    <div className="entrar rounded-2xl bg-white/[0.06] px-4 pb-3 pt-3.5 ring-1 ring-white/10" onMouseLeave={() => setHover(null)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-white/50">{s.nome}</span>
        <span className="whitespace-nowrap text-[0.7rem] text-white/40">
          {s.rotulos[foco]}{s.parcial[foco] ? " · parcial" : ""}
        </span>
      </div>
      <div className="mt-0.5 font-[family-name:var(--font-sora)] text-lg font-extrabold tabular-nums text-white">{s.textos[foco] ?? "—"}</div>
      {n === 0 ? (
        <p className="py-8 text-center text-xs text-white/30">sem histórico</p>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full select-none" role="img"
          aria-label={`${s.nome}: ${s.rotulos.map((r, i) => `${r} ${s.textos[i]}`).join(", ")}`}>
          <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + PH} y2={PAD_T + PH} stroke="rgba(255,255,255,0.08)" />
          {fechados > 1 && <path d={caminho(0, fechados)} pathLength={1} className="desenhar" fill="none" stroke={COR_LINHA} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
          {fechados < n && n > 1 && (
            <path d={caminho(n - 2, n)} fill="none" stroke={COR_LINHA} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" />
          )}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD_T} y2={PAD_T + PH} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 3" />}
          <circle cx={x(foco)} cy={y(s.valores[foco])} r="4.5"
            fill={s.parcial[foco] ? "#1c2163" : COR_LINHA} stroke={s.parcial[foco] ? COR_LINHA : "#1c2163"} strokeWidth="2" />
          <text x={PAD_L} y={H - 5} fontSize="10" fill="rgba(255,255,255,0.4)">{s.rotulos[0]}</text>
          {n > 1 && <text x={W - PAD_R} y={H - 5} textAnchor="end" fontSize="10" fill="rgba(255,255,255,0.4)">{s.rotulos[ultimo]}</text>}
          {s.rotulos.map((r, i) => {
            const passo = n > 1 ? PW / (n - 1) : PW;
            const esq = Math.max(PAD_L, x(i) - passo / 2), dir = Math.min(PAD_L + PW, x(i) + passo / 2);
            return (
              <rect key={i} x={esq} y={0} width={dir - esq} height={H} fill="transparent" onMouseEnter={() => setHover(i)}
                className={s.hrefs?.[i] ? "cursor-pointer" : undefined}
                onClick={() => { const h = s.hrefs?.[i]; if (h) router.push(h); }}>
                <title>{`${r}: ${s.textos[i]}${s.parcial[i] ? " (parcial)" : ""}${s.hrefs?.[i] ? " · clique para abrir o mês" : ""}`}</title>
              </rect>
            );
          })}
        </svg>
      )}
    </div>
  );
}

export interface LinhaPlacarTela {
  grupo: string; // nome do setor
  rotulo: string;
  pct: number;
  texto: string;
  positivo: boolean;
  href: string | null; // abre o BI do setor no quadro daquele número
}

/**
 * Placar: variação relativa de cada indicador de setor contra o período de
 * comparação, em barras a partir do zero. Escala travada em ±100% (o que passar
 * disso encosta na borda — o número ao lado continua exato).
 */
export function Placar({ linhas, rotuloBase }: { linhas: LinhaPlacarTela[]; rotuloBase: string }) {
  const router = useRouter();
  const teto = Math.min(100, Math.max(10, ...linhas.map((l) => Math.abs(l.pct))));
  return (
    <div className="entrar rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/10">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.16em] text-amber-300">Placar dos setores</span>
        <span className="flex items-center gap-3 text-xs text-white/45">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_BOA }} />melhorou</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_RUIM }} />piorou</span>
          <span>{rotuloBase}</span>
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4.5rem] items-center gap-x-3 gap-y-1.5 text-sm">
        {linhas.map((l, i) => {
          const novo = i === 0 || l.grupo !== linhas[i - 1].grupo;
          const larg = (Math.min(Math.abs(l.pct), teto) / teto) * 50;
          return (
            <div key={i} className="contents">
              {novo && (
                <span className={`col-span-3 text-[0.65rem] font-bold uppercase tracking-[0.14em] text-white/35 ${i > 0 ? "mt-2" : ""}`}>{l.grupo}</span>
              )}
              {l.href ? (
                <Link href={l.href} className="truncate text-white/60 underline-offset-4 hover:text-amber-300 hover:underline" title={`${l.grupo} · ${l.rotulo} — abrir no BI do setor`}>{l.rotulo}</Link>
              ) : (
                <span className="truncate text-white/60" title={`${l.grupo} · ${l.rotulo}`}>{l.rotulo}</span>
              )}
              <div
                className={`relative h-4 ${l.href ? "cursor-pointer" : ""}`}
                title={`${l.rotulo}: ${l.texto}${l.href ? " — clique para abrir no BI do setor" : ""}`}
                onClick={() => l.href && router.push(l.href)}
              >
                <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
                <div
                  className="absolute inset-y-0.5 rounded"
                  style={{
                    background: l.positivo ? COR_BOA : COR_RUIM,
                    width: `${Math.max(larg, 0.5)}%`,
                    left: l.pct >= 0 ? "50%" : `${50 - larg}%`,
                  }}
                />
              </div>
              <span className={`text-right text-xs font-semibold tabular-nums ${l.positivo ? "text-white/60" : "text-rose-300"}`}>{l.texto}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import Link from "next/link";
import { formatMesAno } from "@/domain/periodo";

const NAVY = "linear-gradient(140deg,#0a1650 0%,#0d1550 45%,#151b57 100%)";
const botao = "rounded-xl bg-white/10 px-3.5 py-2 text-sm font-semibold text-white/80 ring-1 ring-white/15 transition hover:bg-white/15";

export interface HrefMes {
  anterior: string | null;
  proximo: string | null;
  atual: string | null;
}

/**
 * Moldura do BI de setor em TELA CHEIA (overlay `fixed inset-0`, como o Painel
 * da Operação): logo, título, ‹ mês ›, Tela cheia e Sair. O topo recebe o menu
 * (quadros) do setor; o palco recebe a visão aberta. Teclas: Esc chama
 * `onEsc` (limpar filtros) · F alterna a tela cheia do navegador.
 */
export function BIShell({
  titulo,
  mes,
  hrefMes,
  hrefSair,
  menu,
  palco,
  onEsc,
  dicaTopo = "clique num quadro para abrir",
}: {
  titulo: string;
  mes: string;
  hrefMes: HrefMes;
  hrefSair: string;
  menu: ReactNode;
  palco: { chave: string; titulo: string; contexto: string; conteudo: ReactNode } | null;
  onEsc?: () => void;
  dicaTopo?: string;
}) {
  const telaCheia = useCallback(() => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onEsc?.();
      else if (e.key.toLowerCase() === "f" && !(e.target instanceof HTMLInputElement)) telaCheia();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [telaCheia, onEsc]);

  const navCls = "inline-flex h-6 w-6 items-center justify-center rounded-md";
  return (
    <div className="fixed inset-0 z-[60] flex flex-col overflow-hidden text-white" style={{ background: NAVY }}>
      <header className="shrink-0 px-6 pt-5 pb-2 xl:px-10 xl:pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sol-dia.gif" alt="DIA" className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10" />
            <div>
              <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight xl:text-3xl">{titulo}</h1>
              <p className="flex flex-wrap items-center gap-x-1 text-sm text-white/50">
                {hrefMes.anterior ? (
                  <Link href={hrefMes.anterior} className={`${navCls} text-white/70 ring-1 ring-white/15 hover:bg-white/15`} aria-label="Mês anterior">‹</Link>
                ) : (
                  <span className={`${navCls} text-white/15`}>‹</span>
                )}
                <span className="font-semibold text-white/75">{formatMesAno(mes)}</span>
                {hrefMes.proximo ? (
                  <Link href={hrefMes.proximo} className={`${navCls} text-white/70 ring-1 ring-white/15 hover:bg-white/15`} aria-label="Próximo mês">›</Link>
                ) : (
                  <span className={`${navCls} text-white/15`}>›</span>
                )}
                {hrefMes.atual && (
                  <Link href={hrefMes.atual} className="mr-1 rounded-full bg-white/10 px-2 py-0.5 text-xs font-semibold text-white/70 hover:bg-white/20">
                    mês atual
                  </Link>
                )}
                · {dicaTopo}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={telaCheia} className={botao}>
              Tela cheia
            </button>
            <Link href={hrefSair} className={botao}>
              Sair
            </Link>
          </div>
        </div>
        {menu}
      </header>

      <main className="relative min-h-0 flex-1 px-6 pb-4 xl:px-10 xl:pb-5">
        <div className="flex h-full flex-col rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10 xl:p-5">
          {palco ? (
            <>
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-[family-name:var(--font-sora)] text-xl font-extrabold tracking-tight xl:text-2xl">
                  {palco.titulo} <span className="text-white/40">· {formatMesAno(mes)}</span>
                </h2>
                <p className="text-sm text-white/45">{palco.contexto}</p>
              </div>
              <div key={palco.chave} className="min-h-0 flex-1 overflow-hidden">
                {palco.conteudo}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <span className="text-4xl text-white/20" aria-hidden>↑</span>
              <p className="text-xl font-semibold text-white/60">Clique num quadro acima para abrir o detalhe</p>
              <p className="text-sm text-white/35">Clique de novo no mesmo quadro para fechar · F tela cheia · Sair volta ao setor</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMesAno } from "@/domain/periodo";
import type { FiltroBI } from "@/domain/bi-recebimento";
import { MenuBI, PalcoBI, VISOES_BI, type DadosBI, type VisaoBI } from "./bi-recebimento";

/**
 * Aba BI do setor Recebimento: o topo é o menu (quadros), o clique abre o
 * detalhe embaixo e o filtro cruzado (dia, fornecedor, tipo) vale para tudo.
 * Fundo escuro de propósito — é a mesma tela que pode ir para a TV.
 */
export function BIAba({ dados, hrefMes }: { dados: DadosBI; hrefMes: { anterior: string | null; proximo: string | null; atual: string | null } }) {
  const [visao, setVisao] = useState<VisaoBI | null>(null);
  const [filtro, setFiltro] = useState<FiltroBI>({});
  const abrir = (v: VisaoBI) => setVisao((a) => (a === v ? null : v));
  const titulo = visao ? VISOES_BI.find((v) => v.id === visao) : null;

  // Esc limpa os filtros.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltro({});
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const navCls = "inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-white/15";
  return (
    <div
      className="flex flex-col rounded-3xl px-5 pb-5 pt-4 text-white xl:px-8"
      style={{ background: "linear-gradient(140deg,#0a1650 0%,#0d1550 45%,#151b57 100%)", minHeight: "calc(100vh - 11rem)" }}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {hrefMes.anterior ? <Link href={hrefMes.anterior} className={`${navCls} text-white/80 hover:bg-white/15`} aria-label="Mês anterior">‹</Link> : <span className={`${navCls} text-white/15`}>‹</span>}
        <span className="font-[family-name:var(--font-sora)] text-lg font-extrabold">{formatMesAno(dados.mes)}</span>
        {hrefMes.proximo ? <Link href={hrefMes.proximo} className={`${navCls} text-white/80 hover:bg-white/15`} aria-label="Próximo mês">›</Link> : <span className={`${navCls} text-white/15`}>›</span>}
        {hrefMes.atual && (
          <Link href={hrefMes.atual} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-white/70 hover:bg-white/20">
            mês atual
          </Link>
        )}
        <span className="ml-auto text-xs text-white/40">BI do Recebimento · clique num quadro para abrir</span>
      </div>

      {dados.serie.length > 0 ? (
        <MenuBI dados={dados} visao={visao} onVisao={abrir} filtro={filtro} onFiltro={setFiltro} />
      ) : (
        <div className="mt-4 rounded-2xl bg-white/[0.06] px-5 py-6 text-center text-white/40 ring-1 ring-white/10">Sem dados de recebimento.</div>
      )}

      <div className="mt-4 flex min-h-[640px] flex-1 flex-col rounded-3xl bg-white/[0.04] p-5 ring-1 ring-white/10 xl:p-6" style={{ height: "calc(100vh - 22rem)" }}>
        {visao && titulo ? (
          <>
            <div className="mb-3">
              <h2 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight">
                {titulo.titulo} <span className="text-white/40">· {formatMesAno(dados.mes)}</span>
              </h2>
              <p className="text-sm text-white/45">{titulo.contexto}</p>
            </div>
            <div key={visao} className="min-h-0 flex-1 overflow-hidden">
              <PalcoBI dados={dados} visao={visao} filtro={filtro} onFiltro={setFiltro} />
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
            <span className="text-4xl text-white/20" aria-hidden>↑</span>
            <p className="text-xl font-semibold text-white/60">Clique num quadro acima para abrir o detalhe</p>
            <p className="text-sm text-white/35">Clique de novo no mesmo quadro para fechar · Esc limpa os filtros</p>
          </div>
        )}
      </div>
    </div>
  );
}

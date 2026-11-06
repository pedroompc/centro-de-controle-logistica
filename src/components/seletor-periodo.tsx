"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type Periodo,
  type AtalhoPeriodo,
  mesmoPeriodo,
  paramsDoPeriodo,
  rotuloPeriodo,
} from "@/domain/periodo";
import { trocarPeriodo } from "@/lib/url-periodo";
import { CalendarioPeriodo } from "./seletor-periodo-calendario";

/**
 * Botão com o rótulo do período ativo que abre atalhos + calendário livre.
 * No celular abre como folha de baixo para cima. Troca só o período na URL,
 * preservando os demais filtros da tela (menos as chaves de `limpar`).
 */
export function SeletorPeriodo({
  periodo,
  atalhos,
  piso,
  hoje,
  limpar = [],
  explicito = false,
  tema = "claro",
}: {
  periodo: Periodo;
  atalhos: AtalhoPeriodo[];
  piso: string;
  hoje: string; // ISO, vindo do servidor (evita divergência de fuso na hidratação)
  limpar?: string[];
  explicito?: boolean;
  /** "escuro" = botão para fundo navy (BIs em tela cheia). */
  tema?: "claro" | "escuro";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);

  function aplicar(p: Periodo) {
    setAberto(false);
    const [a, m, d] = hoje.split("-").map(Number);
    const qs = trocarPeriodo(sp, paramsDoPeriodo(p, new Date(a, m - 1, d), explicito), limpar).toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div ref={caixa} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        aria-haspopup="dialog"
        className={`inline-flex min-w-[7rem] items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold transition ${
          tema === "escuro" ? "text-white/80 hover:bg-white/10" : "text-[#141a4d] hover:bg-slate-100"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`h-4 w-4 ${tema === "escuro" ? "text-white/45" : "text-slate-400"}`} aria-hidden>
          <rect x="3.5" y="5" width="17" height="15" rx="2" />
          <path d="M3.5 9.5h17M8 3v4M16 3v4" />
        </svg>
        {rotuloPeriodo(periodo)}
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/30 md:hidden" aria-hidden onClick={() => setAberto(false)} />
          <div
            role="dialog"
            aria-label="Escolher período"
            className={`pb-safe fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 text-left font-normal text-slate-700 shadow-xl md:absolute md:inset-x-auto md:bottom-auto md:top-full md:mt-2 md:w-[34rem] md:rounded-2xl ${tema === "escuro" ? "md:left-0" : "md:right-0"}`}
          >
            <div className="flex flex-col gap-4 md:flex-row">
              <ul className="grid grid-cols-2 gap-1 md:w-40 md:grid-cols-1">
                {atalhos.map((a) => {
                  const ativo = mesmoPeriodo(a.periodo, periodo);
                  return (
                    <li key={a.chave}>
                      <button
                        type="button"
                        onClick={() => aplicar(a.periodo)}
                        title={rotuloPeriodo(a.periodo)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                          ativo ? "bg-[#181d55] font-semibold text-white" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {a.rotulo}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex-1 border-t border-slate-100 pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                <CalendarioPeriodo periodo={periodo} piso={piso} hoje={hoje} onEscolher={aplicar} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

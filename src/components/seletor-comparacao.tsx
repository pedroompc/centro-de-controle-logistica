"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  type Periodo,
  type ModoComparacao,
  type PeriodoComparado,
  paramComparacao,
  periodoAnoPassado,
  periodoAnterior,
  rotuloCurto,
} from "@/domain/periodo";
import { CalendarioPeriodo } from "./seletor-periodo-calendario";

/**
 * Comparação opcional dos cards (`?cmp=`). Desligada, é só um botão
 * "Comparar"; ligada, mostra contra o quê ("vs Out/26") e um × para desligar.
 */
export function SeletorComparacao({
  periodo,
  comparacao,
  piso,
  hoje,
}: {
  periodo: Periodo;
  comparacao: PeriodoComparado | null;
  piso: string;
  hoje: string;
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

  const [a, m, d] = hoje.split("-").map(Number);
  const dHoje = new Date(a, m - 1, d);
  const ant = periodoAnterior(periodo, dHoje);
  const ano = periodoAnoPassado(periodo, dHoje);

  function aplicar(cmp: string | null) {
    setAberto(false);
    const p = new URLSearchParams(sp.toString());
    if (cmp) p.set("cmp", cmp);
    else p.delete("cmp");
    const qs = p.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const opcoes: { modo: ModoComparacao; rotulo: string; p: Periodo }[] = [
    { modo: "ant", rotulo: "Período anterior", p: ant },
    { modo: "ano", rotulo: "Ano passado", p: ano },
  ];

  return (
    <div ref={caixa} className="relative">
      {comparacao ? (
        <span className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50 text-sm font-medium text-[#141a4d]">
          <button type="button" onClick={() => setAberto((v) => !v)} aria-expanded={aberto} className="py-1.5 pl-3 pr-1.5">
            vs {rotuloCurto(comparacao.periodo)}
          </button>
          <button
            type="button"
            onClick={() => aplicar(null)}
            aria-label="Desligar comparação"
            className="rounded-r-lg px-2 py-1.5 text-slate-400 transition hover:bg-amber-100 hover:text-slate-600"
          >
            ×
          </button>
        </span>
      ) : (
        <button
          type="button"
          onClick={() => setAberto((v) => !v)}
          aria-expanded={aberto}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4 text-slate-400" aria-hidden>
            <path d="M7 4v16M17 4v16M3 8h8M13 16h8" />
          </svg>
          Comparar
        </button>
      )}

      {aberto && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/30 md:hidden" aria-hidden onClick={() => setAberto(false)} />
          <div
            role="dialog"
            aria-label="Comparar com"
            className="pb-safe fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 text-left font-normal text-slate-700 shadow-xl md:absolute md:inset-x-auto md:bottom-auto md:right-0 md:top-full md:mt-2 md:w-[34rem] md:rounded-2xl"
          >
            <div className="flex flex-col gap-4 md:flex-row">
              <ul className="grid grid-cols-2 content-start gap-1 md:w-44 md:grid-cols-1">
                {opcoes.map((o) => {
                  const ativo = comparacao?.modo === o.modo;
                  return (
                    <li key={o.modo}>
                      <button
                        type="button"
                        onClick={() => aplicar(o.modo)}
                        className={`w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                          ativo ? "bg-[#181d55] font-semibold text-white" : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {o.rotulo}
                        <span className={`block text-xs ${ativo ? "text-white/60" : "text-slate-400"}`}>{rotuloCurto(o.p)}</span>
                      </button>
                    </li>
                  );
                })}
                {comparacao && (
                  <li className="col-span-2 md:col-span-1">
                    <button
                      type="button"
                      onClick={() => aplicar(null)}
                      className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-500 transition hover:bg-slate-100"
                    >
                      Sem comparação
                    </button>
                  </li>
                )}
              </ul>
              <div className="flex-1 border-t border-slate-100 pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0">
                <CalendarioPeriodo
                  periodo={comparacao?.periodo ?? null}
                  piso={piso}
                  hoje={hoje}
                  onEscolher={(p) => aplicar(paramComparacao("livre", p))}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

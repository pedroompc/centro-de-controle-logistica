"use client";

import { useState } from "react";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { DIAS_SEMANA, type DiaSemanaFrota } from "@/domain/telemetria";

type Base = "fat" | "ent";
type Modo = "num" | "pct";

const brl0 = (v: number) => formatBRL(Math.round(v)).replace(/,00$/, "");

function Alternar<T extends string>({ valor, opcoes, onChange }: { valor: T; opcoes: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-md bg-slate-100 p-0.5 text-[11px] font-bold" role="group">
      {opcoes.map(([v, r]) => (
        <button key={v} type="button" onClick={() => onChange(v)} aria-pressed={valor === v}
          className={`rounded px-2 py-1 transition ${valor === v ? "bg-white text-[#141a4d] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          {r}
        </button>
      ))}
    </div>
  );
}

/**
 * Devolução por dia da semana (valor ou peso), como os dois gráficos do Flask:
 * base "Dia faturado" (devolução das notas vendidas naquele dia) ou "Entrada dev."
 * (devolução que entrou naquele dia), em R$/kg ou em % do faturado do dia.
 */
export default function GraficoSemana({ dias, medida }: { dias: DiaSemanaFrota[]; medida: "valor" | "peso" }) {
  const [base, setBase] = useState<Base>("fat");
  const [modo, setModo] = useState<Modo>("num");
  const pct = modo === "pct" && base === "fat";
  const itens = dias.filter((d) => d.ds < 6 || d.faturado > 0 || d.devolvidoEnt > 0).map((d) => {
    const dev = medida === "valor" ? (base === "fat" ? d.devolvidoFat : d.devolvidoEnt) : (base === "fat" ? d.pesoDevFat : d.pesoDevEnt);
    const fat = medida === "valor" ? d.faturado : d.pesoFaturado;
    const v = pct ? (fat > 0 ? dev / fat : 0) : dev;
    return { rotulo: DIAS_SEMANA[d.ds], v, texto: pct ? formatPercent(v, 2) : medida === "valor" ? brl0(v) : formatKg(v), fat };
  });
  const max = Math.max(...itens.map((i) => i.v), pct ? 0.0001 : 1);

  return (
    <div className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Devolução ({medida === "valor" ? "valor R$" : "peso kg"})</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Alternar valor={base} onChange={setBase} opcoes={[["fat", "Dia faturado"], ["ent", "Entrada dev."]]} />
          {base === "fat" && <Alternar valor={modo} onChange={setModo} opcoes={[["num", "Numérico"], ["pct", "Porcentagem"]]} />}
        </div>
      </div>
      <div className="flex h-44 items-end gap-2">
        {itens.map((i) => (
          <div key={i.rotulo} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`${i.rotulo} · ${i.texto}${base === "fat" ? ` · faturado ${medida === "valor" ? brl0(i.fat) : formatKg(i.fat)}` : ""}`}>
            <span className="text-[10px] font-semibold tabular-nums text-slate-500">{i.v > 0 ? i.texto : ""}</span>
            <div className="w-full max-w-[56px] rounded-t-md bg-rose-400 transition-all" style={{ height: `${i.v > 0 ? Math.max(3, (i.v / max) * 85) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-2 border-t border-slate-200 pt-1">
        {itens.map((i) => <span key={i.rotulo} className="min-w-0 flex-1 text-center text-[11px] font-semibold text-slate-500">{i.rotulo}</span>)}
      </div>
    </div>
  );
}

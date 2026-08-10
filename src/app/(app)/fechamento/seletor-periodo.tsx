"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { INICIO_HISTORICO } from "@/domain/periodo";
import { hojeISO } from "@/domain/fechamento";

const input =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function SeletorPeriodo({ ini, fim }: { ini: string; fim: string }) {
  const router = useRouter();
  const hoje = hojeISO();
  const [periodo, setPeriodo] = useState(ini !== fim);
  const [dini, setDini] = useState(ini);
  const [dfim, setDfim] = useState(fim);

  function aplicar(novoIni: string, novoFim: string) {
    router.push(`/fechamento?ini=${novoIni}&fim=${novoFim}`);
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-slate-500">{periodo ? "De" : "Dia"}</span>
        <input
          type="date"
          value={dini}
          min={INICIO_HISTORICO}
          max={periodo ? dfim : hoje}
          onChange={(e) => {
            const v = e.target.value;
            setDini(v);
            if (!periodo) setDfim(v);
            aplicar(v, periodo ? dfim : v);
          }}
          className={input}
        />
      </label>

      {periodo && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Até</span>
          <input
            type="date"
            value={dfim}
            min={dini}
            max={hoje}
            onChange={(e) => {
              const v = e.target.value;
              setDfim(v);
              aplicar(dini, v);
            }}
            className={input}
          />
        </label>
      )}

      <label className="flex items-center gap-2 pb-2 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={periodo}
          onChange={(e) => {
            const on = e.target.checked;
            setPeriodo(on);
            if (!on) {
              setDfim(dini);
              aplicar(dini, dini);
            }
          }}
          className="h-4 w-4 accent-[#181d55]"
        />
        Período
      </label>
    </div>
  );
}

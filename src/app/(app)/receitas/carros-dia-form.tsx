"use client";

import { useState } from "react";
import { salvarCarrosDia, removerCarrosDia } from "@/data/carros-dia";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import type { DescarregamentoTipo } from "@/domain/types";

const numField =
  "w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

const NOME_CAMPO: Record<DescarregamentoTipo, string> = {
  batido: "qtd_batido",
  paletizado: "qtd_paletizado",
  pal_rem: "qtd_pal_rem",
  volume: "qtd_volume",
};

/**
 * Corrige quantos CARROS descarregaram no dia. Os lançamentos são por nota
 * fiscal e um caminhão traz várias notas; valor e peso do dia não mudam.
 * `inicial` vem da contagem já salva ou, sem ela, de 1 carro por lançamento.
 */
export function CarrosDiaForm({
  data,
  inicial,
  ajustado,
}: {
  data: string;
  inicial: Record<DescarregamentoTipo, number>;
  ajustado: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [qtds, setQtds] = useState(inicial);
  const total = TIPOS_DESCARREGAMENTO.reduce((s, t) => s + (qtds[t] || 0), 0);

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="text-xs font-medium text-slate-500 hover:text-[#141a4d]">
        {ajustado ? "editar carros" : "ajustar carros"}
      </button>
    );
  }

  return (
    <form action={salvarCarrosDia} onSubmit={() => setAberto(false)} className="flex flex-wrap items-end justify-end gap-2 text-sm">
      <input type="hidden" name="data" value={data} />
      {TIPOS_DESCARREGAMENTO.map((t) => (
        <label key={t} className="flex flex-col gap-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-slate-400">
          {ROTULO_TIPO[t]}
          <input
            name={NOME_CAMPO[t]}
            type="number"
            step="1"
            min="0"
            value={qtds[t] || ""}
            placeholder="0"
            onChange={(e) => setQtds((q) => ({ ...q, [t]: Number(e.target.value) }))}
            className={numField}
          />
        </label>
      ))}
      <span className="px-1 py-2 text-sm font-semibold text-slate-600">
        {total} {total === 1 ? "carro" : "carros"}
      </span>
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">
        Salvar
      </button>
      {ajustado && (
        <button
          formAction={removerCarrosDia.bind(null, data)}
          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-50"
          title="Apaga a contagem do dia e volta a contar 1 lançamento como 1 carro"
        >
          voltar a contar notas
        </button>
      )}
      <button
        type="button"
        onClick={() => {
          setQtds(inicial);
          setAberto(false);
        }}
        className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50"
      >
        Cancelar
      </button>
    </form>
  );
}

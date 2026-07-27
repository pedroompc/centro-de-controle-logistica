"use client";

import { useState } from "react";
import { criarTotalDiario, editarTotalDiario } from "@/data/receitas-diario";
import { toneladas } from "@/domain/receitas-metrics";
import { formatBRL } from "@/domain/format";
import type { TotalDiarioDescarregamento } from "@/domain/types";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function TotalDiarioForm({ mes, total }: { mes: string; total?: TotalDiarioDescarregamento }) {
  const [aberto, setAberto] = useState(false);
  const [peso, setPeso] = useState(total?.pesoKg ?? 0);
  const [valor, setValor] = useState(total?.receita ?? 0);

  if (!aberto) {
    return total ? (
      <button onClick={() => setAberto(true)} className="text-sm font-medium text-slate-500 hover:text-[#141a4d]">
        editar
      </button>
    ) : (
      <button
        onClick={() => setAberto(true)}
        className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]"
      >
        Lançar total do dia
      </button>
    );
  }

  const hoje = new Date().toLocaleDateString("en-CA"); // "yyyy-mm-dd" no fuso local
  const dataPadrao = total?.data ?? (hoje.slice(0, 7) === mes.slice(0, 7) ? hoje : mes);

  return (
    <form
      action={total ? editarTotalDiario : criarTotalDiario}
      className="flex flex-wrap items-end gap-2 text-sm"
    >
      {total && <input type="hidden" name="id" value={total.id} />}
      <input name="data" type="date" required defaultValue={dataPadrao} className={field} />
      <input
        name="descarregos"
        type="number"
        step="1"
        min="1"
        required
        placeholder="Nº descarregos"
        defaultValue={total?.descarregos || ""}
        className={field}
      />
      <input
        name="peso_kg"
        type="number"
        step="0.001"
        min="0"
        required
        placeholder="Peso total (kg)"
        value={peso || ""}
        onChange={(e) => setPeso(Number(e.target.value))}
        className={field}
      />
      <input
        name="receita"
        type="number"
        step="0.01"
        min="0"
        required
        placeholder="Valor total (R$)"
        value={valor || ""}
        onChange={(e) => setValor(Number(e.target.value))}
        className={field}
      />
      <input name="observacao" defaultValue={total?.observacao ?? ""} placeholder="Observação" className={field} />
      <span className="px-2 py-2 text-sm font-semibold text-emerald-700">
        {toneladas(peso || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t → {valor ? formatBRL(valor) : "—"}
      </span>
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">
        {total ? "Salvar" : "Adicionar"}
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50"
      >
        Cancelar
      </button>
    </form>
  );
}

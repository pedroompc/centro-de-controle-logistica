"use client";

import { criarCustoFixo } from "@/data/custos-fixos";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function CustoFixoForm() {
  return (
    <form action={criarCustoFixo} className="flex flex-wrap items-end gap-2 text-sm">
      <input name="nome" required placeholder="Nome (ex: Empilhadeira 2)" className={field} />
      <input name="valor" type="number" step="0.01" min="0" required placeholder="Valor mensal" className={field} />
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">Adicionar fixo</button>
    </form>
  );
}

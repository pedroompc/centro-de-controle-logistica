"use client";

import { criarCustoFixo } from "@/data/custos-fixos";

export function CustoFixoForm() {
  return (
    <form action={criarCustoFixo} className="flex flex-wrap items-end gap-2 text-sm">
      <input name="nome" required placeholder="Nome (ex: Empilhadeira 2)"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <input name="valor" type="number" step="0.01" min="0" required placeholder="Valor mensal"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">Adicionar fixo</button>
    </form>
  );
}

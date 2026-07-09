"use client";

import { criarSetor } from "@/data/setores";

export function SetorForm() {
  return (
    <form action={criarSetor} className="flex gap-2">
      <input
        name="nome"
        required
        placeholder="Novo setor"
        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
      />
      <button className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
        Adicionar
      </button>
    </form>
  );
}

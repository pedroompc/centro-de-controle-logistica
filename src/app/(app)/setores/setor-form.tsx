"use client";

import { criarSetor } from "@/data/setores";

export function SetorForm() {
  return (
    <form action={criarSetor} className="flex gap-2">
      <input
        name="nome"
        required
        placeholder="Novo setor"
        className="rounded-lg border border-slate-300 px-3 py-2"
      />
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">
        Adicionar
      </button>
    </form>
  );
}

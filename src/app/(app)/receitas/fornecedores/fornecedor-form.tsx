"use client";

import { criarFornecedor } from "@/data/fornecedores";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function FornecedorForm() {
  return (
    <form action={criarFornecedor} className="flex flex-wrap items-end gap-2 text-sm">
      <input name="nome" required placeholder="Nome do fornecedor" className={field} />
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">
        Adicionar
      </button>
    </form>
  );
}

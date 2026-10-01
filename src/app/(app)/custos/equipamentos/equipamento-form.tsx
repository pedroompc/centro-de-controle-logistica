"use client";

import { criarEquipamento } from "@/data/equipamentos";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function EquipamentoForm() {
  return (
    <form action={criarEquipamento} className="flex flex-wrap items-end gap-2 text-sm">
      <input name="nome" required placeholder="Nome (ex: Patinha elétrica)" className={field} />
      <select name="tipo" defaultValue="patinha" className={field}>
        <option value="empilhadeira">Empilhadeira</option>
        <option value="patinha">Patinha elétrica</option>
        <option value="outro">Outro</option>
      </select>
      <input name="quantidade" type="number" min="0" step="1" defaultValue={1} required placeholder="Qtd" className={`${field} w-20`} />
      <input name="custo_unitario" type="number" min="0" step="0.01" required placeholder="Custo/mês por unidade" className={field} />
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">Adicionar</button>
    </form>
  );
}

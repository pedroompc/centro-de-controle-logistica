"use client";

import { registrarFalta } from "@/data/faltas";

const TIPOS = ["justificada", "injustificada", "atestado", "folga", "ferias"] as const;

export function FaltaForm({ funcionarioId }: { funcionarioId: string }) {
  const field =
    "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";
  return (
    <form action={registrarFalta} className="flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="funcionario_id" value={funcionarioId} />
      <input name="data" type="date" required className={field} />
      <select name="tipo" defaultValue="injustificada" className={field}>
        {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input name="observacao" placeholder="Observação (opcional)" className={field} />
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">
        Registrar falta
      </button>
    </form>
  );
}

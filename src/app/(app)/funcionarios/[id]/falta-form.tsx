"use client";

import { registrarFalta } from "@/data/faltas";

const TIPOS = ["justificada", "injustificada", "atestado", "folga", "ferias"] as const;

export function FaltaForm({ funcionarioId }: { funcionarioId: string }) {
  return (
    <form action={registrarFalta} className="flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="funcionario_id" value={funcionarioId} />
      <input name="data" type="date" required
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <select name="tipo" defaultValue="injustificada"
        className="rounded-lg border border-slate-300 px-3 py-2">
        {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <input name="observacao" placeholder="Observação (opcional)"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">
        Registrar falta
      </button>
    </form>
  );
}

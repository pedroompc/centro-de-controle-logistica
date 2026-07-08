"use client";

import { useState } from "react";
import { adicionarLancamento } from "@/data/custos-mensais";

export function LancarVariavelForm({ mes }: { mes: string }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">
        Lançar variável
      </button>
    );
  }
  return (
    <form action={adicionarLancamento} className="flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="tipo" value="variavel" />
      <input name="nome" required placeholder="Item (ex: Gasolina)"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <input name="valor" type="number" step="0.01" min="0" required placeholder="Valor"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">Adicionar</button>
      <button type="button" onClick={() => setAberto(false)} className="rounded-lg border px-4 py-2 text-slate-600">Cancelar</button>
    </form>
  );
}

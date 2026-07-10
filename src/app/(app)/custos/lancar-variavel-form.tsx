"use client";

import { useState } from "react";
import { adicionarLancamento } from "@/data/custos-mensais";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function LancarVariavelForm({ mes }: { mes: string }) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
        Lançar variável
      </button>
    );
  }
  // Default: hoje, se o mês em tela for o corrente; senão o 1º dia do mês navegado.
  const hoje = new Date().toLocaleDateString("en-CA"); // "yyyy-mm-dd" no fuso local
  const dataPadrao = hoje.slice(0, 7) === mes.slice(0, 7) ? hoje : mes;
  return (
    <form action={adicionarLancamento} className="flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="tipo" value="variavel" />
      <input name="data" type="date" required defaultValue={dataPadrao} className={field} />
      <input name="nome" required placeholder="Item (ex: Gasolina)" className={field} />
      <input name="valor" type="number" step="0.01" min="0" required placeholder="Valor" className={field} />
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">Adicionar</button>
      <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">
        Cancelar
      </button>
    </form>
  );
}

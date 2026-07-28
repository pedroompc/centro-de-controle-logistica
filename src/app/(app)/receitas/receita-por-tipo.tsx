"use client";

import { useState } from "react";
import { BarList } from "@/components/ui";

type Item = { label: string; value: number; display: string };
type Modo = "receita" | "quantidade";

/**
 * Gráfico "por tipo" com alternância entre R$ (receita) e quantidade (nº de
 * carros). Recebe as duas séries já prontas do servidor e só troca qual mostra.
 * No modo R$ o total do dia não aparece (não fatia valor por tipo) — nota
 * explica; no modo quantidade ele entra somado.
 */
export function ReceitaPorTipo({ porReceita, porQuantidade }: { porReceita: Item[]; porQuantidade: Item[] }) {
  // Abre em Quantidade: no fluxo do Pedro quase tudo é total do dia, e o R$ por
  // tipo (só detalhado) costuma vir vazio — Quantidade é o que tem dado.
  const [modo, setModo] = useState<Modo>("quantidade");
  const items = modo === "receita" ? porReceita : porQuantidade;

  const botao = (m: Modo, rotulo: string) => (
    <button
      type="button"
      onClick={() => setModo(m)}
      aria-pressed={modo === m}
      className={
        "rounded-lg px-3 py-1.5 text-sm font-semibold transition " +
        (modo === m ? "bg-[#181d55] text-white" : "text-slate-500 hover:bg-slate-100")
      }
    >
      {rotulo}
    </button>
  );

  return (
    <div>
      <div className="mb-4 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1">
        {botao("receita", "R$")}
        {botao("quantidade", "Quantidade")}
      </div>
      <BarList items={items} tone="navy" />
      {modo === "receita" && (
        <p className="mt-3 text-xs text-slate-400">
          Só lançamentos detalhados — o total do dia não fatia o valor por tipo.
        </p>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { BarList } from "@/components/ui";

/** Quantos fornecedores aparecem antes de "ver todos". */
const LIMITE = 5;

/**
 * Ranking de fornecedores compacto: mostra só os maiores por padrão para não
 * dominar a página, com um "ver todos" que expande a lista completa no lugar.
 * Cliente porque o expandir/recolher é estado de UI — os dados vêm prontos do
 * servidor.
 */
export function FornecedorRanking({
  items,
}: {
  items: { label: string; value: number; display: string }[];
}) {
  const [todos, setTodos] = useState(false);
  const visiveis = todos ? items : items.slice(0, LIMITE);

  return (
    <div>
      <BarList items={visiveis} tone="gold" />
      {items.length > LIMITE && (
        <button
          type="button"
          onClick={() => setTodos((v) => !v)}
          className="mt-4 text-sm font-medium text-slate-500 transition hover:text-[#141a4d]"
        >
          {todos ? "ver menos" : `ver todos (${items.length})`}
        </button>
      )}
    </div>
  );
}

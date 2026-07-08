"use client";

import { materializarMes } from "@/data/custos-mensais";

export function AbrirMesButton({ mes }: { mes: string }) {
  return (
    <form action={materializarMes.bind(null, mes)}>
      <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">
        Abrir mês (gerar custos fixos)
      </button>
    </form>
  );
}

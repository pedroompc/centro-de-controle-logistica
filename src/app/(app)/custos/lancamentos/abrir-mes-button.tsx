"use client";

import { useFormStatus } from "react-dom";
import { materializarMes } from "@/data/custos-mensais";

function SubmitBtn() {
  const { pending } = useFormStatus();
  return (
    <button
      disabled={pending}
      className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60"
    >
      {pending ? "Abrindo..." : "Abrir mês (gerar custos fixos)"}
    </button>
  );
}

export function AbrirMesButton({ mes }: { mes: string }) {
  return (
    <form action={materializarMes.bind(null, mes)}>
      <SubmitBtn />
    </form>
  );
}

"use client";

import { useState } from "react";
import { salvarFuncionario } from "@/data/funcionarios";
import type { Setor, Funcionario } from "@/domain/types";

const STATUS = ["ativo", "afastado", "desligado"] as const;

export function FuncionarioForm({
  setores,
  inicial,
}: {
  setores: Setor[];
  inicial?: Funcionario;
}) {
  const [aberto, setAberto] = useState(false);
  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-lg bg-slate-800 px-4 py-2 text-white"
      >
        {inicial ? "Editar" : "Novo funcionário"}
      </button>
    );
  }
  return (
    <form
      action={salvarFuncionario}
      className="grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-2"
    >
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <input name="nome" required defaultValue={inicial?.nome} placeholder="Nome"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <input name="cargo" required defaultValue={inicial?.cargo} placeholder="Cargo"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <select name="setor_id" required defaultValue={inicial?.setorId ?? ""}
        className="rounded-lg border border-slate-300 px-3 py-2">
        <option value="" disabled>Setor…</option>
        {setores.map((s) => (
          <option key={s.id} value={s.id}>{s.nome}</option>
        ))}
      </select>
      <input name="custo_mensal" type="number" step="0.01" min="0" required
        defaultValue={inicial?.custoMensal} placeholder="Custo mensal (R$)"
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <input name="data_admissao" type="date" required
        defaultValue={inicial?.dataAdmissao}
        className="rounded-lg border border-slate-300 px-3 py-2" />
      <select name="status" defaultValue={inicial?.status ?? "ativo"}
        className="rounded-lg border border-slate-300 px-3 py-2">
        {STATUS.map((s) => (
          <option key={s} value={s}>{s}</option>
        ))}
      </select>
      <div className="col-span-full flex gap-2">
        <button className="rounded-lg bg-slate-800 px-4 py-2 text-white">Salvar</button>
        <button type="button" onClick={() => setAberto(false)}
          className="rounded-lg border px-4 py-2 text-slate-600">Cancelar</button>
      </div>
    </form>
  );
}

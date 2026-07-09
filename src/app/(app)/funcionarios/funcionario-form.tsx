"use client";

import { useState } from "react";
import { salvarFuncionario } from "@/data/funcionarios";
import type { Setor, Funcionario } from "@/domain/types";

const STATUS = ["ativo", "afastado", "desligado"] as const;
const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";
const lbl = "mb-1 block text-xs font-medium text-slate-500";

export function FuncionarioForm({ setores, inicial }: { setores: Setor[]; inicial?: Funcionario }) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <button
        onClick={() => setAberto(true)}
        className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]"
      >
        {inicial ? "Editar" : "Novo funcionário"}
      </button>
    );
  }

  return (
    <form action={salvarFuncionario} className="grid w-full gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
      {inicial && <input type="hidden" name="id" value={inicial.id} />}
      <label className="sm:col-span-2">
        <span className={lbl}>Nome</span>
        <input name="nome" required defaultValue={inicial?.nome} placeholder="Nome completo" className={`${field} w-full`} />
      </label>
      <label>
        <span className={lbl}>Cargo</span>
        <input name="cargo" required defaultValue={inicial?.cargo} placeholder="Cargo" className={`${field} w-full`} />
      </label>
      <label>
        <span className={lbl}>Setor</span>
        <select name="setor_id" required defaultValue={inicial?.setorId ?? ""} className={`${field} w-full`}>
          <option value="" disabled>Selecione…</option>
          {setores.map((s) => (
            <option key={s.id} value={s.id}>{s.nome}</option>
          ))}
        </select>
      </label>
      <label>
        <span className={lbl}>Custo mensal (R$)</span>
        <input name="custo_mensal" type="number" step="0.01" min="0" required defaultValue={inicial?.custoMensal} placeholder="0,00" className={`${field} w-full`} />
      </label>
      <label>
        <span className={lbl}>Admissão</span>
        <input name="data_admissao" type="date" required defaultValue={inicial?.dataAdmissao} className={`${field} w-full`} />
      </label>
      <label>
        <span className={lbl}>Status</span>
        <select name="status" defaultValue={inicial?.status ?? "ativo"} className={`${field} w-full`}>
          {STATUS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </label>
      <div className="col-span-full flex gap-2 pt-1">
        <button className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">Salvar</button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
          Cancelar
        </button>
      </div>
    </form>
  );
}

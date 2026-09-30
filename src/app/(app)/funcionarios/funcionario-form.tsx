"use client";

import { useState } from "react";
import { salvarFuncionario } from "@/data/funcionarios";
import { custoMensalDaComposicao, FATOR_ENCARGOS_SALARIO, type ComposicaoCusto } from "@/domain/efetivo";
import { formatBRL } from "@/domain/format";
import type { Setor, Funcionario } from "@/domain/types";

const STATUS = ["ativo", "afastado", "desligado"] as const;
const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";
const lbl = "mb-1 block text-xs font-medium text-slate-500";

// Mesmos rótulos e ordem da "Composição do custo" na página do funcionário.
const RUBRICAS: { chave: keyof ComposicaoCusto; campo: string; label: string }[] = [
  { chave: "salarioBase", campo: "salario_base", label: "Salário base" },
  { chave: "passagem", campo: "passagem", label: "Passagem" },
  { chave: "alimentacao", campo: "alimentacao", label: "Alimentação" },
  { chave: "planoSaude", campo: "plano_saude", label: "Plano de saúde" },
  { chave: "ajudaCusto", campo: "ajuda_custo", label: "Ajuda de custo" },
  { chave: "premiacao", campo: "premiacao", label: "Premiação" },
  { chave: "adicionalNoturno", campo: "adicional_noturno", label: "Adicional noturno" },
];

const fator = FATOR_ENCARGOS_SALARIO.toLocaleString("pt-BR");

export function FuncionarioForm({ setores, inicial }: { setores: Setor[]; inicial?: Funcionario }) {
  const [aberto, setAberto] = useState(false);
  // Texto cru de cada rubrica: "" = não informada (vira null, mostra "—").
  const [rubricas, setRubricas] = useState<Record<keyof ComposicaoCusto, string>>(() => {
    const txt = (v: number | null | undefined) => (v == null ? "" : String(v));
    return {
      salarioBase: txt(inicial?.salarioBase),
      passagem: txt(inicial?.passagem),
      alimentacao: txt(inicial?.alimentacao),
      planoSaude: txt(inicial?.planoSaude),
      ajudaCusto: txt(inicial?.ajudaCusto),
      premiacao: txt(inicial?.premiacao),
      adicionalNoturno: txt(inicial?.adicionalNoturno),
    };
  });
  const custoCalculado = custoMensalDaComposicao(
    Object.fromEntries(
      Object.entries(rubricas).map(([k, v]) => [k, v.trim() === "" ? null : Number(v)]),
    ) as ComposicaoCusto,
  );

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
      <fieldset className="col-span-full grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Composição do custo (R$)</legend>
        {RUBRICAS.map((r) => (
          <label key={r.chave}>
            <span className={lbl}>
              {r.label}
              {r.chave === "salarioBase" && <span className="text-slate-400"> (× {fator})</span>}
            </span>
            <input
              name={r.campo}
              type="number"
              step="0.01"
              min="0"
              value={rubricas[r.chave]}
              onChange={(e) => setRubricas((atual) => ({ ...atual, [r.chave]: e.target.value }))}
              placeholder="—"
              className={`${field} w-full`}
            />
          </label>
        ))}
        <div className="flex flex-col justify-end">
          <span className={lbl}>Custo mensal</span>
          {custoCalculado !== null ? (
            <span className="py-2 text-base font-bold tabular-nums text-[#141a4d]">{formatBRL(custoCalculado)}</span>
          ) : (
            // Sem nenhuma rubrica: custo digitado à mão, como antes.
            <input name="custo_mensal" type="number" step="0.01" min="0" required defaultValue={inicial?.custoMensal} placeholder="0,00" className={`${field} w-full`} />
          )}
        </div>
      </fieldset>
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

"use client";

import { useState } from "react";
import { editarReceita } from "@/data/receitas";
import { valorDaNota, toneladas } from "@/domain/receitas-metrics";
import { formatBRL } from "@/domain/format";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import type { Fornecedor, PrecoDescarregamento, Receita, DescarregamentoTipo } from "@/domain/types";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

/** Edita UMA nota já lançada. Lançar é pelo "Lançar carro" (várias notas num carro). */
export function DescarregamentoForm({
  fornecedores,
  precos,
  valorMinimo,
  receita,
}: {
  fornecedores: Fornecedor[];
  precos: PrecoDescarregamento[];
  valorMinimo: number;
  receita: Receita;
}) {
  const precoDe = (t: DescarregamentoTipo) => precos.find((p) => p.tipo === t)?.precoPorTonelada ?? 0;
  const precoUnidadeDe = (t: DescarregamentoTipo) => precos.find((p) => p.tipo === t)?.precoPorUnidade ?? 0;
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<DescarregamentoTipo>(receita.tipo);
  const [peso, setPeso] = useState(receita.pesoKg);
  const [preco, setPreco] = useState(receita.precoPorTonelada);
  const [quantidade, setQuantidade] = useState(receita.quantidade ?? 0);
  const [precoUnidade, setPrecoUnidade] = useState(receita.precoPorUnidade ?? precoUnidadeDe("volume"));
  const [fechado, setFechado] = useState(receita.valorFechado);
  const [valorFechado, setValorFechado] = useState(receita.valorFechado ? receita.receita : 0);
  const [isento, setIsento] = useState(receita.isento);
  // Lançamento antigo (sem carro): o Volume diz em quantos carros veio.
  const legado = receita.carroId === null;
  const [carros, setCarros] = useState<number | "">(receita.carros ?? 1);

  const ehVolume = tipo === "volume";
  const previa = valorDaNota(
    { tipo, pesoKg: peso || 0, precoPorTonelada: preco || 0, quantidade: quantidade || 0, precoPorUnidade: precoUnidade || 0, isento, valorFechado: ehVolume && fechado ? valorFechado || 0 : null },
    valorMinimo,
  );

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="text-sm font-medium text-slate-500 hover:text-[#141a4d]">
        editar
      </button>
    );
  }

  return (
    <form action={editarReceita} className="flex flex-wrap items-end gap-2 text-sm">
      <input type="hidden" name="id" value={receita.id} />
      <input name="data" type="date" required defaultValue={receita.data} className={field} />
      <select name="fornecedor_id" required defaultValue={receita.fornecedorId} className={field}>
        {fornecedores.map((f) => (
          <option key={f.id} value={f.id}>{f.nome}</option>
        ))}
        {!fornecedores.some((f) => f.id === receita.fornecedorId) && <option value={receita.fornecedorId}>{receita.fornecedorNome}</option>}
      </select>
      <input name="peso_kg" type="number" step="0.001" min="0" required placeholder="Peso (kg)" value={peso || ""} onChange={(e) => setPeso(Number(e.target.value))} className={field} />
      <select
        name="tipo"
        value={tipo}
        onChange={(e) => {
          const t = e.target.value as DescarregamentoTipo;
          setTipo(t);
          if (t === "volume") setPrecoUnidade(precoUnidadeDe(t));
          else setPreco(precoDe(t));
        }}
        className={field}
      >
        {TIPOS_DESCARREGAMENTO.map((t) => (
          <option key={t} value={t}>{ROTULO_TIPO[t]}</option>
        ))}
      </select>
      {ehVolume ? (
        <>
          <input name="quantidade" type="number" step="1" min="1" required placeholder="Caixas" value={quantidade || ""} onChange={(e) => setQuantidade(Number(e.target.value))} className={`${field} w-24`} />
          {fechado ? (
            <input name="valor_fechado" type="number" step="0.01" min="0" required placeholder="Valor total R$" value={valorFechado || ""} onChange={(e) => setValorFechado(Number(e.target.value))} className={`${field} w-32`} />
          ) : (
            <input name="preco_por_unidade" type="number" step="0.01" min="0" required placeholder="R$/caixa" value={precoUnidade || ""} onChange={(e) => setPrecoUnidade(Number(e.target.value))} className={`${field} w-28`} />
          )}
          <label className="inline-flex items-center gap-1.5 px-1 py-2 text-xs text-slate-600">
            <input type="checkbox" checked={fechado} onChange={(e) => setFechado(e.target.checked)} /> valor fechado
          </label>
          {legado && (
            <input name="carros" type="number" step="1" min="0" required title="Em quantos carros vieram essas caixas" value={carros} onChange={(e) => setCarros(e.target.value === "" ? "" : Number(e.target.value))} className={`${field} w-20`} />
          )}
        </>
      ) : (
        <>
          <input name="preco_por_tonelada" type="number" step="0.01" min="0" required placeholder="R$/ton" value={preco || ""} onChange={(e) => setPreco(Number(e.target.value))} className={`${field} w-28`} />
          {legado && <input type="hidden" name="carros" value="" />}
        </>
      )}
      <label className="inline-flex items-center gap-1.5 px-1 py-2 text-xs font-medium text-slate-600">
        <input type="checkbox" name="isento" checked={isento} onChange={(e) => setIsento(e.target.checked)} /> Isento (FOB)
      </label>
      <input name="observacao" defaultValue={receita.observacao ?? ""} placeholder="Observação" className={field} />
      <span className="px-2 py-2 text-sm font-semibold text-emerald-700">
        {ehVolume ? `${quantidade || 0} cx` : `${toneladas(peso || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t`} → {isento ? "Isento" : formatBRL(previa)}
      </span>
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">Salvar</button>
      <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50">
        Cancelar
      </button>
    </form>
  );
}

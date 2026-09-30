"use client";

import { useState } from "react";
import { criarReceita, editarReceita } from "@/data/receitas";
import { calcularReceita, calcularReceitaVolume, toneladas } from "@/domain/receitas-metrics";
import { formatBRL } from "@/domain/format";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import type { Fornecedor, PrecoDescarregamento, Receita, DescarregamentoTipo } from "@/domain/types";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function DescarregamentoForm({
  fornecedores,
  precos,
  mes,
  valorMinimo,
  receita,
}: {
  fornecedores: Fornecedor[];
  precos: PrecoDescarregamento[];
  mes: string;
  valorMinimo: number;
  receita?: Receita;
}) {
  const precoDe = (t: DescarregamentoTipo) => precos.find((p) => p.tipo === t)?.precoPorTonelada ?? 0;
  const precoUnidadeDe = (t: DescarregamentoTipo) => precos.find((p) => p.tipo === t)?.precoPorUnidade ?? 0;
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<DescarregamentoTipo>(receita?.tipo ?? "batido");
  const [peso, setPeso] = useState(receita?.pesoKg ?? 0);
  const [preco, setPreco] = useState(receita?.precoPorTonelada ?? precoDe("batido"));
  const [quantidade, setQuantidade] = useState(receita?.quantidade ?? 0);
  const [precoUnidade, setPrecoUnidade] = useState(receita?.precoPorUnidade ?? precoUnidadeDe("volume"));
  // Em quantos carros vieram as caixas. Lançamento antigo sem o dado conta 1.
  const [carros, setCarros] = useState<number | "">(receita?.carros ?? 1);

  const ehVolume = tipo === "volume";
  const previa = ehVolume
    ? calcularReceitaVolume(quantidade || 0, precoUnidade || 0, valorMinimo)
    : calcularReceita(peso || 0, preco || 0, valorMinimo);
  const temPrevia = ehVolume ? quantidade > 0 : peso > 0;

  if (!aberto) {
    return receita ? (
      <button onClick={() => setAberto(true)} className="text-sm font-medium text-slate-500 hover:text-[#141a4d]">
        editar
      </button>
    ) : (
      <button
        onClick={() => setAberto(true)}
        className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]"
      >
        Lançar descarrego
      </button>
    );
  }

  const hoje = new Date().toLocaleDateString("en-CA"); // "yyyy-mm-dd" no fuso local
  const dataPadrao = receita?.data ?? (hoje.slice(0, 7) === mes.slice(0, 7) ? hoje : mes);

  return (
    <form action={receita ? editarReceita : criarReceita} className="flex flex-wrap items-end gap-2 text-sm">
      {receita && <input type="hidden" name="id" value={receita.id} />}
      <input name="data" type="date" required defaultValue={dataPadrao} className={field} />
      <select name="fornecedor_id" required defaultValue={receita?.fornecedorId ?? ""} className={field}>
        <option value="" disabled>
          Fornecedor
        </option>
        {fornecedores.map((f) => (
          <option key={f.id} value={f.id}>
            {f.nome}
          </option>
        ))}
      </select>
      <input
        name="peso_kg"
        type="number"
        step="0.001"
        min="0"
        required
        placeholder="Peso (kg)"
        value={peso || ""}
        onChange={(e) => setPeso(Number(e.target.value))}
        className={field}
      />
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
          <input
            name="quantidade"
            type="number"
            step="1"
            min="1"
            required
            placeholder="Caixas"
            value={quantidade || ""}
            onChange={(e) => setQuantidade(Number(e.target.value))}
            className={field}
          />
          <input
            name="preco_por_unidade"
            type="number"
            step="0.01"
            min="0"
            required
            placeholder="R$/caixa"
            value={precoUnidade || ""}
            onChange={(e) => setPrecoUnidade(Number(e.target.value))}
            className={field}
          />
          <input
            name="carros"
            type="number"
            step="1"
            min="0"
            required
            placeholder="Carros"
            title="Em quantos carros vieram essas caixas"
            value={carros}
            onChange={(e) => setCarros(e.target.value === "" ? "" : Number(e.target.value))}
            className={`${field} w-24`}
          />
        </>
      ) : (
        <input
          name="preco_por_tonelada"
          type="number"
          step="0.01"
          min="0"
          required
          placeholder="R$/ton"
          value={preco || ""}
          onChange={(e) => setPreco(Number(e.target.value))}
          className={field}
        />
      )}
      <input name="observacao" defaultValue={receita?.observacao ?? ""} placeholder="Observação" className={field} />
      <span className="px-2 py-2 text-sm font-semibold text-emerald-700">
        {ehVolume
          ? `${quantidade || 0} cx · ${carros || 0} ${carros === 1 ? "carro" : "carros"} → ${temPrevia ? formatBRL(previa) : "—"}`
          : `${toneladas(peso || 0).toLocaleString("pt-BR", { maximumFractionDigits: 3 })} t → ${temPrevia ? formatBRL(previa) : "—"}`}
      </span>
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">
        {receita ? "Salvar" : "Adicionar"}
      </button>
      <button
        type="button"
        onClick={() => setAberto(false)}
        className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-slate-50"
      >
        Cancelar
      </button>
    </form>
  );
}

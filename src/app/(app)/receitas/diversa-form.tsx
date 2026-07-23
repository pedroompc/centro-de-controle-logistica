"use client";

import { useState, useId } from "react";
import { criarDiversa, editarDiversa } from "@/data/receitas-diversas";
import { calcularValorDiversa } from "@/domain/receitas-metrics";
import { formatBRL } from "@/domain/format";
import { MATERIAIS_SUGERIDOS } from "@/domain/receitas-diversas";
import type { ReceitaDiversa } from "@/domain/types";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

export function DiversaForm({ mes, diversa }: { mes: string; diversa?: ReceitaDiversa }) {
  const [aberto, setAberto] = useState(false);
  const [quantidade, setQuantidade] = useState(diversa?.quantidade ?? 0);
  const [preco, setPreco] = useState(diversa?.precoUnitario ?? 0);
  const [valor, setValor] = useState(diversa?.valor ?? 0);
  // Uma vez que o usuário mexe no valor, digitar quantidade/preço não sobrescreve
  // mais o que ele pôs — o negociado manda.
  const [valorTocado, setValorTocado] = useState(Boolean(diversa));

  // id único por instância: o form é montado uma vez por linha da tabela, e
  // datalists com id repetido deixam o atributo `list` indefinido.
  const idMateriais = useId();

  const sugerido = calcularValorDiversa(quantidade || 0, preco || 0);
  const divergente = valorTocado && valor > 0 && sugerido > 0 && valor !== sugerido;

  function mudarQuantidade(n: number) {
    setQuantidade(n);
    if (!valorTocado) setValor(calcularValorDiversa(n || 0, preco || 0));
  }

  function mudarPreco(n: number) {
    setPreco(n);
    if (!valorTocado) setValor(calcularValorDiversa(quantidade || 0, n || 0));
  }

  if (!aberto) {
    return diversa ? (
      <button onClick={() => setAberto(true)} className="text-sm font-medium text-slate-500 hover:text-[#141a4d]">
        editar
      </button>
    ) : (
      <button
        onClick={() => setAberto(true)}
        className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]"
      >
        Lançar outra receita
      </button>
    );
  }

  const hoje = new Date().toLocaleDateString("en-CA"); // "yyyy-mm-dd" no fuso local
  const dataPadrao = diversa?.data ?? (hoje.slice(0, 7) === mes.slice(0, 7) ? hoje : mes);

  return (
    <form action={diversa ? editarDiversa : criarDiversa} className="flex flex-wrap items-end gap-2 text-sm">
      {diversa && <input type="hidden" name="id" value={diversa.id} />}
      {/* Preserva a categoria original ao editar — hoje o enum tem só "reciclagem",
          mas fixar o literal faria uma categoria futura virar reciclagem ao salvar
          uma edição sem o TypeScript apontar nada quando o union crescer. */}
      <input type="hidden" name="categoria" value={diversa?.categoria ?? "reciclagem"} />
      <input name="data" type="date" required defaultValue={dataPadrao} className={field} />
      <input
        name="material"
        list={idMateriais}
        defaultValue={diversa?.material ?? ""}
        placeholder="Material"
        className={field}
      />
      <datalist id={idMateriais}>
        {MATERIAIS_SUGERIDOS.map((m) => <option key={m} value={m} />)}
      </datalist>
      <input
        name="quantidade"
        type="number"
        step="0.001"
        min="0"
        placeholder="Quantidade (kg)"
        value={quantidade || ""}
        onChange={(e) => mudarQuantidade(Number(e.target.value))}
        className={field}
      />
      <input
        name="preco_unitario"
        type="number"
        step="0.01"
        min="0"
        placeholder="R$/kg"
        value={preco || ""}
        onChange={(e) => mudarPreco(Number(e.target.value))}
        className={field}
      />
      <input
        name="valor"
        type="number"
        step="0.01"
        min="0"
        required
        placeholder="Valor"
        value={valor || ""}
        onChange={(e) => {
          setValorTocado(true);
          setValor(Number(e.target.value));
        }}
        className={field}
      />
      <input name="observacao" defaultValue={diversa?.observacao ?? ""} placeholder="Observação" className={field} />
      {divergente && (
        <span className="px-2 py-2 text-xs text-slate-500">
          calculado: {formatBRL(sugerido)} · dif. {formatBRL(valor - sugerido)}
        </span>
      )}
      <button className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f]">
        {diversa ? "Salvar" : "Adicionar"}
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

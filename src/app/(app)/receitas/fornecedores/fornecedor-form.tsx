"use client";

import { useActionState } from "react";
import { criarFornecedor, editarFornecedor, type RespostaFornecedor } from "@/data/fornecedores";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

function Mensagem({ estado }: { estado: RespostaFornecedor }) {
  if (estado.erro) return <p className="w-full text-xs font-medium text-rose-600" aria-live="polite">{estado.erro}</p>;
  if (estado.aviso) return <p className="w-full text-xs font-medium text-emerald-700" aria-live="polite">{estado.aviso}</p>;
  return null;
}

export function FornecedorForm() {
  const [estado, acao, enviando] = useActionState(criarFornecedor, {});
  return (
    <form action={acao} className="flex flex-wrap items-end gap-2 text-sm">
      {/* key: depois do envio o React limpa o form; no erro, o nome digitado volta. */}
      <input key={estado.nome ?? ""} name="nome" defaultValue={estado.nome} required placeholder="Nome do fornecedor" className={field} />
      <button disabled={enviando} className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f] disabled:opacity-60">
        Adicionar
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}

/** Renomear: bloqueia nome que já é de outro cadastro. */
export function EditarFornecedorForm({
  id,
  nome,
  className,
  inputClassName,
  botaoClassName,
  botao,
}: {
  id: string;
  nome: string;
  className: string;
  inputClassName: string;
  botaoClassName: string;
  botao: string;
}) {
  const [estado, acao, enviando] = useActionState(editarFornecedor, {});
  return (
    <form action={acao} className={`${className} flex-wrap`}>
      <input type="hidden" name="id" value={id} />
      <input key={estado.nome ?? nome} name="nome" defaultValue={estado.nome ?? nome} required className={inputClassName} />
      <button disabled={enviando} className={`${botaoClassName} disabled:opacity-60`}>
        {botao}
      </button>
      <Mensagem estado={estado} />
    </form>
  );
}

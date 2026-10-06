"use client";

import { useActionState, useState } from "react";
import { registrarMapa, type RespostaMapa } from "@/data/separacao-mapas";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

/**
 * Registro rápido: data, nº do mapa e quem separou (clique nos nomes; mapa
 * dividido entre 2 pessoas = marque as duas). Depois de salvar, limpa o mapa e
 * os nomes e mantém a data, para lançar o próximo.
 */
export function MapaForm({ separadores, outros }: { separadores: { id: string; nome: string }[]; outros: { id: string; nome: string }[] }) {
  const hoje = new Date().toLocaleDateString("en-CA");
  const [data, setData] = useState(hoje);
  const [mapa, setMapa] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [estado, acao, enviando] = useActionState(async (ant: RespostaMapa, fd: FormData) => {
    const r = await registrarMapa(ant, fd);
    if (r.ok) {
      setMapa("");
      setSel([]);
    }
    return r;
  }, {});
  const alterna = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const nome = (id: string) => [...separadores, ...outros].find((p) => p.id === id)?.nome ?? "";

  return (
    <form action={acao} className="space-y-3 text-sm">
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-500">Data</span>
          <input name="data" type="date" required value={data} onChange={(e) => setData(e.target.value)} className={field} />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-slate-500">Nº do mapa</span>
          <input name="mapa" required inputMode="numeric" autoFocus value={mapa} onChange={(e) => setMapa(e.target.value)} placeholder="ex: 1155" className={`${field} w-36`} />
        </label>
        {sel.map((id) => (
          <input key={id} type="hidden" name="funcionario_id" value={id} />
        ))}
        <button disabled={enviando} className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f] disabled:opacity-60">
          {enviando ? "Salvando…" : "Registrar"}
        </button>
        {estado.erro && <span className="text-xs font-medium text-rose-600">{estado.erro}</span>}
        {estado.ok && <span className="text-xs font-medium text-emerald-700">{estado.ok}</span>}
      </div>
      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-500">Quem separou {sel.length > 1 && <span className="text-slate-400">(mapa dividido entre {sel.length})</span>}</span>
        <div className="flex flex-wrap gap-1.5">
          {separadores.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => alterna(p.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${sel.includes(p.id) ? "bg-amber-400 text-[#141a4d]" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {p.nome}
            </button>
          ))}
          {outros.length > 0 && (
            <select
              value=""
              onChange={(e) => e.target.value && alterna(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500"
              aria-label="Outra pessoa"
            >
              <option value="">outra pessoa…</option>
              {outros.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          )}
          {sel
            .filter((id) => !separadores.some((p) => p.id === id))
            .map((id) => (
              <button key={id} type="button" onClick={() => alterna(id)} className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-semibold text-[#141a4d]">
                {nome(id)} ✕
              </button>
            ))}
        </div>
      </div>
    </form>
  );
}

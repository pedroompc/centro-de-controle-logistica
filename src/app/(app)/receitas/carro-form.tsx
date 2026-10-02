"use client";

import { useActionState, useState } from "react";
import { criarCarro } from "@/data/receitas";
import { valorDaNota } from "@/domain/receitas-metrics";
import { formatBRL, formatKg } from "@/domain/format";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import type { Fornecedor, PrecoDescarregamento, DescarregamentoTipo } from "@/domain/types";

const field =
  "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

interface NotaEditavel {
  chave: number;
  fornecedorId: string;
  tipo: DescarregamentoTipo;
  pesoKg: number;
  precoPorTonelada: number;
  quantidade: number;
  precoPorUnidade: number;
  fechado: boolean;
  valorFechado: number;
  isento: boolean;
  observacao: string;
}

/**
 * Lança UM carro (caminhão) com uma ou mais notas fiscais. O carro conta 1 na
 * contagem do dia; cada nota guarda o seu fornecedor, peso e valor.
 */
export function CarroForm({
  fornecedores,
  precos,
  mes,
  valorMinimo,
}: {
  fornecedores: Fornecedor[];
  precos: PrecoDescarregamento[];
  mes: string;
  valorMinimo: number;
}) {
  const precoDe = (t: DescarregamentoTipo) => precos.find((p) => p.tipo === t)?.precoPorTonelada ?? 0;
  const precoUnidadeDe = (t: DescarregamentoTipo) => precos.find((p) => p.tipo === t)?.precoPorUnidade ?? 0;
  const novaNota = (chave: number, base?: NotaEditavel): NotaEditavel => ({
    chave,
    fornecedorId: base?.fornecedorId ?? "",
    tipo: base?.tipo ?? "batido",
    pesoKg: 0,
    precoPorTonelada: base?.precoPorTonelada ?? precoDe("batido"),
    quantidade: 0,
    precoPorUnidade: base?.precoPorUnidade ?? precoUnidadeDe("volume"),
    fechado: false,
    valorFechado: 0,
    isento: base?.isento ?? false,
    observacao: "",
  });

  const [aberto, setAberto] = useState(false);
  const hoje = new Date().toLocaleDateString("en-CA"); // "yyyy-mm-dd" no fuso local
  const [data, setData] = useState(hoje.slice(0, 7) === mes.slice(0, 7) ? hoje : mes);
  const [notas, setNotas] = useState<NotaEditavel[]>(() => [novaNota(1)]);
  // Gravou: limpa as notas e deixa o formulário aberto para o próximo carro.
  const [estado, acao, enviando] = useActionState(async (anterior: Awaited<ReturnType<typeof criarCarro>>, fd: FormData) => {
    const r = await criarCarro(anterior, fd);
    if (r.ok) setNotas([novaNota(Date.now())]);
    return r;
  }, {});

  if (!aberto) {
    return (
      <button onClick={() => setAberto(true)} className="rounded-xl bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]">
        Lançar carro
      </button>
    );
  }

  const muda = (chave: number, p: Partial<NotaEditavel>) => setNotas((ns) => ns.map((n) => (n.chave === chave ? { ...n, ...p } : n)));
  const valor = (n: NotaEditavel) =>
    valorDaNota({ ...n, valorFechado: n.tipo === "volume" && n.fechado ? n.valorFechado || 0 : null }, valorMinimo);
  const totalValor = notas.reduce((t, n) => t + valor(n), 0);
  const totalPeso = notas.reduce((t, n) => t + (n.pesoKg || 0), 0);
  const payload = JSON.stringify(
    notas.map((n) => ({
      fornecedorId: n.fornecedorId,
      tipo: n.tipo,
      pesoKg: n.pesoKg,
      precoPorTonelada: n.precoPorTonelada,
      quantidade: n.quantidade,
      precoPorUnidade: n.precoPorUnidade,
      valorFechado: n.tipo === "volume" && n.fechado ? n.valorFechado : null,
      isento: n.isento,
      observacao: n.observacao,
    })),
  );

  return (
    <form action={acao} className="w-full space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-semibold text-[#141a4d]">Carro</span>
        <input name="data" type="date" required value={data} onChange={(e) => setData(e.target.value)} className={field} />
        <span className="text-xs text-slate-500">Várias notas no mesmo caminhão contam como 1 carro.</span>
      </div>
      <input type="hidden" name="notas" value={payload} />

      <ol className="space-y-2">
        {notas.map((n, i) => {
          const ehVolume = n.tipo === "volume";
          return (
            <li key={n.chave} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-2 ring-1 ring-slate-200">
              <span className="w-14 text-xs font-semibold text-slate-400">Nota {i + 1}</span>
              <select required value={n.fornecedorId} onChange={(e) => muda(n.chave, { fornecedorId: e.target.value })} className={`${field} max-w-[16rem]`}>
                <option value="" disabled>Fornecedor</option>
                {fornecedores.map((f) => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
              <select
                value={n.tipo}
                onChange={(e) => {
                  const t = e.target.value as DescarregamentoTipo;
                  muda(n.chave, t === "volume" ? { tipo: t, precoPorUnidade: precoUnidadeDe(t) } : { tipo: t, precoPorTonelada: precoDe(t) });
                }}
                className={field}
              >
                {TIPOS_DESCARREGAMENTO.map((t) => (
                  <option key={t} value={t}>{ROTULO_TIPO[t]}</option>
                ))}
              </select>
              <input type="number" step="0.001" min="0" required placeholder="Peso (kg)" value={n.pesoKg || ""} onChange={(e) => muda(n.chave, { pesoKg: Number(e.target.value) })} className={`${field} w-32`} />
              {ehVolume ? (
                <>
                  <input type="number" step="1" min="1" required placeholder="Caixas" value={n.quantidade || ""} onChange={(e) => muda(n.chave, { quantidade: Number(e.target.value) })} className={`${field} w-24`} />
                  {n.fechado ? (
                    <input type="number" step="0.01" min="0" required placeholder="Valor total R$" value={n.valorFechado || ""} onChange={(e) => muda(n.chave, { valorFechado: Number(e.target.value) })} className={`${field} w-32`} />
                  ) : (
                    <input type="number" step="0.01" min="0" required placeholder="R$/caixa" value={n.precoPorUnidade || ""} onChange={(e) => muda(n.chave, { precoPorUnidade: Number(e.target.value) })} className={`${field} w-28`} />
                  )}
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={n.fechado} onChange={(e) => muda(n.chave, { fechado: e.target.checked })} /> valor fechado
                  </label>
                </>
              ) : (
                <input type="number" step="0.01" min="0" required placeholder="R$/ton" value={n.precoPorTonelada || ""} onChange={(e) => muda(n.chave, { precoPorTonelada: Number(e.target.value) })} className={`${field} w-28`} />
              )}
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
                <input type="checkbox" checked={n.isento} onChange={(e) => muda(n.chave, { isento: e.target.checked })} /> Isento (FOB)
              </label>
              <input placeholder="Obs. (nº da NF…)" value={n.observacao} onChange={(e) => muda(n.chave, { observacao: e.target.value })} className={`${field} w-44`} />
              <span className={`ml-auto px-1 font-semibold tabular-nums ${n.isento ? "text-sky-700" : "text-emerald-700"}`}>
                {n.isento ? "Isento" : formatBRL(valor(n))}
              </span>
              {notas.length > 1 && (
                <button type="button" onClick={() => setNotas((ns) => ns.filter((x) => x.chave !== n.chave))} className="px-1 text-slate-400 hover:text-rose-600" aria-label={`Tirar nota ${i + 1}`}>
                  ✕
                </button>
              )}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setNotas((ns) => [...ns, novaNota(Date.now(), ns[ns.length - 1])])}
          className="rounded-xl border border-dashed border-slate-300 px-3 py-2 font-medium text-slate-600 hover:bg-white"
        >
          + Nota neste carro
        </button>
        <span className="ml-auto font-semibold text-[#141a4d]">
          1 carro · {notas.length} {notas.length === 1 ? "nota" : "notas"} · {formatKg(totalPeso)} · <span className="text-emerald-700">{formatBRL(totalValor)}</span>
        </span>
        <button disabled={enviando} className="rounded-xl bg-[#181d55] px-4 py-2 font-semibold text-white transition hover:bg-[#10143f] disabled:opacity-60">
          {enviando ? "Salvando…" : "Salvar carro"}
        </button>
        <button type="button" onClick={() => setAberto(false)} className="rounded-xl border border-slate-200 px-4 py-2 font-medium text-slate-600 hover:bg-white">
          Fechar
        </button>
      </div>
      {estado.erro && <p className="text-xs font-medium text-rose-600" aria-live="polite">{estado.erro}</p>}
      {estado.ok && !estado.erro && (
        <p className="text-xs font-medium text-emerald-700" aria-live="polite">
          Carro salvo com {estado.ok} {estado.ok === 1 ? "nota" : "notas"}. Pode lançar o próximo.
        </p>
      )}
    </form>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { formatBRL } from "@/domain/format";
import { setorPill } from "@/domain/devolucoes-ui";
import { resumirRetira, type LinhaRetira } from "@/domain/devolucoes-retira";
import { IconePredio, IconeBusca } from "./icons";

const dataBR = (iso: string) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—");

/** Dias entre a venda e a devolução (venda antiga devolvida agora chama atenção). */
function diasEntre(venda: string, dev: string): number {
  if (!venda || !dev) return 0;
  return Math.round((Date.parse(dev) - Date.parse(venda)) / 86_400_000);
}

function SeloDuplicada({ vezes }: { vezes: number }) {
  return (
    <span
      className="shrink-0 rounded-md bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
      title="A mesma NF de origem foi devolvida mais de uma vez e a soma passou do valor da nota — conferir se a entrada foi lançada em dobro"
    >
      Devolvida {vezes}×
    </span>
  );
}

function Origem({ l }: { l: LinhaRetira }) {
  const dias = diasEntre(l.dataVenda, l.dataDevolucao);
  return (
    <>
      <p className="font-semibold tabular-nums text-[#141a4d]">NF {l.nfOrigem}</p>
      <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">
        {dataBR(l.dataVenda)} · {formatBRL(l.valorNfOrigem)}
      </p>
      {dias > 30 && <p className="mt-0.5 text-[11px] font-semibold text-amber-700">vendida há {dias} dias</p>}
    </>
  );
}

export default function TabelaRetira({ linhas }: { linhas: LinhaRetira[] }) {
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return linhas;
    return linhas.filter((l) =>
      [l.cliente, l.motivo, l.rca, String(l.nfOrigem), String(l.nfDevolucao), String(l.codcli)].some((t) => t.toLowerCase().includes(q)),
    );
  }, [linhas, busca]);
  const r = useMemo(() => resumirRetira(lista), [lista]);
  const origensDuplicadas = useMemo(() => new Set(lista.filter((l) => l.duplicada).map((l) => l.nfOrigem)), [lista]);

  const campoBusca = (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <IconeBusca />
      </span>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Cliente, NF, motivo, RCA…"
        aria-label="Buscar devolução de retira"
        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50 sm:w-64"
      />
    </div>
  );

  const vazio = busca ? `Nenhuma devolução de retira para "${busca}".` : "Nenhuma devolução de retira no período.";

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconePredio />}
        tone="gold"
        title="Devoluções de retira"
        context="venda sem carga ou no balcão (DIALOG) · uma linha por NF de devolução"
        right={campoBusca}
      />

      <div className="grid grid-cols-3 gap-2.5 border-b border-slate-100 px-5 py-4">
        {[
          { rotulo: "Devolvido", valor: formatBRL(r.valor) },
          { rotulo: "NFs de devolução", valor: r.notas.toLocaleString("pt-BR") },
          { rotulo: "Clientes", valor: r.clientes.toLocaleString("pt-BR") },
        ].map((k) => (
          <div key={k.rotulo} className="rounded-xl bg-[#eef0fb] px-3.5 py-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">{k.rotulo}</p>
            <p className="mt-1 font-[family-name:var(--font-sora)] text-lg font-extrabold tabular-nums text-[#141a4d] sm:text-xl">{k.valor}</p>
          </div>
        ))}
      </div>

      {origensDuplicadas.size > 0 && (
        <div className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-800">
          <b>
            {origensDuplicadas.size === 1 ? "1 NF de origem devolvida" : `${origensDuplicadas.size} NFs de origem devolvidas`} mais de uma vez
          </b>{" "}
          (NF {[...origensDuplicadas].join(", ")}): {formatBRL(r.excessoDuplicado)} devolvidos acima do valor da nota. Conferir com o
          fiscal se a entrada foi lançada em dobro.
        </div>
      )}

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="min-w-[220px] px-4 py-3 text-left">Cliente</th>
              <th className="min-w-[200px] px-3 py-3 text-left">Motivo</th>
              <th className="px-3 py-3 text-left">NF origem</th>
              <th className="px-3 py-3 text-left">NF devolução</th>
              <th className="px-3 py-3 text-left">RCA</th>
              <th className="px-4 py-3 text-right">Devolvido</th>
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-slate-400">{vazio}</td>
              </tr>
            ) : (
              lista.map((l) => (
                <tr key={l.numTransEnt} className={`border-b border-slate-100 align-top ${l.duplicada ? "bg-rose-50/60" : "hover:bg-slate-50/50"}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium leading-snug text-[#141a4d]">{l.cliente}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Cód. {l.codcli}
                      {l.balcao && " · balcão (DIALOG)"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="leading-snug text-slate-700">{l.motivo}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${setorPill(l.setor)}`}>{l.setor}</span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-start gap-2">
                      <div><Origem l={l} /></div>
                      {l.duplicada && <SeloDuplicada vezes={l.devolucoesDaOrigem} />}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-semibold tabular-nums text-[#141a4d]">NF {l.nfDevolucao}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-slate-500">{dataBR(l.dataDevolucao)}</p>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{l.rca}</td>
                  <td className="px-4 py-3 text-right font-[family-name:var(--font-sora)] text-base font-extrabold tabular-nums text-[#141a4d]">
                    {formatBRL(l.valor)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {lista.length > 0 && (
            <tfoot className="border-t border-slate-200 bg-slate-50">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Total</td>
                <td className="px-4 py-3 text-right font-[family-name:var(--font-sora)] text-base font-extrabold tabular-nums text-[#141a4d]">
                  {formatBRL(r.valor)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {lista.length === 0 ? (
          <li className="py-12 text-center text-sm text-slate-400">{vazio}</li>
        ) : (
          lista.map((l) => (
            <li key={l.numTransEnt} className={`px-4 py-3 ${l.duplicada ? "bg-rose-50/60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium leading-snug text-[#141a4d]">{l.cliente}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{l.motivo}</p>
                </div>
                <p className="shrink-0 font-[family-name:var(--font-sora)] text-base font-extrabold tabular-nums text-[#141a4d]">{formatBRL(l.valor)}</p>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span>
                  Origem <b className="tabular-nums text-slate-700">NF {l.nfOrigem}</b> · {dataBR(l.dataVenda)}
                </span>
                <span>
                  Devolução <b className="tabular-nums text-slate-700">NF {l.nfDevolucao}</b> · {dataBR(l.dataDevolucao)}
                </span>
                <span>RCA {l.rca}</span>
                {l.duplicada && <SeloDuplicada vezes={l.devolucoesDaOrigem} />}
              </div>
            </li>
          ))
        )}
      </ul>
    </Card>
  );
}

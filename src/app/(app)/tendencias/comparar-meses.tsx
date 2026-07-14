"use client";

import { useState } from "react";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { variacaoPercentual, variacaoPP } from "@/domain/tendencias";
import { Card, SectionTitle } from "@/components/ui";
import { CORES } from "./widgets";

export interface MesComparavel {
  rotulo: string;
  vendaLiquida: number;
  valorDevolucao: number;
  pesoDevolucao: number;
  taxa: number; // 0..1
}

const pctComSinal = (frac: number) => `${frac >= 0 ? "+" : "−"}${formatPercent(Math.abs(frac))}`;
const ppComSinal = (pp: number) =>
  `${pp >= 0 ? "+" : "−"}${Math.abs(pp).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;

function Select({ valor, onChange, meses }: { valor: number; onChange: (i: number) => void; meses: MesComparavel[] }) {
  return (
    <select value={valor} onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#141a4d] outline-none focus:border-[#1b2168]">
      {meses.map((m, i) => <option key={i} value={i}>{m.rotulo}</option>)}
    </select>
  );
}

export function CompararMeses({ meses }: { meses: MesComparavel[] }) {
  const [ia, setIa] = useState(Math.max(0, meses.length - 2));
  const [ib, setIb] = useState(meses.length - 1);
  const A = meses[ia], B = meses[ib];

  const linhas = [
    { nome: "Venda líquida", cor: CORES.venda, va: A.vendaLiquida, vb: B.vendaLiquida, fmt: formatBRL, maiorMelhor: true, pp: false },
    { nome: "Valor devolvido", cor: CORES.devolucao, va: A.valorDevolucao, vb: B.valorDevolucao, fmt: formatBRL, maiorMelhor: false, pp: false },
    { nome: "Peso devolvido", cor: CORES.peso, va: A.pesoDevolucao, vb: B.pesoDevolucao, fmt: formatKg, maiorMelhor: false, pp: false },
    { nome: "Taxa de devolução", cor: CORES.taxa, va: A.taxa, vb: B.taxa, fmt: (v: number) => formatPercent(v), maiorMelhor: false, pp: true },
  ];

  return (
    <Card className="p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SectionTitle>Comparar meses</SectionTitle>
        <div className="flex items-center gap-2">
          <Select valor={ia} onChange={setIa} meses={meses} />
          <span className="text-sm text-slate-400">vs</span>
          <Select valor={ib} onChange={setIb} meses={meses} />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs uppercase tracking-wider text-slate-400">
              <th className="py-2 pr-4 text-left font-semibold">Indicador</th>
              <th className="px-4 py-2 text-right font-semibold">{A.rotulo}</th>
              <th className="px-4 py-2 text-right font-semibold">{B.rotulo}</th>
              <th className="py-2 pl-4 text-right font-semibold">Diferença</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {linhas.map((l) => {
              const subindo = l.vb > l.va;
              const positivo = l.maiorMelhor ? subindo : !subindo;
              const texto = l.pp ? ppComSinal(variacaoPP(l.vb, l.va)) : pctComSinal(variacaoPercentual(l.vb, l.va));
              const cor = l.va === l.vb ? "#64748b" : positivo ? CORES.positivo : CORES.negativo;
              return (
                <tr key={l.nome}>
                  <td className="py-3 pr-4">
                    <span className="flex items-center gap-2 font-medium text-[#141a4d]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: l.cor }} />
                      {l.nome}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-500">{l.fmt(l.va)}</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-[#141a4d]">{l.fmt(l.vb)}</td>
                  <td className="py-3 pl-4 text-right">
                    <span className="inline-flex items-center justify-end gap-1 font-bold tabular-nums" style={{ color: cor }}>
                      {l.va !== l.vb && <span aria-hidden="true">{subindo ? "↑" : "↓"}</span>}
                      {texto}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

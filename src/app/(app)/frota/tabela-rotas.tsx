"use client";

import { useMemo, useState } from "react";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import type { RotaMotorista } from "@/domain/telemetria";

type Linha = RotaMotorista & { taxa: number | null };

const inteiro = new Intl.NumberFormat("pt-BR");

/** "Rotas do motorista que mais geraram devolução", com os filtros de rota e motorista do Flask. */
export default function TabelaRotas({ linhas }: { linhas: Linha[] }) {
  const [rota, setRota] = useState("");
  const [mot, setMot] = useState("");
  const rotas = useMemo(() => [...new Set(linhas.map((l) => l.cidade))].sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);
  const motoristas = useMemo(() => [...new Set(linhas.map((l) => l.motorista))].sort((a, b) => a.localeCompare(b, "pt-BR")), [linhas]);
  const visiveis = linhas.filter((l) => (!rota || l.cidade === rota) && (!mot || l.motorista === mot));
  const sel = "w-full min-w-[140px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-700 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";
  const th = "p-3 font-semibold text-slate-700";
  const td = "p-3";

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Rotas do motorista que mais geraram devolução</h3>
        <span className="text-xs font-medium text-slate-500">{inteiro.format(visiveis.length)} rotas com devolução</span>
      </div>

      {/* Mobile: filtros acima dos cartões */}
      <div className="grid grid-cols-2 gap-2 md:hidden">
        <select value={rota} onChange={(e) => setRota(e.target.value)} aria-label="Rota" className={sel}>
          <option value="">Todas as rotas</option>
          {rotas.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={mot} onChange={(e) => setMot(e.target.value)} aria-label="Motorista" className={sel}>
          <option value="">Todos os motoristas</option>
          {motoristas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="hidden max-h-[560px] overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full whitespace-nowrap text-left text-sm text-slate-600">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-slate-200 bg-[#F4F7FA]">
              <th className={th}>Rota / destino</th>
              <th className={th}>Motorista</th>
              <th className={`${th} text-right`}>Cargas</th>
              <th className={`${th} text-right`}>Peso faturado</th>
              <th className={`${th} text-right`}>Valor faturado</th>
              <th className={`${th} text-right text-rose-600`}>Devolvido</th>
              <th className={`${th} text-right text-rose-600`}>Taxa dev.</th>
            </tr>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="p-2">
                <select value={rota} onChange={(e) => setRota(e.target.value)} aria-label="Filtrar rota" className={sel}>
                  <option value="">Todas as rotas</option>
                  {rotas.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </th>
              <th className="p-2">
                <select value={mot} onChange={(e) => setMot(e.target.value)} aria-label="Filtrar motorista" className={sel}>
                  <option value="">Todos os motoristas</option>
                  {motoristas.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </th>
              <th colSpan={5} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visiveis.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-sm text-slate-400">Nenhuma rota com devolução nesse filtro.</td></tr>
            ) : (
              visiveis.map((l) => (
                <tr key={`${l.codMotorista}-${l.ibge ?? l.cidade}`} className="hover:bg-slate-50">
                  <td className={`${td} max-w-[16rem] truncate font-medium text-[#141a4d]`} title={l.cidade}>{l.cidade}</td>
                  <td className={`${td} max-w-[14rem] truncate`} title={l.motorista}>{l.motorista}</td>
                  <td className={`${td} text-right tabular-nums`}>{inteiro.format(l.cargas)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatKg(l.peso)}</td>
                  <td className={`${td} text-right tabular-nums`}>{formatBRL(l.valor)}</td>
                  <td className={`${td} text-right font-semibold tabular-nums text-rose-600`}>{formatBRL(l.devolvido)}</td>
                  <td className={`${td} text-right tabular-nums text-rose-600`}>{l.taxa === null ? "—" : formatPercent(l.taxa, 2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white md:hidden">
        {visiveis.slice(0, 200).map((l) => (
          <li key={`${l.codMotorista}-${l.ibge ?? l.cidade}`} className="px-3 py-2.5">
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-[#141a4d]">{l.cidade}</p>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-rose-600">{formatBRL(l.devolvido)}</span>
            </div>
            <p className="mt-0.5 truncate text-xs text-slate-500">{l.motorista} · {l.cargas} cargas · {l.taxa === null ? "—" : formatPercent(l.taxa, 2)} devolvido</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

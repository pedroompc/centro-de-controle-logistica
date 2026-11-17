"use client";

import { useState, Fragment } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { formatBRL, formatPercent } from "@/domain/format";
import { taxaSobreLiquido, totalPastas } from "@/domain/devolucoes-supervisor";
import type { PastaDevolucao, ValoresPorSetor } from "@/domain/devolucoes-supervisor";
import type { BaseDevolucao } from "@/domain/devolucoes-dia-semana";
import { IconeUsuario, IconePredio, IconeChevronCima, IconeChevronBaixo } from "./icons";

/** Linha exibida: pasta, supervisor ou o total — mesmos campos. */
interface Valores {
  liquido: number;
  devolucao: number;
  setores: ValoresPorSetor;
}

const corTaxaLiquido = (t: number) => (t >= 0.08 ? "text-rose-600" : t >= 0.05 ? "text-amber-600" : "text-slate-600");

const outros = (s: ValoresPorSetor) => s.Faturamento + s["Não classificado"];

/** Célula de setor: taxa sobre o líquido em cima, R$ embaixo. */
function CelulaSetor({ valor, liquido }: { valor: number; liquido: number }) {
  return (
    <td className="px-3 py-2.5 text-right tabular-nums">
      <span className="block font-semibold text-slate-700">{valor ? formatPercent(taxaSobreLiquido(valor, liquido), 2) : "—"}</span>
      {valor > 0 && <span className="block text-[11px] text-slate-400">{formatBRL(valor)}</span>}
    </td>
  );
}

function Colunas({ v, forte }: { v: Valores; forte?: boolean }) {
  const taxa = taxaSobreLiquido(v.devolucao, v.liquido);
  return (
    <>
      <td className={`px-3 py-2.5 text-right tabular-nums text-[#141a4d] ${forte ? "font-semibold" : ""}`}>{formatBRL(v.liquido)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{formatBRL(v.devolucao)}</td>
      <td className={`px-3 py-2.5 text-right text-base font-bold tabular-nums ${corTaxaLiquido(taxa)}`}>{formatPercent(taxa, 2)}</td>
      <CelulaSetor valor={v.setores.Comercial} liquido={v.liquido} />
      <CelulaSetor valor={v.setores.Logística} liquido={v.liquido} />
      <CelulaSetor valor={outros(v.setores)} liquido={v.liquido} />
    </>
  );
}

/** Resumo compacto do card mobile. */
function ResumoMobile({ v }: { v: Valores }) {
  const t = (x: number) => formatPercent(taxaSobreLiquido(x, v.liquido), 2);
  return (
    <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
      <span>Líquido <b className="tabular-nums text-slate-700">{formatBRL(v.liquido)}</b></span>
      <span>Comercial <b className="tabular-nums text-slate-700">{t(v.setores.Comercial)}</b></span>
      <span>Logística <b className="tabular-nums text-slate-700">{t(v.setores.Logística)}</b></span>
    </div>
  );
}

export default function TabelaSupervisores({ pastas, base }: { pastas: PastaDevolucao[]; base: BaseDevolucao }) {
  const [abertas, setAbertas] = useState<Set<string>>(new Set());
  const toggle = (p: string) =>
    setAbertas((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  // Pasta com um único supervisor de mesmo nome não tem o que abrir.
  const abre = (p: PastaDevolucao) => p.supervisores.length > 1 || p.supervisores[0]?.nome !== p.pasta;
  const total = totalPastas(pastas);
  const th = "px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500";

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconeUsuario />}
        tone="gold"
        title="Devolução por supervisor"
        context={`${pastas.length} pastas · taxas sobre o faturamento líquido · ${base === "faturamento" ? "dia faturado" : "data da devolução"}`}
      />

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="min-w-[220px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Pasta / supervisor</th>
              <th className={th}>Fat. líquido</th>
              <th className={th}>Devolução</th>
              <th className={th}>Taxa</th>
              <th className={th}>Comercial</th>
              <th className={th}>Logística</th>
              <th className={th} title="Faturamento + não classificado">Outros</th>
            </tr>
          </thead>
          <tbody>
            {pastas.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-slate-400">Sem faturamento no período.</td>
              </tr>
            ) : (
              pastas.map((p) => {
                const expansivel = abre(p);
                const aberta = abertas.has(p.pasta);
                return (
                  <Fragment key={p.pasta}>
                    <tr
                      onClick={expansivel ? () => toggle(p.pasta) : undefined}
                      aria-expanded={expansivel ? aberta : undefined}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 ${aberta ? "bg-amber-50/40" : ""} ${expansivel ? "cursor-pointer" : ""}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <span className="w-4 shrink-0 text-slate-400">
                            {expansivel && (aberta ? <IconeChevronCima className="h-4 w-4" /> : <IconeChevronBaixo className="h-4 w-4" />)}
                          </span>
                          <div className="shrink-0 rounded-lg bg-[#eef0fb] p-1.5 text-[#1b2168]">
                            <IconePredio />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold leading-none text-[#141a4d]">{p.pasta}</p>
                            <p className="mt-0.5 text-[11px] text-slate-400">
                              {p.supervisores.length} {p.supervisores.length === 1 ? "supervisor" : "supervisores"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <Colunas v={p} forte />
                    </tr>
                    {aberta &&
                      p.supervisores.map((s) => (
                        <tr key={s.cod} className="border-b border-slate-100 bg-slate-50/60">
                          <td className="py-2 pl-[4.25rem] pr-3">
                            <p className="truncate text-[13px] font-medium text-[#141a4d]">{s.nome}</p>
                            <p className="text-[11px] text-slate-400">Cód. {s.cod}</p>
                          </td>
                          <Colunas v={s} />
                        </tr>
                      ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
          {pastas.length > 0 && (
            <tfoot className="border-t-2 border-slate-200 bg-slate-50">
              <tr>
                <td className="px-3 py-3 pl-[2.75rem] font-bold text-[#141a4d]">Total</td>
                <Colunas v={total} forte />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {pastas.length === 0 ? (
          <li className="py-12 text-center text-sm text-slate-400">Sem faturamento no período.</li>
        ) : (
          [...pastas.map((p) => ({ p, total: false })), { p: { pasta: "Total", supervisores: [], ...total } as PastaDevolucao, total: true }].map(({ p, total: ehTotal }) => {
            const expansivel = !ehTotal && abre(p);
            const aberta = abertas.has(p.pasta);
            const taxa = taxaSobreLiquido(p.devolucao, p.liquido);
            return (
              <li key={p.pasta} className={ehTotal ? "bg-slate-50" : aberta ? "bg-amber-50/40" : ""}>
                <div onClick={expansivel ? () => toggle(p.pasta) : undefined} className={`px-4 py-3 ${expansivel ? "cursor-pointer" : ""}`}>
                  <div className="flex items-center gap-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={`truncate leading-tight text-[#141a4d] ${ehTotal ? "font-bold" : "font-semibold"}`}>{p.pasta}</p>
                      {!ehTotal && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {p.supervisores.length} {p.supervisores.length === 1 ? "supervisor" : "supervisores"} · {formatBRL(p.devolucao)}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-lg font-bold leading-none tabular-nums ${corTaxaLiquido(taxa)}`}>{formatPercent(taxa, 2)}</p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">taxa</p>
                    </div>
                    {expansivel &&
                      (aberta ? <IconeChevronCima className="h-4 w-4 shrink-0 text-slate-400" /> : <IconeChevronBaixo className="h-4 w-4 shrink-0 text-slate-400" />)}
                  </div>
                  <ResumoMobile v={p} />
                </div>
                {aberta && (
                  <ul className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/60">
                    {p.supervisores.map((s) => {
                      const ts = taxaSobreLiquido(s.devolucao, s.liquido);
                      return (
                        <li key={s.cod} className="py-2.5 pl-8 pr-4">
                          <div className="flex items-center gap-2">
                            <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#141a4d]">{s.nome}</p>
                            <span className={`shrink-0 font-bold tabular-nums ${corTaxaLiquido(ts)}`}>{formatPercent(ts, 2)}</span>
                          </div>
                          <ResumoMobile v={s} />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}

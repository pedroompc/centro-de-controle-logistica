"use client";

import { useState } from "react";
import { formatBRL } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { rotuloTurno, type SinalOperador } from "@/domain/separacao";
import { TURNOS_SEPARACAO } from "@/domain/turnos-separacao";
import type { Turno } from "@/domain/types";
import { Bloco, ChipTV, Mini } from "./bi-ui";
import { COR_TURNO, GRADE_CARDS, VISAO, n0, n1, ou, sinalPct, varRel } from "./bi-separacao-comum";
import type { DadosIndividuais, SeparadorBI } from "./separacao-dados";

type Ordem = "linhasPorHora" | "linhas" | "kgPorHora" | "errosPorMil";
const ORDENS: Record<Ordem, { rotulo: string; valor: (s: SeparadorBI) => number | null; desc: boolean }> = {
  linhasPorHora: { rotulo: "Endereços/hora", valor: (s) => s.linhasPorHora, desc: true },
  kgPorHora: { rotulo: "Kg/hora", valor: (s) => s.kgPorHora, desc: true },
  linhas: { rotulo: "Volume", valor: (s) => s.linhas, desc: true },
  errosPorMil: { rotulo: "Erros", valor: (s) => s.errosPorMil, desc: false },
};

const SINAL: Record<Exclude<SinalOperador, null>, { rotulo: string; cls: string; dica: string }> = {
  evolucao: { rotulo: "↑ evolução", cls: "text-amber-300", dica: "endereços/hora 10%+ acima do próprio mês anterior" },
  queda: { rotulo: "↓ queda", cls: "text-rose-300", dica: "endereços/hora 10%+ abaixo do próprio mês anterior" },
  atencao: { rotulo: "avaliar", cls: "text-orange-300", dica: "abaixo de 80% da média do turno com perfil de endereço parecido — verificar função, jornada, experiência e tipo de mapa antes de concluir" },
};

export function VisaoOperadores({ ind, mes }: { ind: DadosIndividuais; mes: string }) {
  const [aba, setAba] = useState<"separadores" | "conferentes">("separadores");
  const [turno, setTurno] = useState<Turno | null>(null);
  const [ordem, setOrdem] = useState<Ordem>("linhasPorHora");
  const o = ORDENS[ordem];
  const lista = ind.separadores
    .filter((s) => !turno || s.turno === turno)
    .sort((a, b) => Number(b.amostraSuficiente) - Number(a.amostraSuficiente) || ((o.valor(b) ?? -Infinity) - (o.valor(a) ?? -Infinity)) * (o.desc ? 1 : -1));
  let pos = 0;
  const comAmostra = ind.separadores.filter((s) => s.amostraSuficiente);

  return (
    <div className={`${VISAO} xl:grid-rows-[auto_minmax(20rem,1fr)]`}>
      <div className={GRADE_CARDS}>
        <Mini rotulo="Separadores" valor={String(ind.separadores.length)} sub={`${comAmostra.length} no ranking`} />
        <Mini rotulo="Endereços/hora · geral" valor={ou(ind.mediaGeral, n1)} />
        {TURNOS_SEPARACAO.map((t) => (
          <Mini key={t.id} rotulo={`Média · ${t.rotulo}`} valor={ou(ind.mediaTurno[t.id], n1)} sub={ind.kgPorLinhaTurno[t.id] === null ? "sem registro" : `${n1(ind.kgPorLinhaTurno[t.id]!)} kg/endereço`} />
        ))}
        <Mini rotulo="Conferentes" valor={String(ind.conferentes.length)} />
      </div>
      <Bloco
        titulo={aba === "separadores" ? `Separadores · ${formatMesAno(mes)}` : `Conferentes · ${formatMesAno(mes)}`}
        direita={
          <div className="flex flex-wrap items-center gap-1.5">
            <ChipTV ativo={aba === "separadores"} onClick={() => setAba("separadores")}>
              separadores
            </ChipTV>
            <ChipTV ativo={aba === "conferentes"} onClick={() => setAba("conferentes")}>
              conferentes
            </ChipTV>
            {aba === "separadores" && (
              <>
                <span className="mx-1 text-white/20">|</span>
                {TURNOS_SEPARACAO.map((t) => (
                  <ChipTV key={t.id} ativo={turno === t.id} onClick={() => setTurno(turno === t.id ? null : t.id)}>
                    {t.rotulo}
                  </ChipTV>
                ))}
                <span className="mx-1 text-white/20">|</span>
                {(Object.keys(ORDENS) as Ordem[]).map((k) => (
                  <ChipTV key={k} ativo={ordem === k} onClick={() => setOrdem(k)}>
                    {ORDENS[k].rotulo}
                  </ChipTV>
                ))}
              </>
            )}
          </div>
        }
      >
        <div className="h-full overflow-auto pr-1">
          {aba === "separadores" ? (
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 bg-[#121a5a] text-[0.6rem] uppercase tracking-[0.1em] text-white/40">
                <tr>
                  <th className="w-8 py-2 text-left font-semibold">#</th>
                  <th className="py-2 text-left font-semibold">Separador</th>
                  <th className="py-2 text-right font-semibold">Dias</th>
                  <th className="py-2 text-right font-semibold">Horas ativas</th>
                  <th className="py-2 text-right font-semibold">Endereços</th>
                  <th className="py-2 text-right font-semibold">Kg</th>
                  <th className="py-2 text-right font-semibold">End./h</th>
                  <th className="py-2 text-right font-semibold">× turno</th>
                  <th className="py-2 text-right font-semibold">× geral</th>
                  <th className="py-2 text-right font-semibold">× {ind.mesAnterior ? formatMesAno(ind.mesAnterior).slice(0, 3) : "ant."}</th>
                  <th className="py-2 text-right font-semibold">Kg/end.</th>
                  <th className="py-2 text-right font-semibold">Erros ‰</th>
                  <th className="py-2 text-right font-semibold">R$/end.</th>
                  <th className="py-2 text-right font-semibold">Sinal</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s) => {
                  const mt = s.turno ? ind.mediaTurno[s.turno] : null;
                  return (
                    <tr key={s.usuario} className={`border-t border-white/[0.06] ${s.amostraSuficiente ? "" : "text-white/40"}`}>
                      <td className="py-1.5 tabular-nums text-white/40">{s.amostraSuficiente ? ++pos : "·"}</td>
                      <td className="py-1.5 pr-3">
                        <div className="flex items-baseline gap-2">
                          <span className={`font-semibold ${s.amostraSuficiente ? "text-white" : ""}`}>{s.nome}</span>
                          <span className="shrink-0 text-[0.65rem]" style={{ color: s.turno ? COR_TURNO[s.turno] : undefined }}>
                            {s.turno ? rotuloTurno(s.turno).toLowerCase() : "sem cadastro"}
                          </span>
                        </div>
                      </td>
                      <td className="py-1.5 text-right tabular-nums">{s.dias}</td>
                      <td className="py-1.5 text-right tabular-nums">{n1(s.horasAtivas)}</td>
                      <td className="py-1.5 text-right tabular-nums">{n0(s.linhas)}</td>
                      <td className="py-1.5 text-right tabular-nums">{n0(s.kg)}</td>
                      <td className={`py-1.5 text-right font-bold tabular-nums ${s.amostraSuficiente ? "text-white" : ""}`}>{ou(s.linhasPorHora, n1)}</td>
                      <td className="py-1.5 text-right tabular-nums">{sinalPct(varRel(s.linhasPorHora, mt))}</td>
                      <td className="py-1.5 text-right tabular-nums">{sinalPct(varRel(s.linhasPorHora, ind.mediaGeral))}</td>
                      <td className="py-1.5 text-right tabular-nums">{sinalPct(varRel(s.linhasPorHora, s.anteriorLinhasPorHora))}</td>
                      <td className="py-1.5 text-right tabular-nums">{ou(s.kgPorLinha, n1)}</td>
                      <td className="py-1.5 text-right tabular-nums">{ou(s.errosPorMil, n1)}</td>
                      <td className="py-1.5 text-right tabular-nums">{ou(s.custoPorLinha, formatBRL)}</td>
                      <td className="py-1.5 text-right text-xs">
                        {s.sinal ? (
                          <span className={SINAL[s.sinal].cls} title={SINAL[s.sinal].dica}>
                            {SINAL[s.sinal].rotulo}
                          </span>
                        ) : (
                          ""
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 bg-[#121a5a] text-[0.6rem] uppercase tracking-[0.1em] text-white/40">
                <tr>
                  <th className="py-2 text-left font-semibold">Conferente</th>
                  <th className="py-2 text-right font-semibold">Dias</th>
                  <th className="py-2 text-right font-semibold">Horas na doca</th>
                  <th className="py-2 text-right font-semibold">Mapas</th>
                  <th className="py-2 text-right font-semibold">Bipagens</th>
                  <th className="py-2 text-right font-semibold">Unidades</th>
                  <th className="py-2 text-right font-semibold">Unidades/h</th>
                </tr>
              </thead>
              <tbody>
                {ind.conferentes.map((c) => (
                  <tr key={c.usuario} className="border-t border-white/[0.06]">
                    <td className="py-1.5 pr-3">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold text-white">{c.nome}</span>
                        <span className="shrink-0 text-[0.65rem]" style={{ color: c.turno ? COR_TURNO[c.turno] : undefined }}>
                          {c.turno ? rotuloTurno(c.turno).toLowerCase() : "sem cadastro"}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-white/75">{c.dias}</td>
                    <td className="py-1.5 text-right tabular-nums text-white/75">{n1(c.horas)}</td>
                    <td className="py-1.5 text-right tabular-nums text-white/75">{n0(c.mapas)}</td>
                    <td className="py-1.5 text-right tabular-nums text-white/75">{n0(c.bipagens)}</td>
                    <td className="py-1.5 text-right tabular-nums text-white/75">{n0(c.unidades)}</td>
                    <td className="py-1.5 text-right font-bold tabular-nums text-white">{ou(c.unidadesPorHora, n0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Bloco>
    </div>
  );
}

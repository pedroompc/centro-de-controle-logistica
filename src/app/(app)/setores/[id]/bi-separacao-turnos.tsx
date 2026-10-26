"use client";

import { useState, type ReactNode } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import type { CriterioTurno, ResumoTurno } from "@/domain/separacao";
import type { TurnoSep } from "@/domain/turnos-separacao";
import { Bloco, ChipTV, Mini, ddmm, semCentavos } from "./bi-ui";
import { Aviso, COR_TURNO, VISAO, n0, n1, t1, sinalPct, varRel } from "./bi-separacao-comum";
import type { DivergenciasTurno } from "./separacao-dados";

type Sentido = "maior" | "menor" | null; // qual direção é melhor (null = só descritivo)
interface LinhaComparativo {
  grupo: string;
  rotulo: string;
  valor: (t: ResumoTurno) => number | null;
  fmt: (v: number) => string;
  sentido: Sentido;
  total?: (ts: ResumoTurno[]) => number | null;
}

const soma = (f: (t: ResumoTurno) => number | null) => (ts: ResumoTurno[]) => ts.reduce((s, t) => s + (f(t) ?? 0), 0);
const razao = (a: (t: ResumoTurno) => number | null, b: (t: ResumoTurno) => number | null, k = 1) => (ts: ResumoTurno[]) => {
  const den = soma(b)(ts)!;
  return den > 0 ? (soma(a)(ts)! / den) * k : null;
};

const LINHAS: LinhaComparativo[] = [
  { grupo: "Equipe", rotulo: "Pessoas no turno", valor: (t) => t.equipe.pessoas, fmt: n0, sentido: null, total: soma((t) => t.equipe.pessoas) },
  { grupo: "Equipe", rotulo: "Separadores", valor: (t) => t.equipe.separadores, fmt: n0, sentido: null, total: soma((t) => t.equipe.separadores) },
  { grupo: "Equipe", rotulo: "Conferentes", valor: (t) => t.equipe.conferentes, fmt: n0, sentido: null, total: soma((t) => t.equipe.conferentes) },
  { grupo: "Equipe", rotulo: "Dias com produção", valor: (t) => t.dias, fmt: n0, sentido: null },
  { grupo: "Equipe", rotulo: "Horas disponíveis", valor: (t) => t.horasDisponiveis, fmt: n0, sentido: null, total: soma((t) => t.horasDisponiveis) },
  { grupo: "Média por dia trabalhado", rotulo: "Toneladas", valor: (t) => (t.porDia ? t.porDia.kg / 1000 : null), fmt: (v) => `${n1(v)} t`, sentido: null },
  { grupo: "Média por dia trabalhado", rotulo: "Endereços visitados", valor: (t) => t.porDia?.linhas ?? null, fmt: n0, sentido: null },
  { grupo: "Média por dia trabalhado", rotulo: "SKUs", valor: (t) => t.porDia?.skus ?? null, fmt: n0, sentido: null },
  { grupo: "Média por dia trabalhado", rotulo: "Pedidos", valor: (t) => t.porDia?.pedidos ?? null, fmt: n0, sentido: null },
  { grupo: "Média por dia trabalhado", rotulo: "Caixas", valor: (t) => t.porDia?.caixas ?? null, fmt: n0, sentido: null },
  { grupo: "Produção", rotulo: "Endereços visitados", valor: (t) => t.linhas, fmt: n0, sentido: "maior", total: soma((t) => t.linhas) },
  { grupo: "Produção", rotulo: "Participação nos endereços", valor: (t) => t.participacaoLinhas, fmt: (v) => formatPercent(v, 0), sentido: null },
  { grupo: "Produção", rotulo: "Pedidos", valor: (t) => t.pedidos, fmt: n0, sentido: "maior", total: soma((t) => t.pedidos) },
  { grupo: "Produção", rotulo: "Peso", valor: (t) => t.kg, fmt: t1, sentido: "maior", total: soma((t) => t.kg) },
  { grupo: "Produção", rotulo: "Caixas fechadas", valor: (t) => t.caixas, fmt: n0, sentido: null, total: soma((t) => t.caixas) },
  { grupo: "Produção", rotulo: "Unidades", valor: (t) => t.unidades, fmt: n0, sentido: null, total: soma((t) => t.unidades) },
  { grupo: "Produção", rotulo: "Clientes (PDV-dia)", valor: (t) => t.clientes, fmt: n0, sentido: null, total: soma((t) => t.clientes) },
  { grupo: "Produtividade", rotulo: "Endereços por hora disponível", valor: (t) => t.linhasPorHora, fmt: n1, sentido: "maior", total: razao((t) => t.linhas, (t) => t.horasDisponiveis) },
  { grupo: "Produtividade", rotulo: "Kg por hora disponível", valor: (t) => t.kgPorHora, fmt: n0, sentido: "maior", total: razao((t) => t.kg, (t) => t.horasDisponiveis) },
  { grupo: "Produtividade", rotulo: "Pedidos por hora disponível", valor: (t) => t.pedidosPorHora, fmt: n1, sentido: "maior", total: razao((t) => t.pedidos, (t) => t.horasDisponiveis) },
  { grupo: "Produtividade", rotulo: "Endereços por separador por dia", valor: (t) => t.linhasPorSeparadorDia, fmt: n0, sentido: "maior" },
  { grupo: "Custo", rotulo: "Custo do período", valor: (t) => t.custo, fmt: semCentavos, sentido: null, total: soma((t) => t.custo) },
  { grupo: "Custo", rotulo: "Participação no custo", valor: (t) => t.participacaoCusto, fmt: (v) => formatPercent(v, 0), sentido: null },
  { grupo: "Custo", rotulo: "Custo por pedido", valor: (t) => t.custoPorPedido, fmt: formatBRL, sentido: "menor", total: razao((t) => t.custo, (t) => t.pedidos) },
  { grupo: "Custo", rotulo: "Custo por endereço", valor: (t) => t.custoPorLinha, fmt: formatBRL, sentido: "menor", total: razao((t) => t.custo, (t) => t.linhas) },
  { grupo: "Custo", rotulo: "Custo por tonelada", valor: (t) => t.custoPorTonelada, fmt: semCentavos, sentido: "menor", total: razao((t) => t.custo, (t) => t.kg, 1000) },
  { grupo: "Qualidade", rotulo: "Itens com erro do separador", valor: (t) => t.errosSeparador, fmt: n0, sentido: null, total: soma((t) => t.errosSeparador) },
  { grupo: "Qualidade", rotulo: "Erros a cada 1.000 endereços", valor: (t) => t.errosPorMil, fmt: n1, sentido: "menor", total: razao((t) => t.errosSeparador, (t) => t.linhas, 1000) },
  { grupo: "Perfil do trabalho", rotulo: "Kg por endereço", valor: (t) => t.kgPorLinha, fmt: n1, sentido: null, total: razao((t) => t.kg, (t) => t.linhas) },
  { grupo: "Perfil do trabalho", rotulo: "Unidades por endereço", valor: (t) => t.unidadesPorLinha, fmt: n1, sentido: null, total: razao((t) => t.unidades, (t) => t.linhas) },
  { grupo: "Perfil do trabalho", rotulo: "Endereços em mapa consolidado", valor: (t) => t.mapasConsolidados, fmt: (v) => formatPercent(v, 0), sentido: null },
  { grupo: "Origem do dado", rotulo: "Endereços com separador registrado", valor: (t) => (t.linhas ? t.linhasComSeparador / t.linhas : null), fmt: (v) => formatPercent(v, 0), sentido: null },
  { grupo: "Origem do dado", rotulo: "TurnoSep pelo cadastro", valor: (t) => (t.linhas ? t.linhasPorOperador / t.linhas : null), fmt: (v) => formatPercent(v, 0), sentido: null },
];

const CRITERIOS: { id: CriterioTurno; rotulo: string; explica: string }[] = [
  { id: "producao", rotulo: "Maior produção total", explica: "endereços visitados (absoluto — depende de gente e horas)" },
  { id: "linhasPorHora", rotulo: "Maior produtividade por hora", explica: "endereços ÷ horas disponíveis" },
  { id: "linhasPorSeparadorDia", rotulo: "Maior produtividade por separador", explica: "endereços ÷ separadores ÷ dias" },
  { id: "custoPorPedido", rotulo: "Menor custo por pedido", explica: "custo do turno ÷ pedidos (rateio)" },
  { id: "custoPorTonelada", rotulo: "Menor custo por tonelada", explica: "custo do turno ÷ t" },
  { id: "qualidade", rotulo: "Melhor qualidade", explica: "menos erros do separador a cada 1.000 endereços" },
  { id: "equilibrio", rotulo: "Melhor equilíbrio", explica: "menor soma das posições em endereços/hora, custo/endereço e erros/1.000" },
];

export function VisaoTurnos({ turnos, ranking, dia, divergencias }: { turnos: ResumoTurno[]; ranking: Record<CriterioTurno, TurnoSep | null>; dia: string | null; divergencias: DivergenciasTurno | null }) {
  const [foco, setFoco] = useState<TurnoSep | null>(null);
  const semEquipe = turnos.filter((t) => t.linhas > 0 && t.equipe.separadores === 0);
  const div = divergencias;

  const melhorDe = (l: LinhaComparativo): TurnoSep | null => {
    if (!l.sentido) return null;
    const c = turnos.filter((t) => t.linhas > 0 && t.equipe.separadores > 0).map((t) => ({ t: t.turno, v: l.valor(t) })).filter((x): x is { t: TurnoSep; v: number } => x.v !== null);
    if (c.length < 2) return null;
    const alvo = l.sentido === "maior" ? Math.max(...c.map((x) => x.v)) : Math.min(...c.map((x) => x.v));
    const w = c.filter((x) => x.v === alvo);
    return w.length === 1 ? w[0].t : null;
  };
  // Foco: turno escolhido × média simples dos demais turnos com produção.
  const delta = (l: LinhaComparativo): ReactNode => {
    if (!foco) return null;
    const f = turnos.find((t) => t.turno === foco)!;
    const outros = turnos.filter((t) => t.turno !== foco && t.linhas > 0).map(l.valor).filter((v): v is number => v !== null);
    const v = l.valor(f);
    if (v === null || outros.length === 0) return "—";
    const d = varRel(v, outros.reduce((s, x) => s + x, 0) / outros.length);
    const bom = d === null || !l.sentido ? null : (l.sentido === "maior") === d > 0;
    return <span className={bom === null ? "text-white/50" : bom ? "text-amber-300" : "text-rose-300"}>{sinalPct(d)}</span>;
  };

  return (
    <div className={`${VISAO} xl:grid-rows-[auto_minmax(0,1fr)]`}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,15rem),1fr))] gap-3">
        {turnos.map((t) => (
          <Mini
            key={t.turno}
            rotulo={`${t.rotulo} · ${dia ? ddmm(dia) : `por ${t.turno === "noite" ? "noite" : "dia"}`}`}
            valor={t.porDia ? `${n1(t.porDia.kg / 1000)} t` : "—"}
            sub={t.porDia ? `${t.porDia.skus === null ? "" : `${n0(t.porDia.skus)} SKUs · `}${n0(t.porDia.linhas)} endereços · ${n0(t.porDia.pedidos)} pedidos` : "sem produção"}
          />
        ))}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:min-h-0 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Bloco
          titulo={`Comparativo entre turnos${dia ? ` · ${ddmm(dia)}` : ""}`}
          direita={
            <div className="flex flex-wrap justify-end gap-1.5">
              <ChipTV ativo={foco === null} onClick={() => setFoco(null)}>
                todos
              </ChipTV>
              {turnos.map((t) => (
                <ChipTV key={t.turno} ativo={foco === t.turno} onClick={() => setFoco(foco === t.turno ? null : t.turno)}>
                  {t.rotulo}
                </ChipTV>
              ))}
            </div>
          }
        >
          <div className="h-full overflow-auto pr-1">
            <table className="w-full min-w-max text-sm">
              <thead className="sticky top-0 bg-[#121a5a] text-[0.62rem] uppercase tracking-[0.12em] text-white/40">
                <tr>
                  <th className="py-2 text-left font-semibold">Indicador</th>
                  {turnos.map((t) => (
                    <th key={t.turno} className="py-2 text-right font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ background: COR_TURNO[t.turno] }} />
                        {t.rotulo}
                      </span>
                      <div className="font-normal normal-case tracking-normal text-white/30">{t.config.horarioObservado}</div>
                    </th>
                  ))}
                  <th className="py-2 text-right font-semibold">Setor</th>
                  {foco && <th className="py-2 text-right font-semibold">{turnos.find((t) => t.turno === foco)!.rotulo} × demais</th>}
                </tr>
              </thead>
              <tbody>
                {LINHAS.map((l, i) => {
                  const cab = i === 0 || LINHAS[i - 1].grupo !== l.grupo;
                  const melhor = melhorDe(l);
                  const tot = l.total ? l.total(turnos) : null;
                  return [
                    cab && (
                      <tr key={`g-${l.grupo}`}>
                        <td colSpan={turnos.length + 2 + (foco ? 1 : 0)} className="pt-3 pb-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-amber-300/80">
                          {l.grupo}
                        </td>
                      </tr>
                    ),
                    <tr key={l.rotulo} className="border-t border-white/[0.06]">
                      <td className="py-1.5 text-white/80">{l.rotulo}</td>
                      {turnos.map((t) => {
                        const v = l.valor(t);
                        return (
                          <td key={t.turno} className={`py-1.5 text-right tabular-nums ${melhor === t.turno ? "font-bold text-amber-300" : "text-white"} ${foco && foco !== t.turno ? "opacity-60" : ""}`}>
                            {v === null ? "—" : l.fmt(v)}
                          </td>
                        );
                      })}
                      <td className="py-1.5 text-right tabular-nums text-white/55">{tot === null ? "" : l.fmt(tot)}</td>
                      {foco && <td className="py-1.5 text-right tabular-nums">{delta(l)}</td>}
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
        </Bloco>
        <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:overflow-auto xl:pr-1 [&>*]:shrink-0">
          <Bloco titulo="Ranking por critério">
            <ul className="space-y-2">
              {CRITERIOS.map((c) => {
                const t = ranking[c.id];
                return (
                  <li key={c.id} className="flex items-baseline justify-between gap-3 text-sm" title={c.explica}>
                    <span className="text-white">{c.rotulo}</span>
                    <span className="shrink-0 font-bold" style={{ color: t ? COR_TURNO[t] : undefined }}>
                      {t ? turnos.find((x) => x.turno === t)!.rotulo : <span className="font-normal text-white/35">sem vencedor</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Bloco>
          {semEquipe.length > 0 && <Aviso>{semEquipe.map((t) => t.rotulo).join(", ")}: sem separador cadastrado no turno.</Aviso>}
          {div && div.quantidade > 0 && <Aviso>{div.quantidade} separador(es) com horário diferente do turno do cadastro.</Aviso>}
        </div>
      </div>
    </div>
  );
}

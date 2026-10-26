"use client";

import { useState, type ReactNode } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import type { CriterioTurno, ResumoTurno } from "@/domain/separacao";
import type { Turno } from "@/domain/types";
import { Bloco, ChipTV, ddmm, semCentavos } from "./bi-ui";
import { Aviso, COR_TURNO, VISAO, n0, n1, t1, sinalPct, varRel } from "./bi-separacao-comum";
import type { AuditoriaSep } from "./separacao-dados";

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
  { grupo: "Produção", rotulo: "Linhas separadas", valor: (t) => t.linhas, fmt: n0, sentido: "maior", total: soma((t) => t.linhas) },
  { grupo: "Produção", rotulo: "Participação nas linhas", valor: (t) => t.participacaoLinhas, fmt: (v) => formatPercent(v, 0), sentido: null },
  { grupo: "Produção", rotulo: "Pedidos", valor: (t) => t.pedidos, fmt: n0, sentido: "maior", total: soma((t) => t.pedidos) },
  { grupo: "Produção", rotulo: "Peso", valor: (t) => t.kg, fmt: t1, sentido: "maior", total: soma((t) => t.kg) },
  { grupo: "Produção", rotulo: "Caixas fechadas", valor: (t) => t.caixas, fmt: n0, sentido: null, total: soma((t) => t.caixas) },
  { grupo: "Produção", rotulo: "Unidades", valor: (t) => t.unidades, fmt: n0, sentido: null, total: soma((t) => t.unidades) },
  { grupo: "Produção", rotulo: "Clientes (PDV-dia)", valor: (t) => t.clientes, fmt: n0, sentido: null, total: soma((t) => t.clientes) },
  { grupo: "Produtividade", rotulo: "Linhas por hora disponível", valor: (t) => t.linhasPorHora, fmt: n1, sentido: "maior", total: razao((t) => t.linhas, (t) => t.horasDisponiveis) },
  { grupo: "Produtividade", rotulo: "Kg por hora disponível", valor: (t) => t.kgPorHora, fmt: n0, sentido: "maior", total: razao((t) => t.kg, (t) => t.horasDisponiveis) },
  { grupo: "Produtividade", rotulo: "Pedidos por hora disponível", valor: (t) => t.pedidosPorHora, fmt: n1, sentido: "maior", total: razao((t) => t.pedidos, (t) => t.horasDisponiveis) },
  { grupo: "Produtividade", rotulo: "Linhas por separador por dia", valor: (t) => t.linhasPorSeparadorDia, fmt: n0, sentido: "maior" },
  { grupo: "Custo", rotulo: "Custo do período", valor: (t) => t.custo, fmt: semCentavos, sentido: null, total: soma((t) => t.custo) },
  { grupo: "Custo", rotulo: "Participação no custo", valor: (t) => t.participacaoCusto, fmt: (v) => formatPercent(v, 0), sentido: null },
  { grupo: "Custo", rotulo: "Custo por pedido", valor: (t) => t.custoPorPedido, fmt: formatBRL, sentido: "menor", total: razao((t) => t.custo, (t) => t.pedidos) },
  { grupo: "Custo", rotulo: "Custo por linha", valor: (t) => t.custoPorLinha, fmt: formatBRL, sentido: "menor", total: razao((t) => t.custo, (t) => t.linhas) },
  { grupo: "Custo", rotulo: "Custo por tonelada", valor: (t) => t.custoPorTonelada, fmt: semCentavos, sentido: "menor", total: razao((t) => t.custo, (t) => t.kg, 1000) },
  { grupo: "Qualidade", rotulo: "Itens com erro do separador", valor: (t) => t.errosSeparador, fmt: n0, sentido: null, total: soma((t) => t.errosSeparador) },
  { grupo: "Qualidade", rotulo: "Erros a cada 1.000 linhas", valor: (t) => t.errosPorMil, fmt: n1, sentido: "menor", total: razao((t) => t.errosSeparador, (t) => t.linhas, 1000) },
  { grupo: "Perfil do trabalho", rotulo: "Kg por linha", valor: (t) => t.kgPorLinha, fmt: n1, sentido: null, total: razao((t) => t.kg, (t) => t.linhas) },
  { grupo: "Perfil do trabalho", rotulo: "Unidades por linha", valor: (t) => t.unidadesPorLinha, fmt: n1, sentido: null, total: razao((t) => t.unidades, (t) => t.linhas) },
  { grupo: "Perfil do trabalho", rotulo: "Linhas em mapa consolidado", valor: (t) => t.mapasConsolidados, fmt: (v) => formatPercent(v, 0), sentido: null },
  { grupo: "Origem do dado", rotulo: "Linhas com separador registrado", valor: (t) => (t.linhas ? t.linhasComSeparador / t.linhas : null), fmt: (v) => formatPercent(v, 0), sentido: null },
  { grupo: "Origem do dado", rotulo: "Turno pelo cadastro", valor: (t) => (t.linhas ? t.linhasPorOperador / t.linhas : null), fmt: (v) => formatPercent(v, 0), sentido: null },
];

const CRITERIOS: { id: CriterioTurno; rotulo: string; explica: string }[] = [
  { id: "producao", rotulo: "Maior produção total", explica: "linhas separadas (absoluto — depende de gente e horas)" },
  { id: "linhasPorHora", rotulo: "Maior produtividade por hora", explica: "linhas ÷ horas disponíveis" },
  { id: "linhasPorSeparadorDia", rotulo: "Maior produtividade por separador", explica: "linhas ÷ separadores ÷ dias" },
  { id: "custoPorPedido", rotulo: "Menor custo por pedido", explica: "custo do turno ÷ pedidos (rateio)" },
  { id: "custoPorTonelada", rotulo: "Menor custo por tonelada", explica: "custo do turno ÷ t" },
  { id: "qualidade", rotulo: "Melhor qualidade", explica: "menos erros do separador a cada 1.000 linhas" },
  { id: "equilibrio", rotulo: "Melhor equilíbrio", explica: "menor soma das posições em linhas/hora, custo/linha e erros/1.000" },
];

export function VisaoTurnos({ turnos, ranking, dia, auditoria }: { turnos: ResumoTurno[]; ranking: Record<CriterioTurno, Turno | null>; dia: string | null; auditoria: AuditoriaSep | null }) {
  const [foco, setFoco] = useState<Turno | null>(null);
  const semEquipe = turnos.filter((t) => t.linhas > 0 && t.equipe.separadores === 0);
  const div = auditoria?.divergenciasTurno;

  const melhorDe = (l: LinhaComparativo): Turno | null => {
    if (!l.sentido) return null;
    const c = turnos.filter((t) => t.linhas > 0 && t.equipe.separadores > 0).map((t) => ({ t: t.turno, v: l.valor(t) })).filter((x): x is { t: Turno; v: number } => x.v !== null);
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
    <div className={`${VISAO} gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]`}>
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
  );
}

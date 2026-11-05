"use client";

import { useState } from "react";
import { formatPercent } from "@/domain/format";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import { filtrarFatos, resumir, agrupar } from "@/domain/bi-recebimento";
import type { DescarregamentoTipo } from "@/domain/types";
import { ChipTV, Dica, BarrasTV, semCentavos } from "../bi-ui";
import { Calendario, FMT_MEDIDA, Medida, PropsVisao, SEMANA, TIPO_COR, fmtPeso, inteiro, valorMedida } from "./base";

/**
 * Dia a dia do mês como CALENDÁRIO (ignora o filtro de dia; o dia escolhido
 * fica em âmbar). Cor: um tom só, mais forte quanto maior o valor do dia;
 * dia sem descarrego fica apagado. Clique filtra o dia.
 */
export function GraficoDias({ dados, x, filtro, onFiltro, medida }: PropsVisao & { medida: Medida; altura?: number }) {
  const fatos = filtrarFatos(dados.fatos ?? [], filtro, "dia");
  const porDia = new Map(agrupar(fatos, (f) => f.data).map((d) => [d.chave, valorMedida(d.resumo, medida, x.porNotas)]));
  return <Calendario mes={dados.mes} porDia={porDia} fmt={FMT_MEDIDA[medida]} filtro={filtro} onFiltro={onFiltro} />;
}

/** Por tipo de carga (ignora o filtro de tipo; o tipo escolhido fica em âmbar). Clique filtra o tipo. */
export function ListaTipos({ dados, x, filtro, onFiltro, medida }: PropsVisao & { medida: Medida }) {
  const fatos = filtrarFatos(dados.fatos ?? [], filtro, "tipo");
  const grupos = new Map(agrupar(fatos, (f) => f.tipo).map((g) => [g.chave, g.resumo]));
  const semTipo = resumir(fatos.filter((f) => f.tipo === null));
  const val = (t: DescarregamentoTipo) => {
    const s = grupos.get(t);
    if (!s) return 0;
    return t === "volume" && medida === "carros" ? s.descargasVolume : valorMedida(s, medida, x.porNotas);
  };
  const max = Math.max(1e-9, ...TIPOS_DESCARREGAMENTO.map(val));
  return (
    <div>
      <ul className="space-y-2.5">
        {TIPOS_DESCARREGAMENTO.map((t) => {
          const s = grupos.get(t);
          const sel = filtro.tipo === t;
          const apagado = !!filtro.tipo && !sel;
          return (
            <li key={t}>
              <button
                type="button"
                onClick={() => onFiltro({ ...filtro, tipo: sel ? null : t })}
                className={`w-full rounded-lg px-2 py-1 text-left transition hover:bg-white/[0.06] ${sel ? "bg-amber-400/10 ring-1 ring-amber-400" : ""} ${apagado ? "opacity-40" : ""}`}
              >
                <div className="flex items-baseline justify-between text-sm">
                  <span className="inline-flex items-center gap-2 font-semibold text-white">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TIPO_COR[t] }} />
                    {ROTULO_TIPO[t]}
                  </span>
                  <span className="tabular-nums text-white/70">
                    {s ? (
                      <>
                        <strong className="text-white">{t === "volume" ? `${inteiro.format(s.descargasVolume)} descargas` : x.porNotas ? `${s.notas} notas` : `${inteiro.format(s.carros)} carros`}</strong>
                        {s.pesoKg > 0 && ` · ${fmtPeso(s.pesoKg)}`}
                        {s.receita > 0 && ` · ${semCentavos(s.receita)}`}
                        {t === "volume" && s.caixas > 0 && ` · ${inteiro.format(s.caixas)} cx`}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${(val(t) / max) * 100}%`, background: sel ? "#f5b301" : TIPO_COR[t] }} />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      {(semTipo.pesoKg > 0 || semTipo.receita > 0) && (
        <p className="mt-2 text-xs text-white/35">
          + {fmtPeso(semTipo.pesoKg)} e {semCentavos(semTipo.receita)} do total do dia digitado, sem quebra por tipo.
        </p>
      )}
    </div>
  );
}

type OrdemForn = "pesoKg" | "receita" | "notas";

/** Fornecedores (ignora o filtro de fornecedor; o escolhido fica em âmbar). Clique filtra o fornecedor. */
export function TabelaFornecedores({ dados, filtro, onFiltro, ordemInicial = "pesoKg" }: PropsVisao & { ordemInicial?: OrdemForn }) {
  const [ordem, setOrdem] = useState<OrdemForn>(ordemInicial);
  const fatos = filtrarFatos(dados.fatos ?? [], filtro, "fornecedor");
  const lista = agrupar(fatos, (f) => f.fornecedor).sort((a, b) => b.resumo[ordem] - a.resumo[ordem]);
  const semForn = resumir(fatos.filter((f) => f.fornecedor === null && !f.ajuste));
  const total = lista.reduce((t, f) => t + f.resumo[ordem], 0);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ChipTV ativo={ordem === "pesoKg"} onClick={() => setOrdem("pesoKg")}>por peso</ChipTV>
        <ChipTV ativo={ordem === "receita"} onClick={() => setOrdem("receita")}>por receita</ChipTV>
        <ChipTV ativo={ordem === "notas"} onClick={() => setOrdem("notas")}>por notas</ChipTV>
        <span className="ml-auto"><Dica>clique para filtrar</Dica></span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto pr-1">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[#121a5a] text-[0.65rem] uppercase tracking-[0.14em] text-white/40">
            <tr>
              <th className="py-2 font-semibold">Fornecedor</th>
              <th className="py-2 text-right font-semibold">Notas</th>
              <th className="py-2 text-right font-semibold">Peso</th>
              <th className="py-2 text-right font-semibold">Receita</th>
              <th className="w-14 py-2 text-right font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {lista.map((f) => {
              const sel = filtro.fornecedor === f.chave;
              return (
                <tr
                  key={f.chave}
                  onClick={() => onFiltro({ ...filtro, fornecedor: sel ? null : f.chave })}
                  className={`cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.06] ${sel ? "bg-amber-400/15" : ""} ${filtro.fornecedor && !sel ? "opacity-40" : ""}`}
                >
                  <td className="max-w-0 py-2">
                    <div className={`truncate font-semibold ${sel ? "text-amber-300" : "text-white"}`} title={f.chave}>{f.chave}</div>
                    <div className="mt-1 h-1 rounded-full bg-white/10">
                      <div className={`h-full rounded-full ${sel ? "bg-amber-400" : "bg-[#5b6fd6]"}`} style={{ width: `${total > 0 ? (f.resumo[ordem] / total) * 100 : 0}%` }} />
                    </div>
                  </td>
                  <td className="py-2 text-right tabular-nums text-white/70">{f.resumo.notas}</td>
                  <td className="py-2 text-right tabular-nums text-white/70">{fmtPeso(f.resumo.pesoKg)}</td>
                  <td className="py-2 text-right font-bold tabular-nums text-white">{semCentavos(f.resumo.receita)}</td>
                  <td className="py-2 text-right tabular-nums text-white/50">{total > 0 ? formatPercent(f.resumo[ordem] / total, 0) : "—"}</td>
                </tr>
              );
            })}
            {semForn.receita > 0 && !filtro.fornecedor && (
              <tr className="border-t border-white/[0.06] text-white/45">
                <td className="py-2 italic">Total do dia (sem fornecedor)</td>
                <td className="py-2 text-right">—</td>
                <td className="py-2 text-right tabular-nums">{fmtPeso(semForn.pesoKg)}</td>
                <td className="py-2 text-right tabular-nums">{semCentavos(semForn.receita)}</td>
                <td />
              </tr>
            )}
            {lista.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-white/40">Sem lançamentos por fornecedor no período.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- CUSTO --------------------------------------------------------------------

/** Média por dia da semana (dias com descarrego do mês; ignora o filtro de dia). */
export function DiasDaSemana({ dados, x, filtro, medida, altura = 150 }: PropsVisao & { medida: Medida; altura?: number }) {
  const dias = agrupar(filtrarFatos(dados.fatos ?? [], filtro, "dia"), (f) => f.data);
  const soma = Array(7).fill(0);
  const qtd = Array(7).fill(0);
  for (const d of dias) {
    const [a, m, dd] = d.chave.split("-").map(Number);
    const w = new Date(a, m - 1, dd).getDay();
    soma[w] += valorMedida(d.resumo, medida, x.porNotas);
    qtd[w] += 1;
  }
  const medias = soma.map((v, w) => (qtd[w] ? v / qtd[w] : null));
  const melhor = Math.max(...medias.map((v) => v ?? 0));
  return (
    <BarrasTV
      altura={altura}
      fmt={FMT_MEDIDA[medida]}
      itens={SEMANA.map((d, w) => ({
        chave: d,
        rotulo: d,
        valor: medias[w],
        cor: medias[w] !== null && medias[w] === melhor ? "#10b981" : "#5b6fd6",
        detalhe: `${d} · ${qtd[w]} ${qtd[w] === 1 ? "dia" : "dias"} com descarrego`,
      }))}
    />
  );
}

/** Ranking de fornecedores por uma medida (barra + valor); clique filtra. */
export function RankingFornecedores({ dados, filtro, onFiltro, medida, limite = 12 }: PropsVisao & { medida: Medida; limite?: number }) {
  const lista = agrupar(filtrarFatos(dados.fatos ?? [], filtro, "fornecedor"), (f) => f.fornecedor)
    .map((g) => ({ nome: g.chave, v: g.resumo[medida === "carros" ? "notas" : medida] }))
    .filter((g) => g.v > 0)
    .sort((a, b) => b.v - a.v);
  const total = lista.reduce((t, g) => t + g.v, 0);
  if (lista.length === 0) return <p className="py-6 text-center text-sm text-white/40">Sem lançamentos por fornecedor.</p>;
  return (
    <ul className="h-full space-y-2 overflow-auto pr-1">
      {lista.slice(0, limite).map((g) => {
        const sel = filtro.fornecedor === g.nome;
        return (
          <li key={g.nome}>
            <button
              type="button"
              onClick={() => onFiltro({ ...filtro, fornecedor: sel ? null : g.nome })}
              className={`w-full rounded-lg px-2 py-1 text-left transition hover:bg-white/[0.06] ${sel ? "bg-amber-400/10 ring-1 ring-amber-400" : ""} ${filtro.fornecedor && !sel ? "opacity-40" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={`truncate font-semibold ${sel ? "text-amber-300" : "text-white"}`}>{g.nome}</span>
                <span className="shrink-0 tabular-nums text-white">
                  {FMT_MEDIDA[medida](g.v)} <span className="text-white/40">· {formatPercent(g.v / total, 0)}</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/10">
                <div className={`h-full rounded-full ${sel ? "bg-amber-400" : "bg-[#5b6fd6]"}`} style={{ width: `${(g.v / lista[0].v) * 100}%` }} />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

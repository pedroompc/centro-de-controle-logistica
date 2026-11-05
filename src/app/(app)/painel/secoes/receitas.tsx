"use client";

import type { ReactNode } from "react";
import { formatBRL, formatPercent, formatKg } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { TIPOS_DESCARREGAMENTO, ROTULO_TIPO } from "@/domain/descarregamento";
import type { DescarregamentoTipo } from "@/domain/types";
import type { ResumoReceitas, MesReceitaDetalhe } from "../painel-actions";
import { indicesMelhores, ehMelhorDaJanela, type IndicadoresRecebimento, type IndicadorComparavel } from "@/domain/recebimento";
import { inteiro, progressoDoMes } from "./base";

// Cores dos tipos de descarrego no painel escuro (mesma família do mapa de mix).
const TIPO_COR_TV: Record<DescarregamentoTipo, string> = {
  batido: "#5b6fd6",
  paletizado: "#8b93e0",
  pal_rem: "#f5b301",
  volume: "#38bdf8",
};

/**
 * Receitas · "por que cada mês rendeu isso". Em cima, o TRIMESTRE (o que os
 * cards não mostram: somas e razões do período). Embaixo, um card por mês com
 * receita, mix de descarrego, a equipe do recebimento e diversas.
 *
 * Cor: número em verde = melhor mês do trimestre naquele indicador (só entre
 * meses fechados). O resto fica branco — vermelho não aparece aqui.
 */
export function SecaoReceitas({
  detalhe,
  recebimento = [],
}: {
  dados?: ResumoReceitas;
  detalhe: MesReceitaDetalhe[];
  recebimento?: IndicadoresRecebimento[];
}) {
  const meses = detalhe.slice(-3); // o trimestre, lado a lado
  const recPorMes = new Map(recebimento.map((r) => [r.mes, r]));
  const janelaRec = meses.map((m) => recPorMes.get(m.mes)).filter((r): r is IndicadoresRecebimento => !!r);
  const fechado = (mes: string) => progressoDoMes(mes) >= 1;
  const melhoresDe = (valor: (m: MesReceitaDetalhe) => number) =>
    indicesMelhores(meses.map((m) => ({ valor: valor(m), fechado: fechado(m.mes) })), true);
  const melhorReceita = melhoresDe((m) => m.receita);
  const melhorCarros = melhoresDe((m) => m.carros);
  const melhorPeso = melhoresDe((m) => m.pesoKg);

  // Altura da barra = descargas. Volume usa as descargas (lançamentos), não as
  // caixas — senão 30 mil caixas esmagariam as colunas de carros.
  const qtdBarra = (m: MesReceitaDetalhe, t: DescarregamentoTipo) =>
    t === "volume" ? m.descargasVolume : m.porTipo[t];
  // Escala compartilhada — colunas comparáveis entre os meses.
  const sharedMaxTipo = Math.max(1, ...meses.flatMap((m) => TIPOS_DESCARREGAMENTO.map((t) => qtdBarra(m, t))));

  return (
    <div className="flex h-full flex-col gap-5">
      <ResumoTrimestre meses={meses} rec={janelaRec} />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Por que cada mês rendeu isso</div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {TIPOS_DESCARREGAMENTO.map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 text-xs text-white/50">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: TIPO_COR_TV[t] }} />
                {ROTULO_TIPO[t]}
              </span>
            ))}
            <span className="ml-2 inline-flex items-center gap-1.5 text-xs text-white/50">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              melhor do trimestre
            </span>
          </div>
        </div>

        {meses.length === 0 ? (
          <p className="py-10 text-center text-white/40">Sem meses para comparar.</p>
        ) : (
          <div className="grid min-h-0 flex-1 gap-4" style={{ gridTemplateColumns: `repeat(${meses.length}, minmax(0, 1fr))` }}>
            {meses.map((m, idx) => {
              const detalhados = TIPOS_DESCARREGAMENTO.reduce((s, t) => s + qtdBarra(m, t), 0);
              const prog = progressoDoMes(m.mes);
              const r = recPorMes.get(m.mes);
              return (
                <div key={m.mes} className="flex min-h-0 flex-col rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10">
                  {/* Cabeçalho do card: mês + situação, e a receita */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/55">{formatMesAno(m.mes)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ${prog >= 1 ? "bg-white/10 text-white/50" : "bg-amber-400/15 text-amber-200"}`}>
                      {prog >= 1 ? "fechado" : `em andamento · ${Math.round(prog * 100)}%`}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    {melhorReceita.has(idx) && <PontoMelhor grande />}
                    <span className={`font-[family-name:var(--font-sora)] text-3xl font-extrabold tabular-nums ${melhorReceita.has(idx) ? "text-emerald-300" : "text-white"}`}>
                      {formatBRL(m.receita)}
                    </span>
                  </div>

                  {/* Descarrego: totais + mix por tipo */}
                  <TituloBloco titulo="Descarrego" direita={r && r.diasDescarrego > 0 ? `${r.diasDescarrego} dias` : undefined} />
                  <div className="mt-1 flex items-baseline gap-4 text-sm tabular-nums">
                    <Destacado melhor={melhorCarros.has(idx)}>{inteiro.format(m.carros)} carros</Destacado>
                    {m.caixas > 0 && <span className="font-semibold text-white/60">{inteiro.format(m.caixas)} cx</span>}
                    <Destacado melhor={melhorPeso.has(idx)} className="ml-auto">{formatKg(m.pesoKg)}</Destacado>
                  </div>
                  {detalhados > 0 ? (
                    <div className="mt-2 flex min-h-[5.5rem] flex-1 items-stretch gap-2">
                      {TIPOS_DESCARREGAMENTO.map((t) => {
                        const qtd = qtdBarra(m, t);
                        const unidade = t === "volume" ? "descargas" : "carros";
                        return (
                          <div key={t} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={`${ROTULO_TIPO[t]}: ${inteiro.format(qtd)} ${unidade}${m.pesoPorTipo[t] > 0 ? ` · ${formatKg(m.pesoPorTipo[t])}` : ""}`}>
                            <span className="shrink-0 text-sm font-extrabold tabular-nums text-white">{inteiro.format(qtd)}</span>
                            {m.pesoPorTipo[t] > 0 && (
                              <span className="-mt-1 w-full shrink-0 truncate text-center text-[0.7rem] font-semibold tabular-nums text-white/50">{formatKg(m.pesoPorTipo[t])}</span>
                            )}
                            <div className="flex w-full flex-1 items-end">
                              <div className="w-full rounded-t-md" style={{ height: `${Math.max(3, (qtd / sharedMaxTipo) * 100)}%`, background: TIPO_COR_TV[t] }} />
                            </div>
                            <span className="w-full truncate text-center text-[0.7rem] font-bold text-white/70">{ROTULO_TIPO[t]}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="mt-2 flex-1 text-xs font-semibold text-white/40">sem quebra por tipo</div>
                  )}

                  <BlocoRecebimento r={r} janela={janelaRec} />

                  {/* Diversas: uma linha só */}
                  <TituloBloco titulo="Diversas" direita={formatBRL(m.diversas)} />
                  <div className="mt-0.5 truncate text-xs text-white/45">
                    {m.materiais.length > 0
                      ? m.materiais.map((mat) => `${mat.material}${mat.kg > 0 ? ` · ${formatKg(mat.kg)}` : ""}`).join("  ·  ")
                      : "sem diversas"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Título de bloco dentro do card: rótulo à esquerda, fio fino, info à direita. */
function TituloBloco({ titulo, direita }: { titulo: string; direita?: string }) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className="text-[0.7rem] font-bold uppercase tracking-[0.16em] text-white/45">{titulo}</span>
      <span className="h-px flex-1 bg-white/10" />
      {direita && <span className="text-xs font-semibold tabular-nums text-white/60">{direita}</span>}
    </div>
  );
}

/** Bolinha verde que acompanha o número campeão (cor nunca sozinha). */
function PontoMelhor({ grande = false }: { grande?: boolean }) {
  return <span aria-label="melhor do trimestre" className={`shrink-0 rounded-full bg-emerald-400 ${grande ? "h-2.5 w-2.5" : "h-1.5 w-1.5"}`} />;
}

function Destacado({ melhor, className = "", children }: { melhor: boolean; className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-bold ${melhor ? "text-emerald-300" : "text-white/85"} ${className}`}>
      {melhor && <PontoMelhor />}
      {children}
    </span>
  );
}

/**
 * Linha de cima da tela de Receitas: o TRIMESTRE. Somas e razões do período
 * (receita, toneladas, R$ por tonelada), cada uma com uma
 * mini barra por mês — a barra do melhor mês em verde.
 */
function ResumoTrimestre({ meses, rec }: { meses: MesReceitaDetalhe[]; rec: IndicadoresRecebimento[] }) {
  if (meses.length === 0) return null;
  const rotulo = `${formatMesAno(meses[0].mes).slice(0, 3)}–${formatMesAno(meses[meses.length - 1].mes).slice(0, 3)}`;
  const receita = meses.reduce((t, m) => t + m.receita, 0);
  const peso = meses.reduce((t, m) => t + m.pesoKg, 0);
  const carros = meses.reduce((t, m) => t + m.carros, 0);
  const recDesc = rec.reduce((t, r) => t + r.receitaDescarrego, 0);
  const custo = rec.reduce((t, r) => t + r.custoPeriodo, 0);
  const pesoRec = rec.reduce((t, r) => t + r.pesoKg, 0);
  const porT = pesoRec > 0 ? recDesc / (pesoRec / 1000) : null;
  const custoT = pesoRec > 0 ? custo / (pesoRec / 1000) : null;
  const fechado = (mes: string) => progressoDoMes(mes) >= 1;
  const temEquipe = rec.some((r) => r.equipe.total > 0);

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <TileTrimestre
        label={`Receita do trimestre · ${rotulo}`}
        valor={formatBRL(receita)}
        sub={`média de ${formatBRL(receita / meses.length)} por mês`}
        barras={meses.map((m) => ({ mes: m.mes, valor: m.receita, fechado: fechado(m.mes) }))}
      />
      <TileTrimestre
        label="Peso descarregado"
        valor={`${(peso / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} t`}
        sub={`${inteiro.format(carros)} carros · ${carros > 0 ? formatKg(peso / carros) : "—"} por carro`}
        barras={meses.map((m) => ({ mes: m.mes, valor: m.pesoKg, fechado: fechado(m.mes) }))}
      />
      <TileTrimestre
        label="Receita por tonelada"
        valor={porT === null ? "—" : formatBRL(porT)}
        sub={custoT === null || !temEquipe ? "só descarrego" : `custo da equipe: ${formatBRL(custoT)}/t`}
        barras={rec.map((r) => ({ mes: r.mes, valor: r.receitaPorTonelada, fechado: r.fracaoMes >= 1 }))}
      />
    </div>
  );
}

function TileTrimestre({
  label,
  valor,
  sub,
  barras,
}: {
  label: string;
  valor: string;
  sub: string;
  barras: { mes: string; valor: number | null; fechado: boolean }[];
}) {
  const melhores = indicesMelhores(barras, true);
  const max = Math.max(0, ...barras.map((b) => b.valor ?? 0));
  return (
    <div className="flex items-end justify-between gap-4 rounded-2xl bg-white/[0.06] px-5 py-3.5 ring-1 ring-white/10">
      <div className="min-w-0">
        <div className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</div>
        <div className="mt-1 font-[family-name:var(--font-sora)] text-2xl font-extrabold leading-none tabular-nums text-white xl:text-[1.75rem]">{valor}</div>
        <div className="mt-1.5 truncate text-xs text-white/45">{sub}</div>
      </div>
      {/* Mini barras: um mês por barra, mesma escala; melhor mês em verde. */}
      <div className="flex h-12 shrink-0 items-end gap-1.5" aria-hidden>
        {barras.map((b, i) => (
          <div key={b.mes} className="flex h-full w-5 flex-col items-center justify-end gap-1" title={`${formatMesAno(b.mes)}`}>
            <div
              className={`w-full rounded-t ${melhores.has(i) ? "bg-emerald-400" : "bg-white/25"}`}
              style={{ height: `${max > 0 && b.valor !== null && b.valor > 0 ? Math.max(8, (b.valor / max) * 100) : 4}%` }}
            />
            <span className="text-[0.6rem] font-semibold uppercase text-white/40">{formatMesAno(b.mes).slice(0, 1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LinhaRec({ rotulo, valor, melhor = false }: { rotulo: string; valor: string; melhor?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 py-[3px]">
      <span className="truncate text-xs text-white/50">{rotulo}</span>
      <span className={`inline-flex shrink-0 items-center gap-1.5 text-sm font-bold tabular-nums ${melhor ? "text-emerald-300" : "text-white"}`}>
        {melhor && <PontoMelhor />}
        {valor}
      </span>
    </div>
  );
}

/**
 * Produtividade e custo da equipe de descarga no mês do card. Médias da EQUIPE
 * (peso do mês ÷ pessoas do cargo), não por pessoa. Verde = melhor do trimestre.
 * "Resultado" = receita de descarrego − custo da equipe.
 */
function BlocoRecebimento({ r, janela }: { r?: IndicadoresRecebimento; janela: IndicadoresRecebimento[] }) {
  if (!r) return null;
  const equipe =
    r.equipe.total > 0
      ? `${r.equipe.ajudantes} aj · ${r.equipe.conferentes} conf${r.equipe.empilhadores ? ` · ${r.equipe.empilhadores} pux` : ""} · ${formatBRL(r.equipe.custo)}${r.equipeEstimada ? " · est." : ""}`
      : undefined;
  if (r.equipe.total === 0)
    return (
      <>
        <TituloBloco titulo="Recebimento" />
        <div className="mt-1 text-xs font-semibold text-white/40">sem equipe no setor Recebimento do cadastro</div>
      </>
    );
  const melhor = (chave: IndicadorComparavel) => ehMelhorDaJanela(janela, r.mes, chave);
  const kg = (v: number | null) => (v === null ? "—" : formatKg(v));
  const pct = (v: number | null, casas = 1) => (v === null ? "—" : formatPercent(v, casas));
  return (
    <>
      <TituloBloco titulo="Recebimento" direita={equipe} />
      <div className="mt-1 grid grid-cols-2 gap-x-5">
        <div>
          <LinhaRec rotulo="Kg por ajudante" valor={kg(r.kgPorAjudante)} melhor={melhor("kgPorAjudante")} />
          <LinhaRec rotulo="Por ajudante / dia" valor={kg(r.kgPorAjudanteDia)} melhor={melhor("kgPorAjudanteDia")} />
          <LinhaRec rotulo="Custo / fat. líquido" valor={pct(r.custoSobreFaturamento, 2)} melhor={melhor("custoSobreFaturamento")} />
          <LinhaRec rotulo="Custo / descarrego" valor={pct(r.custoSobreDescarrego)} melhor={melhor("custoSobreDescarrego")} />
        </div>
        <div>
          <LinhaRec rotulo="Carros por conferente" valor={r.carrosPorConferente === null ? "—" : inteiro.format(Math.round(r.carrosPorConferente))} melhor={melhor("carrosPorConferente")} />
          <LinhaRec rotulo="Kg por conferente" valor={kg(r.kgPorConferente)} melhor={melhor("kgPorConferente")} />
          <LinhaRec rotulo="Custo por tonelada" valor={r.custoPorTonelada === null ? "—" : formatBRL(r.custoPorTonelada)} melhor={melhor("custoPorTonelada")} />
          <LinhaRec rotulo="Resultado" valor={formatBRL(r.resultado)} melhor={melhor("resultado")} />
        </div>
      </div>
    </>
  );
}

// --- Cortes --------------------------------------------------------------------

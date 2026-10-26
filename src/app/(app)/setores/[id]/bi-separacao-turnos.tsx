"use client";

import { useState, type ReactNode } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import type { CriterioTurno, ResumoTurno } from "@/domain/separacao";
import type { TurnoSep } from "@/domain/turnos-separacao";
import { Bloco, ddmm, semCentavos } from "./bi-ui";
import { Aviso, COR_TURNO, DUAS_COLUNAS, GRADE_CARDS, VISAO, n0, n1, t1, sinalPct, varRel } from "./bi-separacao-comum";
import type { DivergenciasTurno, ProducaoBI } from "./separacao-dados";

// --- Medidas clicáveis (cada uma tem série dia a dia por turno) -------------------

type Medida = "kg" | "linhas" | "pedidos" | "skus" | "porHora" | "custoT" | "erros";
interface DiaTurno {
  kg: number;
  linhas: number;
  pedidos: number;
  skus: number | null;
  erros: number;
}

interface DefMedida {
  rotulo: string; // card e título do gráfico
  curto: string; // eixo/tooltip
  menor?: boolean; // menor é melhor
  media: (t: ResumoTurno) => number | null; // valor do turno no recorte
  doDia: (x: DiaTurno, t: ResumoTurno) => number | null; // valor de 1 dia do turno
  fmt: (v: number) => string;
}

const kg = (v: number) => `${n0(v)} kg`;

const MEDIDAS: Record<Medida, DefMedida> = {
  kg: { rotulo: "Peso separado por dia", curto: "kg", media: (t) => t.porDia?.kg ?? null, doDia: (x) => x.kg, fmt: kg },
  linhas: { rotulo: "Endereços por dia", curto: "endereços", media: (t) => t.porDia?.linhas ?? null, doDia: (x) => x.linhas, fmt: n0 },
  pedidos: { rotulo: "Pedidos por dia", curto: "pedidos", media: (t) => t.porDia?.pedidos ?? null, doDia: (x) => x.pedidos, fmt: n0 },
  skus: { rotulo: "SKUs por dia", curto: "SKUs", media: (t) => t.porDia?.skus ?? null, doDia: (x) => x.skus, fmt: n0 },
  porHora: {
    rotulo: "Endereços por hora",
    curto: "endereços/h",
    media: (t) => t.linhasPorHora,
    doDia: (x, t) => (t.equipe.horasSeparadorDia > 0 ? x.linhas / t.equipe.horasSeparadorDia : null),
    fmt: n1,
  },
  custoT: {
    rotulo: "Custo por tonelada",
    curto: "R$/t",
    menor: true,
    media: (t) => t.custoPorTonelada,
    doDia: (x, t) => (t.custo !== null && t.dias > 0 && x.kg > 0 ? t.custo / t.dias / (x.kg / 1000) : null),
    fmt: semCentavos,
  },
  erros: {
    rotulo: "Erros a cada 1.000 endereços",
    curto: "erros/1.000",
    menor: true,
    media: (t) => t.errosPorMil,
    doDia: (x) => (x.linhas > 0 ? (x.erros / x.linhas) * 1000 : null),
    fmt: n1,
  },
};

const CRITERIOS: { id: CriterioTurno; rotulo: string; explica: string; medida: Medida | null }[] = [
  { id: "producao", rotulo: "Maior produção total", explica: "endereços visitados (absoluto — depende de gente e horas)", medida: "linhas" },
  { id: "linhasPorHora", rotulo: "Maior produtividade por hora", explica: "endereços ÷ horas disponíveis", medida: "porHora" },
  { id: "linhasPorSeparadorDia", rotulo: "Maior produtividade por separador", explica: "endereços ÷ separadores ÷ dias", medida: "linhas" },
  { id: "custoPorPedido", rotulo: "Menor custo por pedido", explica: "custo do turno ÷ pedidos (rateio)", medida: "pedidos" },
  { id: "custoPorTonelada", rotulo: "Menor custo por tonelada", explica: "custo do turno ÷ t", medida: "custoT" },
  { id: "qualidade", rotulo: "Melhor qualidade", explica: "menos erros do separador a cada 1.000 endereços", medida: "erros" },
  { id: "equilibrio", rotulo: "Melhor equilíbrio", explica: "menor soma das posições em endereços/hora, custo/endereço e erros/1.000", medida: null },
];

/** Produção de cada dia × turno a partir do que já veio agregado do servidor. */
function porDiaTurno(p: ProducaoBI): Map<string, Partial<Record<TurnoSep, DiaTurno>>> {
  const m = new Map<string, Partial<Record<TurnoSep, DiaTurno>>>();
  const de = (dia: string, t: TurnoSep) => {
    const d = m.get(dia) ?? {};
    d[t] ??= { kg: 0, linhas: 0, pedidos: 0, skus: null, erros: 0 };
    m.set(dia, d);
    return d[t]!;
  };
  for (const l of p.linhas) {
    const x = de(l.dia, l.turno);
    x.kg += l.kg;
    x.linhas += l.linhas;
    x.pedidos += l.pedidos;
  }
  for (const e of p.erros) if (e.origem === "separador" && m.get(e.dia)?.[e.turno]) m.get(e.dia)![e.turno]!.erros += e.itens;
  for (const s of p.skusTurno) if (m.get(s.dia)?.[s.turno]) m.get(s.dia)![s.turno]!.skus = s.skus;
  return m;
}

// --- Visão --------------------------------------------------------------------

type Sub = Medida | "tabela";

export function VisaoTurnos({
  p,
  turnos,
  ranking,
  dia,
  onDia,
  divergencias,
}: {
  p: ProducaoBI;
  turnos: ResumoTurno[];
  ranking: Record<CriterioTurno, TurnoSep | null>;
  dia: string | null;
  onDia: (d: string | null) => void;
  divergencias: DivergenciasTurno | null;
}) {
  const [sub, setSub] = useState<Sub | null>(null);
  const [foco, setFoco] = useState<TurnoSep | null>(null);
  const medida: Medida = sub && sub !== "tabela" ? sub : "kg";
  const def = MEDIDAS[medida];
  const serie = porDiaTurno(p);
  const dias = [...serie.keys()].sort();
  const semEquipe = turnos.filter((t) => t.linhas > 0 && t.equipe.separadores === 0);
  const abrir = (s: Sub) => setSub((a) => (a === s ? null : s));
  const turnoDe = (id: TurnoSep) => turnos.find((t) => t.turno === id)!;
  const porNoite = (t: ResumoTurno) => (t.turno === "noite" ? "noite" : "dia");

  return (
    <div className={`${VISAO} xl:grid-rows-[auto_auto_auto_minmax(24rem,1fr)]`}>
      {/* Turnos: kg por dia trabalhado em destaque; clicar abre o detalhe do turno. */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-3">
        {turnos.map((t) => {
          const ativo = foco === t.turno;
          return (
            <button
              key={t.turno}
              type="button"
              onClick={() => setFoco(ativo ? null : t.turno)}
              aria-pressed={ativo}
              className={`@container rounded-2xl px-5 py-4 text-left ring-1 transition ${ativo ? "bg-amber-400/15 ring-2 ring-amber-400" : "bg-white/[0.06] ring-white/10 hover:bg-white/[0.1]"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/55">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: COR_TURNO[t.turno] }} />
                  {t.rotulo} · {dia ? ddmm(dia) : `por ${porNoite(t)}`}
                </span>
                <span className={`text-xs ${ativo ? "text-amber-300" : "text-white/25"}`}>{ativo ? "▾" : "›"}</span>
              </div>
              <div className="mt-2 whitespace-nowrap font-[family-name:var(--font-sora)] text-[clamp(1.6rem,12cqi,2.6rem)] font-extrabold leading-none tabular-nums text-white">
                {t.porDia ? n0(t.porDia.kg) : "—"} <span className="text-[0.5em] font-bold text-white/50">kg</span>
              </div>
              <div className="mt-2 truncate text-xs text-white/45">
                {t.porDia
                  ? `${t.porDia.skus === null ? "" : `${n0(t.porDia.skus)} SKUs · `}${n0(t.porDia.linhas)} endereços · ${n0(t.porDia.pedidos)} pedidos${dia ? "" : ` · ${t.dias} ${porNoite(t)}s`}`
                  : "sem produção"}
              </div>
            </button>
          );
        })}
      </div>

      {/* Indicadores: clicar troca o gráfico. */}
      <div className={GRADE_CARDS}>
        {(Object.keys(MEDIDAS) as Medida[]).map((k) => (
          <CardMedida key={k} def={MEDIDAS[k]} turnos={turnos} ativo={sub === k} onClick={() => abrir(k)} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        {sub ? (
          <>
            <button type="button" onClick={() => setSub(null)} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white/70 hover:bg-white/20">
              ◂ Voltar ao resumo
            </button>
            <span className="font-bold uppercase tracking-[0.16em] text-amber-300">Dia × Noite › {sub === "tabela" ? "Todos os indicadores" : def.rotulo}</span>
          </>
        ) : (
          <span className="text-white/35">Clique num turno, num indicador ou num dia do gráfico</span>
        )}
        <button
          type="button"
          onClick={() => abrir("tabela")}
          className={`ml-auto rounded-full px-3 py-1 font-semibold transition ${sub === "tabela" ? "bg-amber-400 text-[#0a1650]" : "bg-white/10 text-white/70 hover:bg-white/20"}`}
        >
          Todos os indicadores
        </button>
      </div>

      {sub === "tabela" ? (
        <Bloco titulo={`Comparativo completo${dia ? ` · ${ddmm(dia)}` : ""}`}>
          <TabelaComparativo turnos={turnos} />
        </Bloco>
      ) : (
        <div className={`${DUAS_COLUNAS} xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]`}>
          <Bloco className="min-h-[20rem] xl:min-h-0" titulo={`${def.rotulo} · dia a dia`} direita={<Legenda turnos={turnos} foco={foco} />}>
            <BarrasDuplas
              dias={dias}
              turnos={turnos}
              valor={(d, t) => {
                const x = serie.get(d)?.[t.turno];
                return x ? def.doDia(x, t) : null;
              }}
              fmt={def.fmt}
              foco={foco}
              selecionado={dia}
              onDia={(d) => onDia(dia === d ? null : d)}
            />
          </Bloco>
          <div className="flex min-w-0 flex-col gap-3 xl:min-h-0 xl:overflow-auto xl:pr-1 [&>*]:shrink-0">
            {foco ? (
              <DetalheTurno t={turnoDe(foco)} ranking={ranking} dia={dia} />
            ) : (
              <Comparacao def={def} turnos={turnos} dia={dia} />
            )}
            <Bloco titulo="Quem ganha">
              <ul className="space-y-1">
                {CRITERIOS.map((c) => {
                  const t = ranking[c.id];
                  const ativo = c.medida !== null && sub === c.medida;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        title={c.explica}
                        disabled={c.medida === null}
                        onClick={() => c.medida && setSub(c.medida)}
                        className={`flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1 text-left text-sm transition ${ativo ? "bg-amber-400/15" : c.medida ? "hover:bg-white/[0.06]" : ""}`}
                      >
                        <span className="text-white">{c.rotulo}</span>
                        <span className="shrink-0 font-bold" style={{ color: t ? COR_TURNO[t] : undefined }}>
                          {t ? turnoDe(t).rotulo : <span className="font-normal text-white/35">sem vencedor</span>}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Bloco>
            {semEquipe.length > 0 && <Aviso>{semEquipe.map((t) => t.rotulo).join(", ")}: sem separador cadastrado no turno.</Aviso>}
            {divergencias && divergencias.quantidade > 0 && <Aviso>{divergencias.quantidade} separador(es) com horário diferente do turno do cadastro.</Aviso>}
          </div>
        </div>
      )}
    </div>
  );
}

// --- Peças ----------------------------------------------------------------------

/** Card de indicador: valor de cada turno lado a lado; o melhor em âmbar. */
function CardMedida({ def, turnos, ativo, onClick }: { def: DefMedida; turnos: ResumoTurno[]; ativo: boolean; onClick: () => void }) {
  const vals = turnos.map((t) => def.media(t));
  const ok = vals.filter((v): v is number => v !== null);
  const alvo = ok.length === turnos.length && ok.length > 1 ? (def.menor ? Math.min(...ok) : Math.max(...ok)) : null;
  const unico = alvo !== null && ok.filter((v) => v === alvo).length === 1;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`@container rounded-xl px-4 py-3 text-left ring-1 transition ${ativo ? "bg-amber-400/15 ring-2 ring-amber-400" : "bg-white/[0.05] ring-white/10 hover:bg-white/[0.09]"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-white/45">{def.rotulo}</span>
        <span className={`text-xs ${ativo ? "text-amber-300" : "text-white/25"}`}>{ativo ? "▾" : "›"}</span>
      </div>
      <div className="mt-1.5 space-y-0.5">
        {turnos.map((t, i) => (
          <div key={t.turno} className="flex items-baseline justify-between gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 text-white/55">
              <span className="h-2 w-2 rounded-full" style={{ background: COR_TURNO[t.turno] }} />
              {t.rotulo}
            </span>
            <span className={`whitespace-nowrap font-bold tabular-nums ${unico && vals[i] === alvo ? "text-amber-300" : "text-white"}`}>{vals[i] === null ? "—" : def.fmt(vals[i]!)}</span>
          </div>
        ))}
      </div>
    </button>
  );
}

function Legenda({ turnos, foco }: { turnos: ResumoTurno[]; foco: TurnoSep | null }) {
  return (
    <div className="flex gap-3 text-xs text-white/60">
      {turnos.map((t) => (
        <span key={t.turno} className={`inline-flex items-center gap-1.5 ${foco && foco !== t.turno ? "opacity-40" : ""}`}>
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR_TURNO[t.turno] }} />
          {t.rotulo}
        </span>
      ))}
    </div>
  );
}

/** Barras por dia com um par Dia/Noite; clicar no dia filtra o BI. */
function BarrasDuplas({
  dias,
  turnos,
  valor,
  fmt,
  foco,
  selecionado,
  onDia,
}: {
  dias: string[];
  turnos: ResumoTurno[];
  valor: (dia: string, t: ResumoTurno) => number | null;
  fmt: (v: number) => string;
  foco: TurnoSep | null;
  selecionado: string | null;
  onDia: (d: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (dias.length === 0) return <p className="py-8 text-center text-sm text-white/40">Sem produção no mês.</p>;
  const vis = turnos.filter((t) => !foco || t.turno === foco);
  const max = Math.max(1e-9, ...dias.flatMap((d) => vis.map((t) => valor(d, t) ?? 0))) * 1.08;
  return (
    <div className="relative h-full min-h-[16rem]" onMouseLeave={() => setHover(null)}>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-white px-3 py-1.5 text-xs text-[#0a1650] shadow-lg"
          style={{ left: `${Math.min(88, Math.max(12, ((hover + 0.5) / dias.length) * 100))}%` }}
        >
          <span className="font-bold">{ddmm(dias[hover])}</span>
          {vis.map((t) => {
            const v = valor(dias[hover], t);
            return (
              <span key={t.turno}>
                {" · "}
                {t.rotulo} {v === null ? "—" : fmt(v)}
              </span>
            );
          })}
          <span className="text-slate-400"> · clique para {selecionado === dias[hover] ? "tirar o filtro" : "filtrar o dia"}</span>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-5 top-9 flex items-end gap-1">
        {dias.map((d, i) => {
          const sel = selecionado === d;
          return (
            <button
              key={d}
              type="button"
              onClick={() => onDia(d)}
              onMouseEnter={() => setHover(i)}
              className={`flex h-full min-w-0 flex-1 items-end justify-center gap-[2px] rounded-md px-[2px] transition ${sel ? "bg-amber-400/20 ring-1 ring-amber-400" : hover === i ? "bg-white/[0.06]" : ""} ${selecionado && !sel ? "opacity-50" : ""}`}
            >
              {vis.map((t) => {
                const v = valor(d, t);
                return <span key={t.turno} className="w-full max-w-[1.1rem] rounded-t-sm" style={{ height: `${((v ?? 0) / max) * 100}%`, background: COR_TURNO[t.turno] }} />;
              })}
            </button>
          );
        })}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-1">
        {dias.map((d) => (
          <span key={d} className={`min-w-0 flex-1 text-center text-[0.6rem] tabular-nums ${selecionado === d ? "font-bold text-amber-300" : "text-white/40"}`}>
            {d.slice(8, 10)}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Dia × Noite no indicador escolhido: barras horizontais e a diferença. */
function Comparacao({ def, turnos, dia }: { def: DefMedida; turnos: ResumoTurno[]; dia: string | null }) {
  const vals = turnos.map((t) => ({ t, v: def.media(t) }));
  const max = Math.max(1e-9, ...vals.map((x) => x.v ?? 0));
  // Quem está melhor e por quanto: maior é melhor → líder ÷ outro − 1; menor é melhor → 1 − líder ÷ outro.
  const ok = vals.filter((x): x is { t: ResumoTurno; v: number } => x.v !== null && x.v > 0);
  const ord = [...ok].sort((x, y) => (def.menor ? x.v - y.v : y.v - x.v));
  const lider = ok.length === 2 && ord[0].v !== ord[1].v ? ord[0] : null;
  const folga = lider ? (def.menor ? 1 - lider.v / ord[1].v : lider.v / ord[1].v - 1) : null;
  return (
    <Bloco titulo={`${def.rotulo}${dia ? ` · ${ddmm(dia)}` : " · média"}`}>
      <div className="space-y-3">
        {vals.map(({ t, v }) => (
          <div key={t.turno}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-white/70">{t.rotulo}</span>
              <span className="font-[family-name:var(--font-sora)] text-xl font-extrabold tabular-nums text-white">{v === null ? "—" : def.fmt(v)}</span>
            </div>
            <div className="mt-1 h-2.5 rounded-full bg-white/10">
              <div className="h-full rounded-full" style={{ width: `${((v ?? 0) / max) * 100}%`, background: COR_TURNO[t.turno] }} />
            </div>
          </div>
        ))}
        {lider && folga !== null && (
          <p className="text-sm text-white/60">
            <strong style={{ color: COR_TURNO[lider.t.turno] }}>{lider.t.rotulo}</strong> {formatPercent(folga, 0)} {def.menor ? "menor" : "à frente"}
          </p>
        )}
      </div>
    </Bloco>
  );
}

/** Detalhe de um turno: equipe, produção do recorte e onde ele vence. */
function DetalheTurno({ t, ranking, dia }: { t: ResumoTurno; ranking: Record<CriterioTurno, TurnoSep | null>; dia: string | null }) {
  const vence = CRITERIOS.filter((c) => ranking[c.id] === t.turno);
  const item = (rot: string, v: string) => (
    <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.06] py-1.5 text-sm first:border-t-0">
      <span className="text-white/60">{rot}</span>
      <span className="font-bold tabular-nums text-white">{v}</span>
    </div>
  );
  return (
    <>
      <Bloco titulo={`${t.rotulo} · equipe`}>
        {item("Pessoas no turno", n0(t.equipe.pessoas))}
        {item("Separadores", n0(t.equipe.separadores))}
        {item("Conferentes", n0(t.equipe.conferentes))}
        {item("Horas de separação por dia", t.equipe.horasSeparadorDia ? `${n0(t.equipe.horasSeparadorDia)} h` : "—")}
        {item("Custo do período", t.custo === null ? "—" : semCentavos(t.custo))}
      </Bloco>
      <Bloco titulo={`${t.rotulo} · ${dia ? ddmm(dia) : "no mês"}`}>
        {item("Peso separado", kg(t.kg))}
        {item("Endereços visitados", n0(t.linhas))}
        {item("Pedidos", n0(t.pedidos))}
        {item("Caixas", n0(t.caixas))}
        {item("Kg por endereço", t.kgPorLinha === null ? "—" : n1(t.kgPorLinha))}
        {item("Participação nos endereços", t.participacaoLinhas === null ? "—" : formatPercent(t.participacaoLinhas, 0))}
      </Bloco>
      {vence.length > 0 && (
        <p className="text-sm text-white/60">
          Vence em: <span className="text-white">{vence.map((c) => c.rotulo.toLowerCase()).join(" · ")}</span>
        </p>
      )}
    </>
  );
}

// --- Todos os indicadores (tabela) ----------------------------------------------

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
  { grupo: "Média por dia trabalhado", rotulo: "Peso separado", valor: (t) => t.porDia?.kg ?? null, fmt: kg, sentido: null },
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
  { grupo: "Origem do dado", rotulo: "Turno pelo cadastro", valor: (t) => (t.linhas ? t.linhasPorOperador / t.linhas : null), fmt: (v) => formatPercent(v, 0), sentido: null },
];

function TabelaComparativo({ turnos }: { turnos: ResumoTurno[] }) {
  const melhorDe = (l: LinhaComparativo): TurnoSep | null => {
    if (!l.sentido) return null;
    const c = turnos.filter((t) => t.linhas > 0 && t.equipe.separadores > 0).map((t) => ({ t: t.turno, v: l.valor(t) })).filter((x): x is { t: TurnoSep; v: number } => x.v !== null);
    if (c.length < 2) return null;
    const alvo = l.sentido === "maior" ? Math.max(...c.map((x) => x.v)) : Math.min(...c.map((x) => x.v));
    const w = c.filter((x) => x.v === alvo);
    return w.length === 1 ? w[0].t : null;
  };
  const dif = (l: LinhaComparativo): ReactNode => {
    const [a, b] = turnos.map(l.valor);
    if (a === null || b === null || a === undefined || b === undefined) return "";
    return <span className="text-white/50">{sinalPct(varRel(b, a))}</span>;
  };
  return (
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
            <th className="py-2 text-right font-semibold">Noite × Dia</th>
            <th className="py-2 text-right font-semibold">Setor</th>
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
                  <td colSpan={turnos.length + 3} className="pt-3 pb-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-amber-300/80">
                    {l.grupo}
                  </td>
                </tr>
              ),
              <tr key={l.rotulo + l.grupo} className="border-t border-white/[0.06]">
                <td className="py-1.5 text-white/80">{l.rotulo}</td>
                {turnos.map((t) => {
                  const v = l.valor(t);
                  return (
                    <td key={t.turno} className={`py-1.5 text-right tabular-nums ${melhor === t.turno ? "font-bold text-amber-300" : "text-white"}`}>
                      {v === null ? "—" : l.fmt(v)}
                    </td>
                  );
                })}
                <td className="py-1.5 text-right tabular-nums">{dif(l)}</td>
                <td className="py-1.5 text-right tabular-nums text-white/55">{tot === null ? "" : l.fmt(tot)}</td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

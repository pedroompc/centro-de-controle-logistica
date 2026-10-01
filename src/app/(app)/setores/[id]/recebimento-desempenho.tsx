"use client";

import { useMemo, useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { indicesMelhores, type IndicadoresRecebimento } from "@/domain/recebimento";
import { percentil } from "@/domain/recebimento-projecao";
import { Chip, Segmentado, RotuloFiltro, GraficoBarras, Faisca } from "./bi";
import type { AnaliseRecebimento } from "./recebimento-dados";

const inteiro = new Intl.NumberFormat("pt-BR");
const dec1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const ton = (kg: number) => `${(kg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} t`;
const mesCurto = (m: string) => formatMesAno(m).slice(0, 3) + "/" + m.slice(2, 4);
const div = (a: number, b: number) => (b > 0 ? a / b : null);

// --- Métricas: valor do mês e valor agregado do período filtrado -------------

interface Metrica {
  chave: string;
  rotulo: string;
  fmt: (v: number) => string;
  doMes: (r: IndicadoresRecebimento) => number | null;
  doPeriodo: (sel: IndicadoresRecebimento[]) => number | null; // soma ou razão das somas
  maiorEhBom?: boolean; // sem direção = sem "melhor"
  ajuda: string;
}

const soma = (sel: IndicadoresRecebimento[], f: (r: IndicadoresRecebimento) => number) => sel.reduce((t, r) => t + f(r), 0);

const METRICAS: Metrica[] = [
  { chave: "receita", rotulo: "Receita de descarrego", fmt: formatBRL, doMes: (r) => r.receitaDescarrego, doPeriodo: (s) => soma(s, (r) => r.receitaDescarrego), maiorEhBom: true, ajuda: "soma do período" },
  { chave: "custo", rotulo: "Custo do recebimento", fmt: formatBRL, doMes: (r) => r.custoPeriodo, doPeriodo: (s) => soma(s, (r) => r.custoPeriodo), maiorEhBom: false, ajuda: "folha + empilhador + empilhadeira" },
  { chave: "resultado", rotulo: "Resultado", fmt: formatBRL, doMes: (r) => r.resultado, doPeriodo: (s) => soma(s, (r) => r.resultado), maiorEhBom: true, ajuda: "descarrego − custo" },
  { chave: "custoDesc", rotulo: "Custo / descarrego", fmt: (v) => formatPercent(v), doMes: (r) => r.custoSobreDescarrego, doPeriodo: (s) => div(soma(s, (r) => r.custoPeriodo), soma(s, (r) => r.receitaDescarrego)), maiorEhBom: false, ajuda: "quanto da receita a equipe consome" },
  { chave: "custoT", rotulo: "Custo por tonelada", fmt: formatBRL, doMes: (r) => r.custoPorTonelada, doPeriodo: (s) => div(soma(s, (r) => r.custoPeriodo), soma(s, (r) => r.pesoKg) / 1000), maiorEhBom: false, ajuda: "custo ÷ toneladas" },
  { chave: "carros", rotulo: "Carros", fmt: (v) => inteiro.format(Math.round(v)), doMes: (r) => r.carros, doPeriodo: (s) => soma(s, (r) => r.carros), maiorEhBom: true, ajuda: "descarregados" },
  { chave: "peso", rotulo: "Peso", fmt: ton, doMes: (r) => r.pesoKg, doPeriodo: (s) => soma(s, (r) => r.pesoKg), maiorEhBom: true, ajuda: "descarregado" },
  { chave: "carrosDia", rotulo: "Carros por dia", fmt: dec1, doMes: (r) => r.carrosPorDia, doPeriodo: (s) => div(soma(s, (r) => r.carros), soma(s, (r) => r.diasDescarrego)), maiorEhBom: true, ajuda: "por dia de descarrego" },
  { chave: "kgAjDia", rotulo: "Kg por ajudante / dia", fmt: (v) => formatKg(v), doMes: (r) => r.kgPorAjudanteDia, doPeriodo: (s) => div(soma(s, (r) => r.pesoKg), soma(s, (r) => r.equipe.ajudantes * r.diasDescarrego)), maiorEhBom: true, ajuda: "média da equipe" },
  { chave: "carrosConf", rotulo: "Carros por conferente", fmt: (v) => inteiro.format(Math.round(v)), doMes: (r) => r.carrosPorConferente, doPeriodo: (s) => div(soma(s, (r) => r.carros), soma(s, (r) => r.equipe.conferentes)), maiorEhBom: true, ajuda: "por mês" },
  { chave: "custoFat", rotulo: "Custo / faturamento líquido", fmt: (v) => formatPercent(v, 2), doMes: (r) => r.custoSobreFaturamento, doPeriodo: (s) => { const c = s.filter((r) => r.faturamentoLiquido); return div(soma(c, (r) => r.custoPeriodo), soma(c, (r) => r.faturamentoLiquido ?? 0)); }, maiorEhBom: false, ajuda: "meses com faturamento" },
  { chave: "dias", rotulo: "Dias de descarrego", fmt: (v) => inteiro.format(v), doMes: (r) => r.diasDescarrego, doPeriodo: (s) => soma(s, (r) => r.diasDescarrego), ajuda: "com lançamento" },
];

const KPIS_TOPO = ["resultado", "receita", "custo", "custoDesc", "kgAjDia", "carrosConf"];

/** Aba Desempenho do setor Recebimento — estilo BI: filtra, clica, compara. */
export function RecebimentoDesempenho({ dados }: { dados: AnaliseRecebimento }) {
  const { serie, dias, linhas, empilhador } = dados;
  const todos = serie.map((r) => r.mes);
  const fechados = serie.filter((r) => r.fracaoMes >= 1).map((r) => r.mes);
  const [meses, setMeses] = useState<string[]>(fechados.length ? fechados.slice(-3) : todos);
  const [metrica, setMetrica] = useState("resultado");
  const [foco, setFoco] = useState<string | null>(null);
  const [escopoDia, setEscopoDia] = useState<"mes" | "periodo">("mes");

  const sel = useMemo(() => serie.filter((r) => meses.includes(r.mes)), [serie, meses]);
  const m = METRICAS.find((x) => x.chave === metrica)!;
  const focoMes = foco && meses.includes(foco) ? foco : (sel.at(-1)?.mes ?? null);
  const rFoco = serie.find((r) => r.mes === focoMes) ?? null;

  if (serie.length === 0) return <Card className="p-8 text-center text-slate-400">Sem dados de recebimento ainda.</Card>;

  const alternar = (mes: string) => setMeses((cur) => (cur.includes(mes) ? (cur.length > 1 ? cur.filter((x) => x !== mes) : cur) : [...cur, mes].sort()));
  const melhoresDe = (mm: Metrica) =>
    mm.maiorEhBom === undefined ? new Set<number>() : indicesMelhores(sel.map((r) => ({ valor: mm.doMes(r), fechado: r.fracaoMes >= 1 })), mm.maiorEhBom);
  const melhoresAtual = melhoresDe(m);

  // Dia a dia: o mês em foco ou o período todo.
  const diasEscopo = dias.filter((d) => (escopoDia === "mes" ? focoMes && d.data.startsWith(focoMes.slice(0, 7)) : meses.some((x) => d.data.startsWith(x.slice(0, 7)))));
  const p90 = percentil(diasEscopo.map((d) => d.carros), 0.9);
  const mediaDia = diasEscopo.length ? diasEscopo.reduce((t, d) => t + d.carros, 0) / diasEscopo.length : 0;

  return (
    <div className="space-y-5">
      {/* Barra de filtros */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <RotuloFiltro>Período</RotuloFiltro>
          {serie.map((r) => (
            <Chip key={r.mes} ativo={meses.includes(r.mes)} onClick={() => alternar(r.mes)} title={r.fracaoMes < 1 ? "mês em andamento" : undefined}>
              {mesCurto(r.mes)}
              {r.fracaoMes < 1 && " ·parcial"}
            </Chip>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <RotuloFiltro>Atalhos</RotuloFiltro>
          <Chip ativo={false} onClick={() => setMeses(fechados.slice(-3).length ? fechados.slice(-3) : todos)}>Último trimestre</Chip>
          <Chip ativo={false} onClick={() => setMeses(fechados.length ? fechados : todos)}>Só fechados</Chip>
          <Chip ativo={false} onClick={() => setMeses(todos)}>Tudo</Chip>
        </div>
        {serie.some((r) => r.equipeEstimada) && (
          <span className="ml-auto text-xs text-slate-400">Meses sem foto por cargo usam a equipe de hoje (estimativa).</span>
        )}
      </Card>

      {/* KPIs do período — clicar troca o gráfico */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {KPIS_TOPO.map((k) => {
          const mm = METRICAS.find((x) => x.chave === k)!;
          const v = mm.doPeriodo(sel);
          const ativo = metrica === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setMetrica(k)}
              className={`@container rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:shadow-md ${ativo ? "border-amber-400 ring-2 ring-amber-300/60" : "border-slate-200/80"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-[0.7rem] font-semibold uppercase tracking-wider text-slate-500">{mm.rotulo}</span>
                <Faisca valores={sel.map((r) => mm.doMes(r))} melhores={melhoresDe(mm)} />
              </div>
              {/* Fonte fluida (cqi): R$ 999.999,99 cabe sem quebrar linha. */}
              <div className="mt-1 whitespace-nowrap font-[family-name:var(--font-sora)] text-[clamp(1rem,11cqi,1.6rem)] font-extrabold tabular-nums text-[#141a4d]">
                {v === null ? "—" : mm.fmt(v)}
              </div>
              <div className="mt-1 truncate text-xs text-slate-400">{mm.ajuda}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Gráfico principal */}
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionTitle>{m.rotulo} por mês</SectionTitle>
              <p className="-mt-2 text-xs text-slate-400">Passe o mouse para ver o valor · clique num mês para o raio-X · verde = melhor mês fechado</p>
            </div>
            <select
              value={metrica}
              onChange={(e) => setMetrica(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#141a4d] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
            >
              {METRICAS.map((x) => (
                <option key={x.chave} value={x.chave}>
                  {x.rotulo}
                </option>
              ))}
            </select>
          </div>
          <GraficoBarras
            altura={330}
            fmt={m.fmt}
            selecionado={focoMes}
            onSelect={(k) => setFoco(k)}
            itens={sel.map((r, i) => ({
              chave: r.mes,
              rotulo: mesCurto(r.mes),
              valor: m.doMes(r),
              melhor: melhoresAtual.has(i),
              parcial: r.fracaoMes < 1,
              detalhe: r.fracaoMes < 1 ? `parcial · ${Math.round(r.fracaoMes * 100)}% do mês` : `${r.carros} carros · ${r.diasDescarrego} dias`,
            }))}
          />
        </Card>

        {/* Raio-X do mês em foco */}
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <SectionTitle>Raio-X · {focoMes ? formatMesAno(focoMes) : "—"}</SectionTitle>
            <span className="text-xs text-slate-400">vs média do período</span>
          </div>
          {rFoco && (
            <ul className="divide-y divide-slate-100">
              {METRICAS.filter((x) => x.chave !== "dias").map((x) => {
                const v = x.doMes(rFoco);
                // Média do período: para somas, por mês; para razões, a razão do período.
                const ehSoma = ["receita", "custo", "resultado", "carros", "peso"].includes(x.chave);
                const ref = ehSoma ? (x.doPeriodo(sel) ?? 0) / Math.max(1, sel.length) : x.doPeriodo(sel);
                const d = v !== null && ref ? (v - ref) / Math.abs(ref) : null;
                const bom = d === null || x.maiorEhBom === undefined || Math.abs(d) < 0.005 ? null : (d > 0) === x.maiorEhBom;
                return (
                  <li key={x.chave}>
                    <button type="button" onClick={() => setMetrica(x.chave)} className={`flex w-full items-center justify-between gap-3 py-2 text-left text-sm ${metrica === x.chave ? "font-semibold" : ""}`}>
                      <span className="text-slate-600">{x.rotulo}</span>
                      <span className="flex items-center gap-3 tabular-nums">
                        <span className="text-[#141a4d]">{v === null ? "—" : x.fmt(v)}</span>
                        <span className={`w-16 text-right text-xs font-bold ${bom === null ? "text-slate-400" : bom ? "text-emerald-600" : "text-rose-600"}`}>
                          {d === null ? "" : `${d >= 0 ? "▲" : "▼"} ${formatPercent(Math.abs(d), 0)}`}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {/* Dia a dia */}
        <Card className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <SectionTitle>Carros por dia</SectionTitle>
              <p className="-mt-2 text-xs text-slate-400">
                Média {dec1(mediaDia)} · dia forte {dec1(p90)} (9 em 10 dias abaixo) · âmbar = dia forte ou mais
              </p>
            </div>
            <Segmentado
              opcoes={[
                { valor: "mes", rotulo: focoMes ? mesCurto(focoMes) : "Mês" },
                { valor: "periodo", rotulo: "Período filtrado" },
              ]}
              valor={escopoDia}
              onChange={setEscopoDia}
            />
          </div>
          {diasEscopo.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sem descarrego lançado nesse recorte.</p>
          ) : (
            <GraficoBarras
              altura={200}
              rotuloValor={diasEscopo.length <= 16}
              fmt={(v) => `${inteiro.format(Math.round(v))}`}
              referencia={{ valor: p90, rotulo: "dia forte" }}
              itens={diasEscopo.map((d) => ({
                chave: d.data,
                rotulo: escopoDia === "mes" ? d.data.slice(8, 10) : `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`,
                valor: d.carros,
                detalhe: `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}${d.carros >= p90 ? " · dia forte" : ""}`,
                cor: d.carros >= p90 ? "#f5b301" : undefined,
              }))}
              cor="#2a327f"
            />
          )}
        </Card>

        {/* Composição do custo (equipe de hoje) */}
        <Card className="p-5">
          <SectionTitle>Do que é feito o custo (hoje)</SectionTitle>
          <ComposicaoCusto
            partes={[
              { rotulo: "Ajudantes", valor: linhas.find((l) => l.grupo === "ajudante")?.custoAtivos ?? 0, cor: "#2a327f" },
              { rotulo: "Conferentes", valor: linhas.find((l) => l.grupo === "conferente")?.custoAtivos ?? 0, cor: "#5b6fd6" },
              { rotulo: "Outros do setor", valor: linhas.find((l) => l.grupo === "outros")?.custoAtivos ?? 0, cor: "#8b93e0" },
              { rotulo: "Empilhador", valor: serie.at(-1)?.equipe.custoEmpilhador ?? 0, cor: "#c2820a" },
              { rotulo: "Equipamentos", valor: serie.at(-1)?.equipe.custoEquipamentos ?? 0, cor: "#f5b301" },
            ]}
          />
          {empilhador.candidatos === 0 && <p className="mt-3 text-xs text-amber-600">Nenhum funcionário ativo com cargo de máquina/empilhadeira — só a máquina entrou.</p>}
        </Card>
      </div>

      <TabelaCompleta serie={sel} />
    </div>
  );
}

function ComposicaoCusto({ partes }: { partes: { rotulo: string; valor: number; cor: string }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const vis = partes.filter((p) => p.valor > 0);
  const total = vis.reduce((t, p) => t + p.valor, 0);
  if (total === 0) return <p className="text-sm text-slate-400">Sem custo cadastrado.</p>;
  return (
    <div>
      <div className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums text-[#141a4d]">{formatBRL(total)}<span className="text-sm font-semibold text-slate-400"> /mês</span></div>
      <div className="mt-3 flex h-4 overflow-hidden rounded-full" onMouseLeave={() => setHover(null)}>
        {vis.map((p) => (
          <div
            key={p.rotulo}
            onMouseEnter={() => setHover(p.rotulo)}
            className="h-full border-r-2 border-white transition last:border-0"
            style={{ width: `${(p.valor / total) * 100}%`, background: p.cor, opacity: hover && hover !== p.rotulo ? 0.35 : 1 }}
            title={`${p.rotulo}: ${formatBRL(p.valor)}`}
          />
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {vis.map((p) => (
          <li
            key={p.rotulo}
            onMouseEnter={() => setHover(p.rotulo)}
            onMouseLeave={() => setHover(null)}
            className={`flex items-center justify-between rounded-lg px-2 py-1 text-sm transition ${hover === p.rotulo ? "bg-slate-50" : ""}`}
          >
            <span className="inline-flex items-center gap-2 text-slate-600">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.cor }} />
              {p.rotulo}
            </span>
            <span className="tabular-nums text-[#141a4d]">
              {formatBRL(p.valor)} <span className="text-xs text-slate-400">· {formatPercent(p.valor / total, 0)}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A tabela completa, recolhível — para quem quer o número exato. */
function TabelaCompleta({ serie }: { serie: IndicadoresRecebimento[] }) {
  return (
    <details className="group rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 text-sm font-semibold text-[#141a4d]">
        Tabela completa do período
        <span className="text-xs text-slate-400 group-open:hidden">abrir ▾</span>
        <span className="hidden text-xs text-slate-400 group-open:inline">fechar ▴</span>
      </summary>
      <div className="overflow-x-auto border-t border-slate-100">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-5 py-3 font-semibold">Indicador</th>
              {serie.map((r) => (
                <th key={r.mes} className="px-5 py-3 text-right font-semibold">
                  {formatMesAno(r.mes)}
                  {r.fracaoMes < 1 && <span className="ml-1 normal-case tracking-normal text-amber-600">parcial</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICAS.map((x) => {
              const melhores = x.maiorEhBom === undefined ? new Set<number>() : indicesMelhores(serie.map((r) => ({ valor: x.doMes(r), fechado: r.fracaoMes >= 1 })), x.maiorEhBom);
              return (
                <tr key={x.chave} className="border-t border-slate-50">
                  <td className="px-5 py-2.5 font-medium text-[#141a4d]">{x.rotulo}</td>
                  {serie.map((r, i) => {
                    const v = x.doMes(r);
                    return (
                      <td key={r.mes} className={`px-5 py-2.5 text-right tabular-nums ${melhores.has(i) ? "font-bold text-emerald-600" : "text-slate-700"}`}>
                        {v === null ? <span className="text-slate-300">—</span> : x.fmt(v)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="border-t border-slate-50">
              <td className="px-5 py-2.5 font-medium text-[#141a4d]">Equipe <span className="text-xs font-normal text-slate-400">aj · conf · emp</span></td>
              {serie.map((r) => (
                <td key={r.mes} className="px-5 py-2.5 text-right tabular-nums text-slate-700">
                  {r.equipe.total} <span className="text-xs text-slate-400">({r.equipe.ajudantes} · {r.equipe.conferentes} · {r.equipe.empilhadores ?? 0})</span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="px-5 pb-4 text-xs text-slate-400">Médias da equipe (peso ÷ pessoas do cargo), não por pessoa. No mês parcial o custo entra proporcional aos dias corridos.</p>
    </details>
  );
}

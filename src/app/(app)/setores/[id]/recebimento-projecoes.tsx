"use client";

import { useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import { Chip, Segmentado, RotuloFiltro, GraficoLinhas } from "./bi";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import type { IndicadoresRecebimento } from "@/domain/recebimento";
import {
  baseDoRitmo,
  projetar,
  CENARIO_ATUAL,
  CENARIOS_RAPIDOS,
  type BaseRitmo,
  type PerfilDiario,
  type Cenario,
  type Capacidade,
  type Projecao,
} from "@/domain/recebimento-projecao";

const inteiro = new Intl.NumberFormat("pt-BR");
const dec1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const sinalBRL = (v: number) => `${v >= 0 ? "+" : "−"}${formatBRL(Math.abs(v))}`;

/** Selo de confiança — o que é dado, o que é inferência, o que é palpite. */
function Confianca({ nivel }: { nivel: "certo" | "provável" | "estimativa" }) {
  const cls = {
    certo: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    provável: "bg-sky-50 text-sky-700 ring-sky-200",
    estimativa: "bg-amber-50 text-amber-700 ring-amber-200",
  }[nivel];
  return <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide ring-1 ${cls}`}>{nivel}</span>;
}

function Stepper({ rotulo, valor, onChange, passo = 1, min = -99, max = 99, fmt = (v: number) => `${v > 0 ? "+" : ""}${v}`, ajuda }: {
  rotulo: string;
  valor: number;
  onChange: (v: number) => void;
  passo?: number;
  min?: number;
  max?: number;
  fmt?: (v: number) => string;
  ajuda?: string;
}) {
  const btn = "flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-lg font-bold text-[#141a4d] transition hover:bg-slate-50 disabled:opacity-30";
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{rotulo}</div>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" className={btn} disabled={valor <= min} onClick={() => onChange(Math.max(min, +(valor - passo).toFixed(2)))} aria-label={`Diminuir ${rotulo}`}>−</button>
        <span className="w-16 text-center font-[family-name:var(--font-sora)] text-xl font-extrabold tabular-nums text-[#141a4d]">{fmt(valor)}</span>
        <button type="button" className={btn} disabled={valor >= max} onClick={() => onChange(Math.min(max, +(valor + passo).toFixed(2)))} aria-label={`Aumentar ${rotulo}`}>+</button>
      </div>
      {ajuda && <div className="mt-1 text-xs text-slate-400">{ajuda}</div>}
    </div>
  );
}

const COR_SITUACAO: Record<Capacidade["situacao"], { barra: string; texto: string; fundo: string }> = {
  folga: { barra: "bg-emerald-500", texto: "text-emerald-700", fundo: "bg-emerald-50" },
  "no limite": { barra: "bg-amber-500", texto: "text-amber-700", fundo: "bg-amber-50" },
  "não dá conta": { barra: "bg-rose-500", texto: "text-rose-700", fundo: "bg-rose-50" },
};

function CardCapacidade({ titulo, cap, pessoas }: { titulo: string; cap: Capacidade; pessoas: number }) {
  const cor = COR_SITUACAO[cap.situacao];
  const uso = Number.isFinite(cap.uso) ? cap.uso : 2;
  return (
    <div className={`rounded-xl p-4 ${cor.fundo}`}>
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-[#141a4d]">{titulo}</span>
        <span className={`text-sm font-extrabold uppercase ${cor.texto}`}>{cap.situacao}</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white">
        <div className={`h-full rounded-full ${cor.barra}`} style={{ width: `${Math.min(100, uso * 100)}%` }} />
      </div>
      <div className="mt-2 text-xs text-slate-600">
        Dia forte projetado: <strong>{dec1(cap.demandaDia)} carros</strong> · aguentam <strong>{dec1(cap.capacidadeDia)}</strong> ({pessoas} × {dec1(cap.porPessoaDia)} por pessoa) · uso{" "}
        <strong>{Number.isFinite(cap.uso) ? formatPercent(cap.uso, 0) : "—"}</strong>
      </div>
      {cap.situacao !== "folga" && cap.necessarios > pessoas && (
        <div className={`mt-1 text-xs font-semibold ${cor.texto}`}>Precisaria de {cap.necessarios} para o dia forte sem hora extra.</div>
      )}
    </div>
  );
}

/** Card "atual → cenário" com a diferença colorida (verde = melhora). */
function Comparativo({ rotulo, atual, cenario, fmt, maiorEhBom = true, destaque = false }: {
  rotulo: string;
  atual: number | null;
  cenario: number | null;
  fmt: (v: number) => string;
  maiorEhBom?: boolean;
  destaque?: boolean;
}) {
  const dif = atual !== null && cenario !== null ? cenario - atual : null;
  const mudou = dif !== null && Math.abs(dif) > Math.abs(atual ?? 0) * 1e-6 + 1e-9;
  const bom = mudou && (dif! > 0) === maiorEhBom;
  return (
    <div className={`@container rounded-2xl p-4 ${destaque ? "bg-[#141a4d] text-white" : "border border-slate-200/80 bg-white shadow-sm"}`}>
      <div className={`text-[0.7rem] font-semibold uppercase tracking-wider ${destaque ? "text-white/60" : "text-slate-500"}`}>{rotulo}</div>
      <div className={`mt-1.5 whitespace-nowrap font-[family-name:var(--font-sora)] text-[clamp(1rem,10cqi,1.5rem)] font-extrabold tabular-nums ${destaque ? "text-amber-300" : "text-[#141a4d]"}`}>
        {cenario === null ? "—" : fmt(cenario)}
      </div>
      <div className={`mt-1 text-xs ${destaque ? "text-white/60" : "text-slate-400"}`}>
        sem mudança {atual === null ? "—" : fmt(atual)}
        {mudou && (
          <span className={`ml-2 font-bold ${bom ? (destaque ? "text-emerald-300" : "text-emerald-600") : destaque ? "text-rose-300" : "text-rose-600"}`}>
            {dif! > 0 ? "▲" : "▼"} {fmt(Math.abs(dif!))}
          </span>
        )}
      </div>
    </div>
  );
}

const iguais = (a: Cenario, b: Partial<Cenario>) =>
  (b.deltaAjudantes ?? 0) === a.deltaAjudantes && (b.deltaConferentes ?? 0) === a.deltaConferentes && (b.carrosExtrasDia ?? 0) === a.carrosExtrasDia;

/** Aba Projeções do setor Recebimento — simulador estilo BI. */
export function RecebimentoProjecoes({
  serie,
  custoMedio,
  perfil,
}: {
  serie: IndicadoresRecebimento[];
  custoMedio: { ajudante: number; conferente: number };
  perfil: PerfilDiario;
}) {
  // Base = média dos últimos N meses FECHADOS (janela que anda com o calendário).
  const [janela, setJanela] = useState<number>(3);
  const base: BaseRitmo | null = baseDoRitmo(serie, custoMedio, janela);
  const qtdFechados = serie.filter((r) => r.fracaoMes >= 1 && r.carros > 0).length;
  const [cen, setCen] = useState<Cenario>(CENARIO_ATUAL);
  const [crescimento, setCrescimento] = useState(0);
  const [horizonte, setHorizonte] = useState(12);
  const [serieGrafico, setSerieGrafico] = useState<"acumulado" | "mensal">("acumulado");
  const [faturamentoAno, setFaturamentoAno] = useState(base?.faturamentoMes ? Math.round((base.faturamentoMes * 12) / 1e6) : 540);

  if (!base) {
    return <Card className="p-8 text-center text-slate-400">Ainda não há mês fechado com descarrego para servir de base.</Card>;
  }

  const comum = { crescimentoMensal: crescimento / 100, meses: horizonte };
  const atual = projetar(base, perfil, { ...CENARIO_ATUAL, ...comum });
  const sim = projetar(base, perfil, { ...cen, ...comum });
  const rotulos = sim.meses.map((x) => `M${x.m}`);
  const acum = (p: Projecao) => p.meses.reduce<number[]>((acc, x) => [...acc, (acc.at(-1) ?? 0) + x.resultado], []);
  const baseMeses = base.meses.map((x) => formatMesAno(x).slice(0, 3)).join(", ");
  const aplicar = (c: Partial<Cenario>) => setCen({ ...CENARIO_ATUAL, ...c });

  return (
    <div className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Painel de controles */}
        <Card className="space-y-6 self-start p-5 xl:sticky xl:top-4">
          <div className="flex items-center justify-between">
            <SectionTitle>Cenário</SectionTitle>
            <button type="button" onClick={() => { setCen(CENARIO_ATUAL); setCrescimento(0); }} className="-mt-3 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              Zerar
            </button>
          </div>

          <div>
            <RotuloFiltro>Base da projeção</RotuloFiltro>
            <div className="mt-2">
              <Segmentado
                opcoes={[
                  { valor: 3, rotulo: "Últimos 3 meses" },
                  { valor: 6, rotulo: "Últimos 6" },
                  { valor: 999, rotulo: "Todos fechados" },
                ]}
                valor={janela}
                onChange={setJanela}
              />
            </div>
            <div className="mt-1 text-[0.65rem] text-slate-400">
              {qtdFechados} {qtdFechados === 1 ? "mês fechado" : "meses fechados"} hoje
              {qtdFechados <= 3 ? " — as três opções ainda dão o mesmo resultado" : ""} · 3 reage rápido, mais meses suaviza
            </div>
          </div>

          <div>
            <RotuloFiltro>Horizonte</RotuloFiltro>
            <div className="mt-2">
              <Segmentado opcoes={[{ valor: 6, rotulo: "6 meses" }, { valor: 12, rotulo: "1 ano" }, { valor: 24, rotulo: "2 anos" }]} valor={horizonte} onChange={setHorizonte} />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <RotuloFiltro>Crescimento de carros</RotuloFiltro>
              <span className="text-sm font-extrabold tabular-nums text-[#141a4d]">{crescimento > 0 ? "+" : ""}{dec1(crescimento)}% ao mês</span>
            </div>
            <input type="range" min={-5} max={5} step={0.5} value={crescimento} onChange={(e) => setCrescimento(Number(e.target.value))} className="mt-2 w-full accent-amber-500" />
            <div className="flex justify-between text-[0.65rem] text-slate-400"><span>−5%</span><span>ritmo de hoje</span><span>+5%</span></div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <RotuloFiltro>Carros a mais por dia</RotuloFiltro>
              <span className="text-sm font-extrabold tabular-nums text-[#141a4d]">{cen.carrosExtrasDia > 0 ? "+" : ""}{dec1(cen.carrosExtrasDia)}</span>
            </div>
            <input type="range" min={-3} max={10} step={0.5} value={cen.carrosExtrasDia} onChange={(e) => setCen({ ...cen, carrosExtrasDia: Number(e.target.value) })} className="mt-2 w-full accent-amber-500" />
            <div className="text-[0.65rem] text-slate-400">hoje {dec1(base.diasMes > 0 ? base.carrosMes / base.diasMes : 0)} carros por dia em média</div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Stepper rotulo="Ajudantes" valor={cen.deltaAjudantes} min={-base.ajudantes} onChange={(v) => setCen({ ...cen, deltaAjudantes: v })} ajuda={`hoje ${base.ajudantes} · ${formatBRL(base.custoAjudante)}`} />
            <Stepper rotulo="Conferentes" valor={cen.deltaConferentes} min={-base.conferentes} onChange={(v) => setCen({ ...cen, deltaConferentes: v })} ajuda={`hoje ${base.conferentes} · ${formatBRL(base.custoConferente)}`} />
          </div>

          <div>
            <RotuloFiltro>Cenários prontos</RotuloFiltro>
            <div className="mt-2 flex flex-wrap gap-2">
              {CENARIOS_RAPIDOS.map((c) => (
                <Chip key={c.nome} ativo={iguais(cen, c.cenario)} onClick={() => aplicar(c.cenario)}>{c.nome}</Chip>
              ))}
            </div>
          </div>

          <p className="border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-400">
            Simulação, não previsão. Base: média de <strong className="text-slate-500">{baseMeses}</strong> — {inteiro.format(Math.round(base.carrosMes))} carros/mês,{" "}
            {formatBRL(base.receitaPorCarro)} e {formatKg(base.kgPorCarro)} por carro, {formatBRL(base.custoMes)}/mês de custo. Sem reajuste salarial.
          </p>
        </Card>

        {/* Resultado do cenário */}
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Comparativo destaque rotulo={`Resultado em ${horizonte} meses`} atual={atual.anual.resultado} cenario={sim.anual.resultado} fmt={formatBRL} />
            <Comparativo rotulo="Receita no último mês da projeção" atual={atual.mensal.receita} cenario={sim.mensal.receita} fmt={formatBRL} />
            <Comparativo rotulo="Custo por mês" atual={atual.mensal.custo} cenario={sim.mensal.custo} fmt={formatBRL} maiorEhBom={false} />
            <Comparativo rotulo="Custo / descarrego" atual={atual.mensal.custoSobreDescarrego} cenario={sim.mensal.custoSobreDescarrego} fmt={(v) => formatPercent(v)} maiorEhBom={false} />
            <Comparativo rotulo="Carros no último mês da projeção" atual={atual.mensal.carros} cenario={sim.mensal.carros} fmt={(v) => inteiro.format(Math.round(v))} />
            <Comparativo rotulo="Kg por ajudante / dia" atual={atual.mensal.kgPorAjudanteDia} cenario={sim.mensal.kgPorAjudanteDia} fmt={(v) => formatKg(v)} />
            <Comparativo rotulo="Carros por conferente" atual={atual.mensal.carrosPorConferente} cenario={sim.mensal.carrosPorConferente} fmt={(v) => inteiro.format(Math.round(v))} />
            <Comparativo rotulo="Custo / faturamento líquido" atual={atual.mensal.custoSobreFaturamento} cenario={sim.mensal.custoSobreFaturamento} fmt={(v) => formatPercent(v, 2)} maiorEhBom={false} />
          </div>

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <SectionTitle>{serieGrafico === "acumulado" ? "Resultado acumulado" : "Receita × custo por mês"}</SectionTitle>
              <Segmentado
                opcoes={[{ valor: "acumulado", rotulo: "Acumulado: hoje × cenário" }, { valor: "mensal", rotulo: "Receita × custo" }]}
                valor={serieGrafico}
                onChange={setSerieGrafico}
              />
            </div>
            {serieGrafico === "acumulado" ? (
              <GraficoLinhas
                rotulos={rotulos}
                fmt={(v) => formatBRL(v).replace(",00", "")}
                series={[
                  { nome: "Se nada mudar", cor: "#94a3b8", valores: acum(atual), tracejada: true },
                  { nome: "Cenário", cor: "#2a327f", valores: acum(sim) },
                ]}
              />
            ) : (
              <GraficoLinhas
                rotulos={rotulos}
                fmt={(v) => formatBRL(v).replace(",00", "")}
                series={[
                  { nome: "Receita de descarrego", cor: "#2a327f", valores: sim.meses.map((x) => x.receita) },
                  { nome: "Custo do recebimento", cor: "#c2820a", valores: sim.meses.map((x) => x.custo) },
                ]}
              />
            )}
          </Card>

          <div className="grid gap-3 lg:grid-cols-2">
            <CardCapacidade titulo="Ajudantes dão conta?" cap={sim.ajudante} pessoas={sim.ajudantes} />
            <CardCapacidade titulo="Conferentes dão conta?" cap={sim.conferente} pessoas={sim.conferentes} />
          </div>
        </div>
      </div>

      {/* Cenários prontos lado a lado — clique aplica */}
      <Card className="overflow-hidden">
        <div className="px-6 pt-6">
          <SectionTitle>Comparar cenários · clique para aplicar</SectionTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3 text-left font-semibold">Cenário</th>
                <th className="px-4 py-3 text-right font-semibold">Resultado / mês</th>
                <th className="px-4 py-3 text-right font-semibold">vs hoje</th>
                <th className="px-4 py-3 text-right font-semibold">Custo / descarrego</th>
                <th className="px-4 py-3 text-right font-semibold">Ajudantes</th>
                <th className="px-6 py-3 text-right font-semibold">Conferentes</th>
              </tr>
            </thead>
            <tbody>
              {CENARIOS_RAPIDOS.map((c) => {
                const p: Projecao = projetar(base, perfil, { ...CENARIO_ATUAL, ...comum, ...c.cenario });
                const dif = p.mensal.resultado - atual.mensal.resultado;
                const ativo = iguais(cen, c.cenario);
                return (
                  <tr key={c.nome} onClick={() => aplicar(c.cenario)} className={`cursor-pointer border-b border-slate-50 transition last:border-0 hover:bg-amber-50/50 ${ativo ? "bg-amber-50" : ""}`}>
                    <td className="px-6 py-3 font-medium text-[#141a4d]">{ativo && "▸ "}{c.nome}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{formatBRL(p.mensal.resultado)}</td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${dif >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{sinalBRL(dif)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">{p.mensal.custoSobreDescarrego === null ? "—" : formatPercent(p.mensal.custoSobreDescarrego)}</td>
                    <td className={`px-4 py-3 text-right text-xs font-bold uppercase ${COR_SITUACAO[p.ajudante.situacao].texto}`}>{p.ajudante.situacao}</td>
                    <td className={`px-6 py-3 text-right text-xs font-bold uppercase ${COR_SITUACAO[p.conferente.situacao].texto}`}>{p.conferente.situacao}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-6 py-4 text-xs text-slate-400">
          &quot;Dar conta&quot; = o dia forte de hoje ({dec1(perfil.p90)} carros; 9 em 10 dias ficam abaixo) mais os carros extras, contra o maior dia que a
          equipe já fez ({inteiro.format(perfil.pico)} carros, talvez com hora extra) — repartido por pessoa. Até 85% de uso = folga; até 100% = no limite;
          acima = não dá conta sem hora extra ou mais gente.
        </p>
      </Card>

      <Mercado base={base} faturamentoAno={faturamentoAno} setFaturamentoAno={setFaturamentoAno} />
    </div>
  );
}

// --- Comparação com o mercado ------------------------------------------------

const FONTE_FDC =
  "https://ci.fdc.org.br/AcervoDigital/Relat%C3%B3rios%20de%20Pesquisa/Relat%C3%B3rios%20de%20pesquisa%202018/Apresentacao_Custos_Logisticos_no%20Brasil%202018_FDC%20_%20revRVC%20abr18%20(002).pdf";
const FONTE_SETCESP = "https://setcesp.org.br/imprensa/apenas-46-dos-centros-distribuicao-da-grande-sao-paulo-emitem-nota-fiscal/";

function Faixa({ valor, min, max, fmt, menorEhBom = false }: { valor: number; min: number; max: number; fmt: (v: number) => string; menorEhBom?: boolean }) {
  // Régua: 0 → 2×max; faixa de referência pintada; marcador no seu valor.
  const topo = max * 2;
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / topo) * 100))}%`;
  const dentro = valor >= min && valor <= max;
  // Em custo, ficar abaixo da faixa é bom (verde); acima pede atenção (âmbar).
  const cor = dentro ? "text-sky-700" : valor > max ? (menorEhBom ? "text-amber-700" : "text-slate-600") : menorEhBom ? "text-emerald-700" : "text-slate-600";
  return (
    <div>
      <div className="relative mt-3 h-3 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 rounded-full bg-sky-200" style={{ left: pos(min), width: `calc(${pos(max)} - ${pos(min)})` }} />
        <div className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded-full bg-[#141a4d]" style={{ left: pos(valor) }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-400">
        <span>faixa: {fmt(min)} a {fmt(max)}</span>
        <span className={`font-semibold ${cor}`}>
          você: {fmt(valor)} · {dentro ? "dentro" : valor > max ? "acima" : "abaixo"}
        </span>
      </div>
    </div>
  );
}

function Mercado({ base, faturamentoAno, setFaturamentoAno }: { base: BaseRitmo; faturamentoAno: number; setFaturamentoAno: (v: number) => void }) {
  const fatAno = faturamentoAno * 1e6;
  const custoAno = base.custoMes * 12;
  const custoSobreFat = fatAno > 0 ? custoAno / fatAno : 0;
  const kgAjDia = base.ajudantes > 0 && base.diasMes > 0 ? base.pesoMes / base.ajudantes / base.diasMes : 0;

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionTitle>Estou dentro da média?</SectionTitle>
          <p className="-mt-2 max-w-2xl text-sm text-slate-500">
            Não existe estudo público de recebimento em distribuidora de carga seca em Pernambuco. Abaixo, o que há de referência — cada uma com o grau de
            confiança e a fonte. Use como régua, não como meta.
          </p>
        </div>
        <label className="text-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Faturamento anual (R$ milhões)</span>
          <input
            type="number"
            min={1}
            value={faturamentoAno}
            onChange={(e) => setFaturamentoAno(Math.max(1, Number(e.target.value) || 1))}
            className="mt-1 w-32 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#141a4d]">Custo do recebimento ÷ faturamento</span>
            <Confianca nivel="estimativa" />
          </div>
          <Faixa valor={custoSobreFat} min={0.003} max={0.008} fmt={(v) => formatPercent(v, 2)} menorEhBom />
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            {formatBRL(custoAno)}/ano sobre R$ {inteiro.format(faturamentoAno)} mi. A faixa de 0,3% a 0,8% é estimativa minha: o custo logístico médio das empresas
            brasileiras é <strong>12,37% do faturamento</strong> e a armazenagem é <strong>17,7%</strong> dele (≈ 2,2% do faturamento,{" "}
            <a href={FONTE_FDC} target="_blank" rel="noreferrer" className="text-amber-700 underline">FDC 2018</a>
            ); o recebimento costuma ser de um sexto a um terço da armazenagem.
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#141a4d]">O recebimento se paga?</span>
            <Confianca nivel="certo" />
          </div>
          <div className="mt-3 font-[family-name:var(--font-sora)] text-3xl font-extrabold tabular-nums text-[#141a4d]">
            {base.custoMes > 0 ? `${dec1(base.receitaMes / base.custoMes)}×` : "—"}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-slate-500">
            A receita de descarrego cobre o custo da equipe {base.custoMes > 0 ? dec1(base.receitaMes / base.custoMes) : "—"} vezes ({formatBRL(base.receitaMes)} contra{" "}
            {formatBRL(base.custoMes)} por mês). Isso é dado seu, não referência. Na maior parte das distribuidoras o recebimento é só custo; aqui ele é um centro
            de resultado — o risco é a receita depender de fornecedor aceitar pagar a descarga.
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#141a4d]">Quanto você cobra por carro</span>
            <Confianca nivel="provável" />
          </div>
          <Faixa valor={base.receitaPorCarro} min={280.9} max={400} fmt={formatBRL} />
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Na Grande São Paulo a descarga cobrada do motorista é em média <strong>R$ 280,90 por carreta</strong>, chegando a R$ 400 (
            <a href={FONTE_SETCESP} target="_blank" rel="noreferrer" className="text-amber-700 underline">SETCESP</a>
            ). Sua média é {formatBRL(base.receitaPorCarro)} por carro com {formatKg(base.kgPorCarro)} — a comparação é imperfeita: lá é por veículo, aqui a tabela
            é por tonelada e tipo de carga, e é outro estado.
          </p>
        </div>

        <div className="rounded-xl border border-slate-100 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-[#141a4d]">Kg por ajudante por dia</span>
            <Confianca nivel="estimativa" />
          </div>
          <Faixa valor={kgAjDia} min={8000} max={15000} fmt={(v) => formatKg(v)} />
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Faixa estimada para carga seca <strong>batida</strong> (na mão): 1 a 2 t por hora por pessoa numa jornada efetiva de 8 h — não há fonte pública
            confiável para isso. Seu número inclui palete (Pal/Rem), que quem move é a empilhadeira, então tende a sair acima da faixa sem que a equipe esteja
            produzindo mais.
          </p>
        </div>
      </div>
    </Card>
  );
}

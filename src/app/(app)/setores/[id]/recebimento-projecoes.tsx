"use client";

import { useState } from "react";
import { Card, SectionTitle } from "@/components/ui";
import { formatBRL, formatKg, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import {
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

function Linha({ rotulo, atual, cenario, melhorMaior = true, render }: { rotulo: string; atual: number | null; cenario: number | null; melhorMaior?: boolean; render: (v: number) => string }) {
  const mudou = atual !== null && cenario !== null && Math.abs(cenario - atual) > 1e-9;
  const melhor = mudou && (melhorMaior ? cenario! > atual! : cenario! < atual!);
  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="py-2 text-slate-600">{rotulo}</td>
      <td className="py-2 text-right tabular-nums text-slate-500">{atual === null ? "—" : render(atual)}</td>
      <td className={`py-2 text-right font-bold tabular-nums ${!mudou ? "text-[#141a4d]" : melhor ? "text-emerald-600" : "text-rose-600"}`}>
        {cenario === null ? "—" : render(cenario)}
      </td>
    </tr>
  );
}

/** Aba Projeções do setor Recebimento. */
export function RecebimentoProjecoes({ base, perfil }: { base: BaseRitmo | null; perfil: PerfilDiario }) {
  const [cen, setCen] = useState<Cenario>(CENARIO_ATUAL);
  const [crescimento, setCrescimento] = useState(0);
  const [faturamentoAno, setFaturamentoAno] = useState(base?.faturamentoMes ? Math.round((base.faturamentoMes * 12) / 1e6) : 50);

  if (!base) {
    return <Card className="p-8 text-center text-slate-400">Ainda não há mês fechado com descarrego para servir de base.</Card>;
  }

  const ritmo = projetar(base, perfil, { ...CENARIO_ATUAL, crescimentoMensal: crescimento / 100 });
  const atual = projetar(base, perfil, CENARIO_ATUAL);
  const sim = projetar(base, perfil, { ...cen, crescimentoMensal: crescimento / 100 });
  const maxRes = Math.max(1, ...ritmo.meses.map((m) => Math.abs(m.resultado)));
  const baseMeses = base.meses.map((m) => formatMesAno(m).slice(0, 3)).join(", ");

  return (
    <div className="space-y-6">
      {/* Premissas */}
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl text-sm text-slate-600">
            <strong className="text-[#141a4d]">Como lê isto:</strong> é simulação de cenário, não previsão. A base é a média de{" "}
            <strong>{baseMeses}</strong>: {inteiro.format(Math.round(base.carrosMes))} carros/mês em {dec1(base.diasMes)} dias,{" "}
            {formatBRL(base.receitaPorCarro)} e {formatKg(base.kgPorCarro)} por carro, equipe de {base.ajudantes} ajudantes e {base.conferentes} conferentes a{" "}
            {formatBRL(base.custoMes)}/mês. Com {base.meses.length} meses de histórico não dá para medir sazonalidade.
          </div>
          <div className="w-72">
            <div className="flex items-baseline justify-between gap-3 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-slate-500">
              <span>Crescimento de carros</span>
              <span className="font-[family-name:var(--font-sora)] text-base font-extrabold normal-case tracking-normal text-[#141a4d]">
                {crescimento > 0 ? "+" : ""}
                {dec1(crescimento)}% ao mês
              </span>
            </div>
            <input type="range" min={-5} max={5} step={0.5} value={crescimento} onChange={(e) => setCrescimento(Number(e.target.value))} className="mt-2 w-full accent-amber-500" />
            <div className="text-xs text-slate-400">0% = o ritmo de hoje se mantém</div>
          </div>
        </div>
      </Card>

      {/* 1 ano no ritmo */}
      <Card className="p-6">
        <SectionTitle>Daqui a 1 ano, nesse ritmo</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Numero rotulo="Receita de descarrego em 12 meses" valor={formatBRL(ritmo.anual.receita)} sub={`${inteiro.format(Math.round(ritmo.anual.carros))} carros · ${dec1(ritmo.anual.pesoKg / 1e6)} mil t`} />
          <Numero rotulo="Custo do recebimento em 12 meses" valor={formatBRL(ritmo.anual.custo)} sub="sem reajuste salarial" />
          <Numero rotulo="Resultado em 12 meses" valor={formatBRL(ritmo.anual.resultado)} sub={`margem ${formatPercent(ritmo.anual.receita > 0 ? ritmo.anual.resultado / ritmo.anual.receita : 0)}`} destaque />
          <Numero
            rotulo="No 12º mês"
            valor={`${dec1(ritmo.mensal.carrosDia)} carros/dia`}
            sub={`kg/ajudante/dia ${ritmo.mensal.kgPorAjudanteDia === null ? "—" : formatKg(ritmo.mensal.kgPorAjudanteDia)} · ajudantes: ${ritmo.ajudante.situacao}`}
          />
        </div>
        <div className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-400">Resultado mês a mês (descarrego − custo)</div>
        <div className="mt-2 flex h-32 items-end gap-2">
          {ritmo.meses.map((m) => (
            <div key={m.m} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Mês ${m.m}: ${formatBRL(m.resultado)}`}>
              <div className={`w-full rounded-t ${m.resultado >= 0 ? "bg-[#2a327f]" : "bg-rose-500"}`} style={{ height: `${Math.max(3, (Math.abs(m.resultado) / maxRes) * 100)}%` }} />
              <span className="text-[0.65rem] text-slate-400">{m.m}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Simulador */}
      <Card className="p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle>Simulador · e se eu mudar…</SectionTitle>
          <button type="button" onClick={() => setCen(CENARIO_ATUAL)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Voltar ao atual
          </button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="grid grid-cols-2 gap-5 self-start">
            <Stepper rotulo="Ajudantes" valor={cen.deltaAjudantes} min={-base.ajudantes} onChange={(v) => setCen({ ...cen, deltaAjudantes: v })} ajuda={`hoje ${base.ajudantes} · ${formatBRL(base.custoAjudante)} cada`} />
            <Stepper rotulo="Conferentes" valor={cen.deltaConferentes} min={-base.conferentes} onChange={(v) => setCen({ ...cen, deltaConferentes: v })} ajuda={`hoje ${base.conferentes} · ${formatBRL(base.custoConferente)} cada`} />
            <Stepper rotulo="Carros a mais por dia" valor={cen.carrosExtrasDia} passo={0.5} min={-5} max={20} fmt={(v) => `${v > 0 ? "+" : ""}${dec1(v)}`} onChange={(v) => setCen({ ...cen, carrosExtrasDia: v })} ajuda={`hoje ${dec1(base.diasMes > 0 ? base.carrosMes / base.diasMes : 0)}/dia em média`} />
            <div className="col-span-2 space-y-3">
              <CardCapacidade titulo="Ajudantes dão conta?" cap={sim.ajudante} pessoas={sim.ajudantes} />
              <CardCapacidade titulo="Conferentes dão conta?" cap={sim.conferente} pessoas={sim.conferentes} />
            </div>
          </div>
          <div>
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="pb-2 text-left font-semibold">Por mês (12º mês)</th>
                  <th className="pb-2 text-right font-semibold">Atual</th>
                  <th className="pb-2 text-right font-semibold">Cenário</th>
                </tr>
              </thead>
              <tbody>
                <Linha rotulo="Carros" atual={atual.mensal.carros} cenario={sim.mensal.carros} render={(v) => inteiro.format(Math.round(v))} />
                <Linha rotulo="Peso" atual={atual.mensal.pesoKg} cenario={sim.mensal.pesoKg} render={(v) => `${dec1(v / 1000)} t`} />
                <Linha rotulo="Receita de descarrego" atual={atual.mensal.receita} cenario={sim.mensal.receita} render={formatBRL} />
                <Linha rotulo="Custo do recebimento" atual={atual.mensal.custo} cenario={sim.mensal.custo} render={formatBRL} melhorMaior={false} />
                <Linha rotulo="Resultado" atual={atual.mensal.resultado} cenario={sim.mensal.resultado} render={formatBRL} />
                <Linha rotulo="Custo / descarrego" atual={atual.mensal.custoSobreDescarrego} cenario={sim.mensal.custoSobreDescarrego} render={(v) => formatPercent(v)} melhorMaior={false} />
                <Linha rotulo="Custo / faturamento líquido" atual={atual.mensal.custoSobreFaturamento} cenario={sim.mensal.custoSobreFaturamento} render={(v) => formatPercent(v, 2)} melhorMaior={false} />
                <Linha rotulo="Kg por ajudante por dia" atual={atual.mensal.kgPorAjudanteDia} cenario={sim.mensal.kgPorAjudanteDia} render={(v) => formatKg(v)} />
                <Linha rotulo="Carros por conferente" atual={atual.mensal.carrosPorConferente} cenario={sim.mensal.carrosPorConferente} render={(v) => inteiro.format(Math.round(v))} />
              </tbody>
            </table>
            <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Em 12 meses o cenário dá <strong className={sim.anual.resultado >= atual.anual.resultado ? "text-emerald-600" : "text-rose-600"}>{sinalBRL(sim.anual.resultado - atual.anual.resultado)}</strong> de resultado
              em relação a ficar como está.
              {sim.ajudante.situacao === "não dá conta" && " Mas a equipe de ajudantes não aguenta o dia forte — o ganho depende de hora extra ou contratação."}
            </div>
          </div>
        </div>
      </Card>

      {/* Cenários rápidos */}
      <Card className="overflow-hidden">
        <div className="px-6 pt-6">
          <SectionTitle>Cenários prontos</SectionTitle>
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
                const p: Projecao = projetar(base, perfil, { ...CENARIO_ATUAL, ...c.cenario });
                const dif = p.mensal.resultado - atual.mensal.resultado;
                return (
                  <tr key={c.nome} className="border-b border-slate-50 last:border-0">
                    <td className="px-6 py-3 font-medium text-[#141a4d]">{c.nome}</td>
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

function Numero({ rotulo, valor, sub, destaque = false }: { rotulo: string; valor: string; sub: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${destaque ? "bg-[#141a4d] text-white" : "bg-slate-50"}`}>
      <div className={`text-xs font-semibold uppercase tracking-wider ${destaque ? "text-white/60" : "text-slate-500"}`}>{rotulo}</div>
      <div className={`mt-1 font-[family-name:var(--font-sora)] text-2xl font-extrabold tabular-nums ${destaque ? "text-amber-300" : "text-[#141a4d]"}`}>{valor}</div>
      <div className={`mt-1 text-xs ${destaque ? "text-white/60" : "text-slate-400"}`}>{sub}</div>
    </div>
  );
}

// --- Comparação com o mercado ------------------------------------------------

const FONTE_FDC =
  "https://ci.fdc.org.br/AcervoDigital/Relat%C3%B3rios%20de%20Pesquisa/Relat%C3%B3rios%20de%20pesquisa%202018/Apresentacao_Custos_Logisticos_no%20Brasil%202018_FDC%20_%20revRVC%20abr18%20(002).pdf";
const FONTE_SETCESP = "https://setcesp.org.br/imprensa/apenas-46-dos-centros-distribuicao-da-grande-sao-paulo-emitem-nota-fiscal/";

function Faixa({ valor, min, max, fmt }: { valor: number; min: number; max: number; fmt: (v: number) => string }) {
  // Régua: 0 → 2×max; faixa de referência pintada; marcador no seu valor.
  const topo = max * 2;
  const pos = (v: number) => `${Math.min(100, Math.max(0, (v / topo) * 100))}%`;
  const dentro = valor >= min && valor <= max;
  return (
    <div>
      <div className="relative mt-3 h-3 rounded-full bg-slate-100">
        <div className="absolute inset-y-0 rounded-full bg-sky-200" style={{ left: pos(min), width: `calc(${pos(max)} - ${pos(min)})` }} />
        <div className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded-full bg-[#141a4d]" style={{ left: pos(valor) }} />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-400">
        <span>faixa: {fmt(min)} a {fmt(max)}</span>
        <span className={`font-semibold ${dentro ? "text-sky-700" : valor > max ? "text-amber-700" : "text-slate-600"}`}>
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
          <Faixa valor={custoSobreFat} min={0.003} max={0.008} fmt={(v) => formatPercent(v, 2)} />
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

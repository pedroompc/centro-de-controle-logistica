"use client";

import { formatKg } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import { pesoMedioPorCarro, type PontoDescarregoMensal } from "@/domain/descarregamento-tendencia";
import type { ResumoDescarregos } from "../painel-actions";
import { compararPct } from "@/domain/comparacao";
import { KpiTV, MiniBarras, inteiro } from "./base";

/**
 * KPI comparativo do painel escuro: valor grande + variação vs o mês anterior.
 * "Mais é melhor" (descarrego): subir fica neutro (branco), cair ganha rose.
 */
function KpiComp({ label, value, atual, ant, prevLabel }: { label: string; value: string; atual: number; ant: number | null | undefined; prevLabel: string }) {
  return <KpiTV label={label} value={value} c={compararPct(atual, ant, true)} prevLabel={prevLabel} sub="sem mês anterior" />;
}

/** Descarregamento · comparação vs mês anterior + dia a dia do mês corrente. */
export function SecaoDescarregos({ dados, serie, mesLabel }: { dados: ResumoDescarregos; serie: PontoDescarregoMensal[]; mesLabel: string }) {
  // Rótulo = dia/mês (dd/mm) para ficar claro que o eixo é a data.
  const porDia = dados.porDia.map((d) => ({ rotulo: `${d.data.slice(8, 10)}/${d.data.slice(5, 7)}`, valor: d.descarregos }));

  const atual = serie.length > 0 ? serie[serie.length - 1] : null;
  const ant = serie.length > 1 ? serie[serie.length - 2] : null;
  const prevLabel = ant ? formatMesAno(ant.mes).slice(0, 3) : "";
  const carros = atual?.carros ?? dados.totalMes;
  const caixas = atual?.caixas ?? 0;
  const peso = atual?.pesoKg ?? 0;
  const pesoCarro = atual ? pesoMedioPorCarro(atual) : 0;

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiComp label="Carros no mês" value={inteiro.format(carros)} atual={carros} ant={atual && ant?.carros} prevLabel={prevLabel} />
        <KpiComp label="Caixas (volume)" value={inteiro.format(caixas)} atual={caixas} ant={atual && ant?.caixas} prevLabel={prevLabel} />
        <KpiComp label="Peso total" value={formatKg(peso)} atual={peso} ant={atual && ant?.pesoKg} prevLabel={prevLabel} />
        <KpiComp label="Peso por carro" value={`${formatKg(pesoCarro)}/carro`} atual={pesoCarro} ant={atual && ant ? pesoMedioPorCarro(ant) : null} prevLabel={prevLabel} />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-h-0 flex-col">
          <div className="mb-1 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Descarregos por dia · {mesLabel}</div>
          <div className="mb-3 text-xs text-white/45">quantidade em cima · data (dia/mês) embaixo</div>
          <div className="min-h-0 flex-1">
            <MiniBarras itens={porDia} cor="#f5b301" destaque />
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Por semana</div>
          <ul className="divide-y divide-white/10">
            {dados.porSemana.map((s) => (
              <li key={s.rotulo} className="flex items-center justify-between py-3">
                <span className="text-lg text-white/80">{s.rotulo}</span>
                <span className="font-[family-name:var(--font-sora)] text-2xl font-bold tabular-nums text-white">{inteiro.format(s.descarregos)}</span>
              </li>
            ))}
            {dados.porSemana.length === 0 && <li className="py-8 text-center text-white/40">Sem lançamentos.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}

// --- Frota · KM rodado (telemetria Fulltrack) -------------------------------

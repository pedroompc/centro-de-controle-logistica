"use client";

import { formatBRL } from "@/domain/format";
import type { ResumoFrotaTV } from "../painel-actions";
import { compararPct } from "@/domain/comparacao";
import { KpiTV, MiniBarras, inteiro } from "./base";

/**
 * KPI da frota com variação vs mês anterior. `ruimSubir` pinta de rose quando
 * sobe (km por entrega); km total não é bom nem ruim — fica neutro.
 */
function KpiFrota({ label, value, atual, ant, prevLabel, ruimSubir = false, sub }: { label: string; value: string; atual?: number | null; ant?: number | null; prevLabel: string; ruimSubir?: boolean; sub?: string }) {
  // KM total não é bom nem ruim: sem `ruimSubir` a variação fica neutra nos dois sentidos.
  const c = atual == null ? null : compararPct(atual, ant, !ruimSubir);
  return <KpiTV label={label} value={value} c={c && (ruimSubir ? c : { ...c, positivo: true })} prevLabel={prevLabel} sub={sub} />;
}

const km1 = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }));

export function SecaoFrota({ dados, mesLabel, prevLabel }: { dados: ResumoFrotaTV; mesLabel: string; prevLabel: string }) {
  const porDia = dados.porDia.map((d) => ({ rotulo: d.data.slice(8, 10), valor: Math.round(d.km) }));
  const a = dados.anterior;
  const maxTop = Math.max(1, ...dados.top.map((v) => v.km));
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiFrota label="KM rodado" value={`${inteiro.format(Math.round(dados.km))} km`} atual={dados.km} ant={a?.km} prevLabel={prevLabel} />
        <KpiFrota label="KM por entrega" value={km1(dados.kmPorEntrega)} atual={dados.kmPorEntrega} ant={a?.kmPorEntrega} prevLabel={prevLabel} ruimSubir />
        <KpiFrota label="KM por veículo/dia" value={dados.kmPorVeiculoDia === null ? "—" : inteiro.format(Math.round(dados.kmPorVeiculoDia))} atual={dados.kmPorVeiculoDia} ant={a?.kmPorVeiculoDia} prevLabel={prevLabel} />
        {dados.custo ? (
          <KpiFrota label="Custo da frota · est." value={formatBRL(Math.round(dados.custo.total)).replace(/,00$/, "")} prevLabel={prevLabel} sub={`${dados.custo.porKm === null ? "—" : formatBRL(dados.custo.porKm)}/km · ${dados.custo.porEntrega === null ? "—" : formatBRL(dados.custo.porEntrega)}/entrega`} />
        ) : (
          <KpiFrota label="Rastreados" value={`${dados.rastreados} de ${dados.veiculos}`} prevLabel={prevLabel} sub="veículos com viagem no mês" />
        )}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.7fr)_minmax(18rem,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">KM por dia · mil km · {mesLabel}</div>
          <div className="min-h-0 flex-1">
            <MiniBarras itens={porDia} cor="#f5b301" formatarValor={(v) => (v > 0 ? (v / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) : "")} />
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Veículos que mais rodaram</div>
          <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            {dados.top.slice(0, 6).map((v) => (
              <li key={v.placa}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-base font-semibold text-white">
                    {v.placa}
                    <span className="ml-2 text-xs font-normal text-white/40">{v.diasRodados} dias · {km1(v.kmPorEntrega)} km/entrega</span>
                  </span>
                  <span className="shrink-0 font-[family-name:var(--font-sora)] text-lg font-bold tabular-nums text-white">{inteiro.format(Math.round(v.km))}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-amber-400/80" style={{ width: `${(v.km / maxTop) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// --- Recebimento (dentro do card do mês, na tela de Receitas) ---------------

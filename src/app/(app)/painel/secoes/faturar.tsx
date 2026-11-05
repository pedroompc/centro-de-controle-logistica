"use client";

import { formatPercent, formatKg } from "@/domain/format";
import type { ResumoAFaturar, ResumoTempoFaturar } from "../painel-actions";
import { BigRanking, Kpi, inteiro } from "./base";

/** A faturar · clientes com pedido parado e peso, por cidade e por região. */
export function SecaoAFaturar({ dados }: { dados: ResumoAFaturar }) {
  if (!dados.disponivel) {
    return <div className="flex h-full items-center justify-center text-lg text-white/40">Sem conexão com o Winthor.</div>;
  }
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="Clientes a faturar" value={inteiro.format(dados.totalClientes)} tone="amber" hint={`${inteiro.format(dados.totalPedidos)} pedidos liberados/montados sem NF`} />
        <Kpi label="Peso em carteira" value={formatKg(dados.pesoTotal)} />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-0">
        <div className="flex min-h-0 flex-col lg:pr-8">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
            <span className="h-4 w-1 rounded-full bg-amber-400" />
            Por cidade
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <BigRanking
              denso
              linhas={dados.topCidades.map((c) => ({ chave: c.chave, nome: c.nome, principal: inteiro.format(c.clientes), secundario: `clientes · ${formatKg(c.peso)}` }))}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col border-t border-white/15 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
            <span className="h-4 w-1 rounded-full bg-amber-400" />
            Por região
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <BigRanking
              denso
              linhas={dados.porRegiao.map((r) => ({ chave: r.chave, nome: r.nome, principal: inteiro.format(r.clientes), secundario: `clientes · ${formatKg(r.peso)}` }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

const horas = (h: number | null) => (h === null ? "—" : `${inteiro.format(Math.round(h))} h`);

const emDias = (h: number) => `≈ ${(h / 24).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dia${h >= 48 ? "s" : ""}`;

/**
 * Tempo do pedido liberado até a nota emitida (calendário de rotas incluído).
 * Mediana no destaque — a média é puxada pela cauda de pedidos parados dias.
 */
export function SecaoTempoFaturar({ dados, prevLabel }: { dados: ResumoTempoFaturar; prevLabel: string }) {
  if (dados.pedidos === 0) return <div className="flex h-full items-center justify-center text-lg text-white/40">Nenhum pedido faturado no período.</div>;
  const ant = dados.medianaAnteriorH;
  const dif = dados.medianaH !== null && ant !== null ? dados.medianaH - ant : null;
  const max = Math.max(1, ...dados.porRegiao.map((r) => r.medianaH ?? 0));
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label="Mediana até faturar"
          value={horas(dados.medianaH)}
          tone="amber"
          // Menos horas é melhor: subir é ruim.
          delta={dif !== null && dif !== 0 ? { texto: `${dif > 0 ? "+" : "−"}${horas(Math.abs(dif))} vs ${prevLabel}`, subindo: dif > 0, positivo: dif < 0 } : undefined}
          hint={dados.medianaH !== null ? emDias(dados.medianaH) : undefined}
        />
        <Kpi label="Faturados em até 24 h" value={formatPercent(dados.ate24, 0)} hint={`${inteiro.format(dados.pedidos)} pedidos no mês`} />
        <Kpi label="Faturados em até 48 h" value={formatPercent(dados.ate48, 0)} />
        <Kpi label="5 dias ou mais" value={formatPercent(dados.mais5d, 0)} tone="rose" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
            <span className="h-4 w-1 rounded-full bg-amber-400" />
            Por região
          </span>
          {dados.liberacaoManualH !== null && (
            <span className="ml-auto text-sm text-white/45">
              pedido bloqueado espera <span className="font-semibold text-white/75">{horas(dados.liberacaoManualH)}</span> até ser liberado
            </span>
          )}
        </div>
        <ul className="flex min-h-0 flex-1 flex-col justify-around gap-3">
          {dados.porRegiao.map((r, i) => (
            <li key={r.regiao} className="flex items-center gap-4">
              <span className="w-32 shrink-0 truncate text-xl font-semibold text-white xl:w-40 xl:text-2xl">{r.regiao}</span>
              <div className="h-8 min-w-0 flex-1 overflow-hidden rounded-lg bg-white/[0.06]">
                <div
                  className="crescer-x h-full rounded-lg bg-[#5b6fd6]"
                  style={{ width: `${Math.max(2, ((r.medianaH ?? 0) / max) * 100)}%`, "--i": i } as React.CSSProperties}
                />
              </div>
              <div className="w-36 shrink-0 text-right">
                <div className="font-[family-name:var(--font-sora)] text-xl font-bold tabular-nums text-white xl:text-2xl">{horas(r.medianaH)}</div>
                <div className="text-sm tabular-nums text-white/40">{inteiro.format(r.pedidos)} pedidos</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

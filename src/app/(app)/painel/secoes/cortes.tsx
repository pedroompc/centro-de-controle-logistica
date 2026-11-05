"use client";

import { formatPercent } from "@/domain/format";
import type { CortesTV, FatiaCorteTV } from "@/domain/cortes";
import { compararTaxa, comRotulo } from "@/domain/comparacao";
import { Kpi, MiniBarras, inteiro } from "./base";

/** Lista "participação no corte do mês" com barra (motivos, quem cortou). */
function ListaFatias({ titulo, fatias, vazio }: { titulo: string; fatias: FatiaCorteTV[]; vazio: string }) {
  const max = Math.max(0.0001, ...fatias.map((f) => f.parte));
  return (
    <div className="flex min-h-0 flex-col">
      <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">{titulo}</div>
      {fatias.length === 0 ? (
        <p className="py-6 text-white/40">{vazio}</p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {fatias.map((f) => (
            <li key={f.rotulo}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate text-base font-semibold text-white" title={f.rotulo}>
                  {f.rotulo}
                  <span className="ml-2 text-xs font-normal text-white/40">{inteiro.format(f.itens)} {f.itens === 1 ? "item" : "itens"}</span>
                </span>
                <span className="shrink-0 font-[family-name:var(--font-sora)] text-lg font-bold tabular-nums text-rose-300">{formatPercent(f.parte)}</span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/10">
                <div className="h-full rounded-full bg-rose-400/70" style={{ width: `${(f.parte / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Cortes do mês sem R$ (regra da TV): a taxa sobre o que foi pedido, contagens,
 * itens cortados por dia e a participação de cada motivo / de quem cortou.
 * Subir a taxa é ruim (rose); cair fica neutro.
 */
export function SecaoCortes({
  dados,
  taxa,
  taxaAnt,
  prevLabel,
}: {
  dados: CortesTV;
  taxa: number | null;
  taxaAnt: number | null;
  prevLabel: string;
}) {
  const delta = comRotulo(compararTaxa(taxa, taxaAnt, false, { casas: 2, pp: false }), prevLabel) ?? undefined;
  const porDia = dados.porDia.map((d) => ({ rotulo: d.dia.slice(8, 10), valor: d.itens }));
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          label="Do que foi pedido"
          value={taxa === null ? "—" : formatPercent(taxa, 2)}
          tone="rose"
          hint="corte ÷ (corte + venda líquida)"
          delta={delta}
        />
        <Kpi label="Itens cortados" value={inteiro.format(dados.itens)} hint={`${inteiro.format(dados.skus)} produtos diferentes`} />
        <Kpi label="Pedidos afetados" value={inteiro.format(dados.pedidos)} hint={`${inteiro.format(dados.clientes)} clientes`} />
        <Kpi label="Na separação" value={formatPercent(dados.harpia, 0)} hint="do corte veio do Harpia" tone="amber" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.5fr)_minmax(16rem,1fr)_minmax(16rem,1fr)]">
        <div className="flex min-h-0 min-w-0 flex-col">
          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Itens cortados por dia</div>
          <div className="min-h-0 flex-1">
            <MiniBarras itens={porDia} cor="#f5b301" formatarValor={(v) => (v > 0 ? inteiro.format(v) : "")} />
          </div>
        </div>
        <ListaFatias titulo="Motivos" fatias={dados.motivos.slice(0, 6)} vazio="Sem corte no mês." />
        <ListaFatias titulo="Quem cortou" fatias={dados.usuarios.slice(0, 6)} vazio="Sem corte na separação." />
      </div>
    </div>
  );
}

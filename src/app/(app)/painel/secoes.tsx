"use client";

import type { ReactNode } from "react";
import { formatBRL, formatPercent } from "@/domain/format";
import { formatMesAno } from "@/domain/periodo";
import type {
  DevolucaoPorMotorista,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  DevolucaoPorSetor,
  DevolucaoPorMotivo,
  SetorDevolucao,
} from "@/domain/devolucoes";
import type { ResumoAFaturar, ResumoReceitas, ResumoDescarregos } from "./painel-actions";

// Chips de setor na paleta escura (o setorPill claro não contrasta no navy).
export const SETOR_COR: Record<SetorDevolucao, { barra: string; chip: string }> = {
  "Logística": { barra: "#4b57c4", chip: "bg-[#2a327f] text-indigo-100" },
  "Comercial": { barra: "#f5b301", chip: "bg-amber-400/20 text-amber-200" },
  "Faturamento": { barra: "#fb7185", chip: "bg-rose-400/20 text-rose-200" },
  "Não classificado": { barra: "#64748b", chip: "bg-slate-400/20 text-slate-200" },
};

const inteiro = new Intl.NumberFormat("pt-BR");

// ---------------------------------------------------------------------------
// Blocos genéricos

export function Kpi({
  label,
  value,
  hint,
  tone = "white",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "white" | "rose" | "amber" | "emerald";
}) {
  const cor = { white: "text-white", rose: "text-rose-300", amber: "text-amber-300", emerald: "text-emerald-300" }[tone];
  return (
    <div className="rounded-2xl bg-white/[0.06] px-5 py-4 ring-1 ring-white/10">
      <div className="text-[0.7rem] font-semibold uppercase tracking-[0.16em] text-white/45">{label}</div>
      <div className={`mt-1 font-[family-name:var(--font-sora)] text-3xl font-extrabold leading-none tabular-nums xl:text-4xl ${cor}`}>
        {value}
      </div>
      {hint && <div className="mt-1.5 text-xs text-white/40">{hint}</div>}
    </div>
  );
}

export function SetorBar({ porSetor }: { porSetor: DevolucaoPorSetor[] }) {
  const total = Math.max(1, porSetor.reduce((t, s) => t + s.valor, 0));
  if (porSetor.length === 0) return null;
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full">
        {porSetor.map((s) => (
          <div key={s.setor} style={{ width: `${(s.valor / total) * 100}%`, background: SETOR_COR[s.setor].barra }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
        {porSetor.map((s) => (
          <span key={s.setor} className="inline-flex items-center gap-2 text-sm text-white/70">
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${SETOR_COR[s.setor].chip}`}>{s.setor}</span>
            <span className="font-semibold tabular-nums text-white">{((s.valor / total) * 100).toFixed(1)}%</span>
            <span className="tabular-nums text-white/40">{formatBRL(s.valor)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export interface LinhaRanking {
  chave: string | number;
  nome: string;
  principal: string;
  secundario?: string;
  selo?: ReactNode;
}

export function BigRanking({ linhas, denso = false }: { linhas: LinhaRanking[]; denso?: boolean }) {
  return (
    <ul className="divide-y divide-white/10">
      {linhas.map((l, i) => (
        <li key={l.chave} className={`flex items-center gap-3.5 ${denso ? "py-2.5" : "py-3 xl:py-3.5"}`}>
          <span
            className={`flex shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-sora)] font-bold tabular-nums ${
              denso ? "h-8 w-8 text-sm" : "h-9 w-9 text-base xl:h-10 xl:w-10"
            } ${i === 0 ? "bg-amber-400 text-[#0a1650]" : "bg-white/10 text-white/55"}`}
          >
            {i + 1}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className={`truncate font-semibold text-white ${denso ? "text-lg" : "text-xl xl:text-2xl"}`} title={l.nome}>
              {l.nome}
            </span>
            {l.selo}
          </div>
          <div className="shrink-0 text-right">
            <div className={`font-[family-name:var(--font-sora)] font-bold tabular-nums text-rose-300 ${denso ? "text-lg" : "text-xl xl:text-2xl"}`}>
              {l.principal}
            </div>
            {l.secundario && <div className="text-sm tabular-nums text-white/40">{l.secundario}</div>}
          </div>
        </li>
      ))}
      {linhas.length === 0 && <li className="py-10 text-center text-white/40">Sem dados no período.</li>}
    </ul>
  );
}

function SeloSetor({ setor }: { setor: SetorDevolucao }) {
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${SETOR_COR[setor].chip}`}>{setor}</span>;
}

/** Colunas verticais simples (dia/semana/série) — SVG-less, só divs. */
export function MiniBarras({
  itens,
  cor = "#f5b301",
  formatarValor = (v: number) => inteiro.format(v),
}: {
  itens: { rotulo: string; valor: number }[];
  cor?: string;
  formatarValor?: (v: number) => string;
}) {
  const max = Math.max(1, ...itens.map((i) => i.valor));
  return (
    <div className="flex h-full items-end gap-1.5">
      {itens.map((it, i) => (
        <div key={`${it.rotulo}-${i}`} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-xs font-semibold tabular-nums text-white/70">{formatarValor(it.valor)}</span>
          <div className="w-full rounded-t-md" style={{ height: `${Math.max(4, (it.valor / max) * 100)}%`, minHeight: 4, background: cor }} />
          <span className="w-full truncate text-center text-[0.65rem] text-white/40" title={it.rotulo}>
            {it.rotulo}
          </span>
        </div>
      ))}
      {itens.length === 0 && <p className="w-full py-10 text-center text-white/40">Sem lançamentos no período.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Seções de conteúdo (um "slide" cada)

/** Devoluções · clientes e vendedores lado a lado, numa página só. */
export function SecaoClientesVendedores({
  clientes,
  vendedores,
}: {
  clientes: DevolucaoPorCliente[];
  vendedores: DevolucaoPorVendedor[];
}) {
  return (
    <div className="grid h-full grid-cols-1 gap-8 lg:grid-cols-2">
      <div className="flex min-h-0 flex-col">
        <div className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Clientes que mais devolvem</div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <BigRanking
            denso
            linhas={clientes.slice(0, 8).map((c) => ({
              chave: c.codcli,
              nome: c.nome,
              principal: formatBRL(c.valor),
              secundario: `${c.notas} notas`,
            }))}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-col">
        <div className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Vendedores com mais devolução</div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <BigRanking
            denso
            linhas={vendedores.slice(0, 8).map((v) => ({
              chave: v.codVendedor,
              nome: v.nome,
              principal: formatBRL(v.valor),
              secundario: `${v.notas} notas`,
            }))}
          />
        </div>
      </div>
    </div>
  );
}

/** Devoluções · motoristas que mais voltam (por R$ devolvido). */
export function SecaoMotoristas({ motoristas }: { motoristas: DevolucaoPorMotorista[] }) {
  const top = [...motoristas].sort((a, b) => b.valorDevolvido - a.valorDevolvido).slice(0, 9);
  return (
    <BigRanking
      linhas={top.map((m) => ({
        chave: m.codMotorista,
        nome: m.nome,
        principal: formatBRL(m.valorDevolvido),
        secundario: `${m.devolvidas} de ${m.expedidas} entregas · taxa ${formatPercent(m.taxa / 100)}`,
        selo:
          m.tipo === "F" ? (
            <span className="shrink-0 rounded-full bg-[#2a327f] px-2 py-0.5 text-xs font-semibold text-indigo-100">Da casa</span>
          ) : m.tipo === "T" ? (
            <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-200">Terceirizado</span>
          ) : null,
      }))}
    />
  );
}

/** Devoluções · motivos (por valor). */
export function SecaoMotivos({ porMotivo }: { porMotivo: DevolucaoPorMotivo[] }) {
  const top = [...porMotivo].sort((a, b) => b.valor - a.valor).slice(0, 9);
  return (
    <BigRanking
      linhas={top.map((m) => ({
        chave: `${m.motivo}-${m.setor}`,
        nome: m.motivo,
        principal: formatBRL(m.valor),
        secundario: `${m.notas} notas`,
        selo: <SeloSetor setor={m.setor} />,
      }))}
    />
  );
}

/** A faturar · pedidos parados (topo por cidade e por RCA). */
export function SecaoAFaturar({ dados }: { dados: ResumoAFaturar }) {
  if (!dados.disponivel) {
    return <div className="flex h-full items-center justify-center text-lg text-white/40">Sem conexão com o Winthor.</div>;
  }
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Pedidos parados" value={inteiro.format(dados.totalPedidos)} />
        <Kpi label="Valor a faturar" value={formatBRL(dados.valorTotal)} tone="amber" />
        <Kpi label="Parados +72h" value={inteiro.format(dados.parados72h)} tone="rose" hint="liberados/montados sem NF" />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Por cidade</div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <BigRanking
              denso
              linhas={dados.topCidades.map((c) => ({ chave: c.chave, nome: c.nome, principal: formatBRL(c.valor), secundario: `${c.qtd} pedidos` }))}
            />
          </div>
        </div>
        <div className="flex min-h-0 flex-col">
          <div className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Por vendedor (RCA)</div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <BigRanking
              denso
              linhas={dados.topRca.map((r) => ({ chave: r.chave, nome: r.nome, principal: formatBRL(r.valor), secundario: `${r.qtd} pedidos` }))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Receitas · total por origem + série mensal. */
export function SecaoReceitas({ dados }: { dados: ResumoReceitas }) {
  const origens = [
    { rotulo: "Descarregamento", valor: dados.descarregamento },
    { rotulo: "Totais diários", valor: dados.diarios },
    { rotulo: "Diversas", valor: dados.diversas },
  ];
  const serie = dados.serie.map((p) => ({ rotulo: formatMesAno(p.mes).slice(0, 3), valor: p.valor }));
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Kpi label="Receita do mês" value={formatBRL(dados.totalMes)} tone="emerald" />
        {origens.map((o) => (
          <Kpi key={o.rotulo} label={o.rotulo} value={formatBRL(o.valor)} />
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Receita mensal (últimos meses)</div>
        <div className="min-h-0 flex-1">
          <MiniBarras itens={serie} cor="#34d399" formatarValor={(v) => formatBRL(v)} />
        </div>
      </div>
    </div>
  );
}

/** Descarregamento · por dia (mês), por semana e total do mês. */
export function SecaoDescarregos({ dados, mesLabel }: { dados: ResumoDescarregos; mesLabel: string }) {
  const porDia = dados.porDia.map((d) => ({ rotulo: d.data.slice(8, 10), valor: d.descarregos }));
  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Descarregos no mês" value={inteiro.format(dados.totalMes)} tone="amber" hint={mesLabel} />
        <Kpi label="Receita (diários)" value={formatBRL(dados.receitaMes)} tone="emerald" />
        <Kpi label="Dias com descarga" value={inteiro.format(dados.porDia.length)} />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-8 lg:grid-cols-[2fr_1fr]">
        <div className="flex min-h-0 flex-col">
          <div className="mb-3 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Descarregos por dia</div>
          <div className="min-h-0 flex-1">
            <MiniBarras itens={porDia} cor="#f5b301" />
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

import Link from "next/link";
import type { ReactNode } from "react";

/** Cartão base — fundo branco, cantos arredondados, borda e sombra sutis. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
}

/** Cabeçalho de página — título em Sora + subtítulo + ação opcional à direita. */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight text-[#141a4d]">
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

/** Título de seção. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500">{children}</h2>;
}

/** Cartão de indicador (KPI) — número grande em Sora. */
export function StatCard({
  label,
  value,
  hint,
  accent = "navy",
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: "navy" | "gold" | "green" | "red";
  href?: string;
}) {
  const bar = {
    navy: "bg-[#1b2168]",
    gold: "bg-amber-500",
    green: "bg-emerald-500",
    red: "bg-rose-500",
  }[accent];

  const inner = (
    <div className="@container relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      {/* Fonte fluida: escala com a largura real do card (cqi) e nunca quebra
          linha, então valores longos (R$ 999.999,99) cabem em qualquer coluna. */}
      <p className="mt-2 font-[family-name:var(--font-sora)] text-[clamp(1rem,10cqi,1.875rem)] font-extrabold leading-tight tracking-tight tabular-nums whitespace-nowrap text-[#141a4d]">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/**
 * Indicador principal — o único cartão escuro da tela. Ancora a leitura do
 * dashboard e carrega a identidade da marca (navy + dourado).
 */
export function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="@container relative h-full overflow-hidden rounded-2xl p-6 shadow-lg sm:p-7"
      style={{ background: "linear-gradient(140deg,#0a1650 0%,#141a4d 55%,#1b2168 100%)" }}
    >
      <span className="absolute inset-y-0 left-0 w-1.5 bg-amber-400" />
      {/* brilho sutil no canto, ecoando o sol da marca */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20 blur-2xl"
        style={{ background: "radial-gradient(circle,#f5b301 0%,transparent 70%)" }}
      />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">{label}</p>
      {/* Fluido por container query: enche o card quando ele é largo (mobile,
          dashboard) e encolhe pra caber na coluna estreita do grid de 4, sem
          quebrar linha — antes o text-5xl fixo estourava a borda. */}
      <p className="mt-2 font-[family-name:var(--font-sora)] text-[clamp(1.375rem,12cqi,3rem)] font-extrabold leading-none tracking-tight tabular-nums whitespace-nowrap text-white">
        {value}
      </p>
    </div>
  );
}

/** Gráfico de barras horizontais — leitura fácil de "quanto por categoria". */
export function BarList({
  items,
  tone = "gold",
}: {
  items: { label: string; value: number; display: string; href?: string }[];
  tone?: "gold" | "navy";
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  const barColor = tone === "gold" ? "bg-amber-400" : "bg-[#2a327f]";
  return (
    <div className="space-y-3">
      {items.map((it) => {
        const pct = Math.max(2, Math.round((it.value / max) * 100));
        const row = (
          <div className="flex items-center gap-3">
            <div className="w-36 shrink-0 truncate text-sm text-slate-600" title={it.label}>
              {it.label}
            </div>
            <div className="h-6 flex-1 overflow-hidden rounded-md bg-slate-100">
              <div className={`h-full rounded-md ${barColor}`} style={{ width: `${pct}%` }} />
            </div>
            <div className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-[#141a4d]">
              {it.display}
            </div>
          </div>
        );
        return it.href ? (
          <Link key={it.label} href={it.href} className="block rounded-md hover:bg-slate-50">
            {row}
          </Link>
        ) : (
          <div key={it.label}>{row}</div>
        );
      })}
      {items.length === 0 && <p className="text-sm text-slate-400">Sem dados para exibir.</p>}
    </div>
  );
}

/**
 * Barras de setor com dupla leitura: custo (barra âmbar + R$) e efetivo
 * (chip navy com nº de pessoas) na mesma linha. Colapsa dois gráficos —
 * "custo por setor" e "efetivo por setor" — num só, ordenado por custo.
 */
export function SetorBarList({
  items,
}: {
  items: { label: string; custo: number; custoDisplay: string; efetivo: number; href?: string }[];
}) {
  const max = Math.max(1, ...items.map((i) => i.custo));
  return (
    <div className="space-y-3">
      {/* Cabeçalho de colunas — deixa claro o que cada valor representa. */}
      <div className="flex items-center gap-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
        <div className="w-24 shrink-0 sm:w-36">Setor</div>
        <div className="flex-1">Custo</div>
        <div className="w-24 shrink-0 text-right sm:w-28">R$ / mês</div>
        <div className="shrink-0 text-right">Pessoas</div>
      </div>
      {items.map((it) => {
        const pct = Math.max(2, Math.round((it.custo / max) * 100));
        const row = (
          <div className="flex items-center gap-3">
            <div className="w-24 shrink-0 truncate text-sm text-slate-600 sm:w-36" title={it.label}>
              {it.label}
            </div>
            <div className="h-6 min-w-0 flex-1 overflow-hidden rounded-md bg-slate-100">
              <div className="h-full rounded-md bg-amber-400" style={{ width: `${pct}%` }} />
            </div>
            <div className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-[#141a4d] sm:w-28">
              {it.custoDisplay}
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eef0fb] px-2 py-0.5 text-xs font-semibold tabular-nums text-[#1b2168]">
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="8" r="3.2" />
                  <path d="M5 20c0-3.3 3.1-5.5 7-5.5s7 2.2 7 5.5" />
                </svg>
                {it.efetivo}
              </span>
            </div>
          </div>
        );
        return it.href ? (
          <Link key={it.label} href={it.href} className="block rounded-md hover:bg-slate-50">
            {row}
          </Link>
        ) : (
          <div key={it.label}>{row}</div>
        );
      })}
      {items.length === 0 && <p className="text-sm text-slate-400">Sem dados para exibir.</p>}
    </div>
  );
}

/**
 * Selo/etiqueta pequeno (status, contagem).
 *
 * `green` é reservado a RECEITA (dinheiro que entra) — nunca a status nem a
 * "mais uma categoria". Para categoria neutra que não seja slate nem gold,
 * use `navy`.
 */
export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "gold" | "navy" | "green" | "red" }) {
  const cls = {
    slate: "bg-slate-100 text-slate-600",
    gold: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
    navy: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
    red: "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
  }[tone];
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{children}</span>;
}

/** Selo de status do funcionário. */
export function StatusBadge({ status }: { status: string }) {
  const tone = ({ ativo: "green", afastado: "gold", desligado: "slate" } as const)[
    status as "ativo" | "afastado" | "desligado"
  ] ?? "slate";
  const label = ({ ativo: "Ativo", afastado: "Afastado", desligado: "Desligado" } as Record<string, string>)[status] ?? status;
  return <Pill tone={tone}>{label}</Pill>;
}

/** Link de "voltar" discreto acima do cabeçalho. */
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-[#141a4d]">
      <span aria-hidden>←</span> {children}
    </Link>
  );
}

/** Cabeçalho de painel — chip de ícone + título + contexto + slot à direita (busca). */
export function PanelHeader({
  icon,
  tone = "navy",
  title,
  context,
  right,
}: {
  icon: ReactNode;
  tone?: "navy" | "gold";
  title: string;
  context?: string;
  right?: ReactNode;
}) {
  const chip = tone === "gold" ? "bg-amber-50 text-amber-600" : "bg-[#eef0fb] text-[#1b2168]";
  return (
    <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-2">
        <div className={`rounded-lg p-1.5 ${chip}`}>{icon}</div>
        <div>
          <h2 className="text-sm font-semibold text-[#141a4d]">{title}</h2>
          {context && <p className="mt-0.5 text-xs text-slate-400">{context}</p>}
        </div>
      </div>
      {right && <div className="sm:ml-auto">{right}</div>}
    </div>
  );
}

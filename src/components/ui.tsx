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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
      <span className={`absolute inset-y-0 left-0 w-1 ${bar}`} />
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 font-[family-name:var(--font-sora)] text-2xl font-extrabold tracking-tight tabular-nums text-[#141a4d] sm:text-3xl">
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
      className="relative h-full overflow-hidden rounded-2xl p-6 shadow-lg sm:p-7"
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
      <p className="mt-2 font-[family-name:var(--font-sora)] text-3xl font-extrabold leading-none tracking-tight tabular-nums text-white sm:text-4xl lg:text-5xl">
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

/** Selo/etiqueta pequeno (status, contagem). */
export function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "gold" | "green" | "red" }) {
  const cls = {
    slate: "bg-slate-100 text-slate-600",
    gold: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
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

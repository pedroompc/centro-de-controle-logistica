import { PageHeader } from "@/components/ui";

export default function Loading() {
  return (
    <div>
      <PageHeader title="Devoluções" subtitle="carregando…" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[104px] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
        ))}
      </div>
      <div className="mt-6 h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
      <div className="mt-6 h-64 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
    </div>
  );
}

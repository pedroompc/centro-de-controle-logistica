import { PageHeader } from "@/components/ui";

export default function Loading() {
  return (
    <div>
      <PageHeader title="Galpão" subtitle="carregando…" />
      {[0, 1].map((linha) => (
        <div key={linha} className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-[124px] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
          ))}
        </div>
      ))}
      <div className="h-72 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
    </div>
  );
}

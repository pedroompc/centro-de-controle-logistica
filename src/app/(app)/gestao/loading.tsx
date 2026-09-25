import { PageHeader } from "@/components/ui";

export default function Loading() {
  return (
    <div>
      <PageHeader title="Painel de gestão" subtitle="carregando 13 meses…" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-[124px] animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
        ))}
      </div>
      <div className="mt-8 h-96 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
    </div>
  );
}

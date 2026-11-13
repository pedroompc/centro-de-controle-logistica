import { PageHeader } from "@/components/ui";

// Esqueleto no mesmo desenho da página: filtros, 6 indicadores, análise e gráficos.
export default function Loading() {
  const bloco = "animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cortes & Rupturas" subtitle="carregando…" />
      <div className={`h-40 ${bloco}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={`min-h-[110px] ${bloco}`} />
        ))}
      </div>
      <div className={`h-56 ${bloco}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`h-72 ${bloco}`} />
        ))}
      </div>
    </div>
  );
}

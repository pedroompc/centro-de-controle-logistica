import { PageHeader } from "@/components/ui";

// Entregas, devoluções e telemetria levam ~10 s: esqueleto no desenho da página.
export default function Loading() {
  const bloco = "animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Telemetria & Frota" subtitle="lendo entregas e telemetria…" />
      <div className={`h-36 ${bloco}`} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <div key={i} className={`h-[104px] ${bloco}`} />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className={`h-64 ${bloco}`} />
        <div className={`h-64 ${bloco}`} />
      </div>
      <div className={`h-80 ${bloco}`} />
    </div>
  );
}

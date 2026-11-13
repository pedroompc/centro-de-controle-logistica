import { PageHeader } from "@/components/ui";

// A base do estoque leva ~8 s no Winthor: esqueleto no desenho da página.
export default function Loading() {
  const bloco = "animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100";
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Excesso de Estoque" subtitle="lendo o estoque no Winthor…" />
      <div className={`h-32 ${bloco}`} />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => <div key={i} className={`h-32 ${bloco}`} />)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-8">
        {Array.from({ length: 16 }).map((_, i) => <div key={i} className={`h-[84px] ${bloco}`} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`h-72 ${bloco}`} />)}
      </div>
    </div>
  );
}

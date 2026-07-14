export default function Loading() {
  return (
    <div>
      <div className="mb-6 h-9 w-48 animate-pulse rounded-lg bg-slate-200/70" />
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-56 animate-pulse rounded-2xl border border-slate-200/80 bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

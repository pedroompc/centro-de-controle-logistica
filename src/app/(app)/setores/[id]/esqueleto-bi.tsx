/** Esqueleto do BI em tela cheia (mesma moldura navy do BIShell) enquanto os dados chegam. */
export function EsqueletoBI() {
  return (
    <div
      aria-busy
      aria-label="Carregando"
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden px-4 pt-4 sm:px-6 xl:px-10 xl:pt-6"
      style={{ background: "linear-gradient(140deg,#0a1650 0%,#0d1550 45%,#151b57 100%)" }}
    >
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/sol-dia.gif" alt="" className="h-11 w-11 rounded-xl object-cover ring-1 ring-white/10" />
        <div className="space-y-2">
          <div className="esqueleto-escuro h-7 w-56 rounded-lg" />
          <div className="esqueleto-escuro h-4 w-32 rounded" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="esqueleto-escuro h-24 rounded-2xl" />
        ))}
      </div>
      <div className="mt-4 grid min-h-0 flex-1 gap-4 pb-6 xl:grid-cols-[2fr_1fr]">
        <div className="esqueleto-escuro min-h-64 rounded-2xl" />
        <div className="esqueleto-escuro min-h-64 rounded-2xl" />
      </div>
    </div>
  );
}

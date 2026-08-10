"use client";

import { useState } from "react";

export function CompartilharButton({ src }: { src: string }) {
  const [ocupado, setOcupado] = useState(false);

  async function compartilhar() {
    setOcupado(true);
    try {
      const res = await fetch(src, { cache: "no-store" });
      if (!res.ok) throw new Error("falha ao gerar a arte");
      const blob = await res.blob();
      const file = new File([blob], "fechamento-dia.png", { type: "image/png" });

      const nav = navigator as Navigator & { canShare?: (d?: ShareData) => boolean };
      if (nav.canShare && nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: "Fechamento do dia — DIA" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "fechamento-dia.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      // AbortError = usuário fechou a bandeja; ignorar.
      if ((e as Error).name !== "AbortError") console.error(e);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <button
      type="button"
      onClick={compartilhar}
      disabled={ocupado}
      className="inline-flex items-center gap-2 rounded-xl bg-[#181d55] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#10143f] active:bg-[#10143f] disabled:opacity-60"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
      </svg>
      {ocupado ? "Gerando…" : "Compartilhar"}
    </button>
  );
}

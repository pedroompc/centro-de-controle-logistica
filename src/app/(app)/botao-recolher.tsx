"use client";

import { COOKIE_SIDEBAR } from "./sidebar-cookie";

/**
 * Recolhe/expande a barra lateral (desktop). O estado vive no atributo
 * `data-recolhida` do layout — o CSS faz o resto — e no cookie, para o
 * servidor já renderizar a próxima página do jeito escolhido.
 */
export function BotaoRecolher() {
  const alternar = () => {
    const raiz = document.querySelector<HTMLElement>("[data-recolhida]");
    if (!raiz) return;
    const recolhida = raiz.dataset.recolhida !== "true";
    raiz.dataset.recolhida = String(recolhida);
    document.cookie = `${COOKIE_SIDEBAR}=${recolhida ? "recolhida" : "aberta"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <button
      type="button"
      onClick={alternar}
      title="Recolher / expandir menu"
      aria-label="Recolher ou expandir o menu"
      className="flex w-full items-center gap-3 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white group-data-[recolhida=true]/app:justify-center"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-5 w-5 transition-transform duration-200 group-data-[recolhida=true]/app:rotate-180"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <rect x="3" y="4" width="18" height="16" rx="2.5" />
        <path d="M9 4v16" />
        <path d="m15.5 9.5-2.5 2.5 2.5 2.5" />
      </svg>
      <span className="group-data-[recolhida=true]/app:hidden">Recolher menu</span>
    </button>
  );
}

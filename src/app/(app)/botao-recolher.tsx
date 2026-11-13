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
      // Bolinha na borda da barra, ao lado da marca (como no app Flask). Fica fora
      // do <aside> (que corta o que passa da borda) e acompanha a largura dele.
      className="fixed left-[244px] top-9 z-40 hidden h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-[#141a4d] shadow-md transition-[left,background-color] duration-200 hover:bg-amber-50 group-data-[recolhida=true]/app:left-[58px] md:flex"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="h-4 w-4 transition-transform duration-200 group-data-[recolhida=true]/app:rotate-180"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m14.5 7-5 5 5 5" />
      </svg>
    </button>
  );
}

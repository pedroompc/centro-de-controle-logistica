"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type Clique = { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; defaultPrevented: boolean };
type Ancora = { href: string; target: string; hasAttribute(n: string): boolean };

/** O clique vai trocar de tela dentro do app? (nova aba, download, âncora e externo não contam) */
export function deveIniciarBarra(ev: Clique, a: Ancora, atual: string): boolean {
  if (ev.defaultPrevented || ev.button !== 0) return false;
  if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return false;
  if ((a.target && a.target !== "_self") || a.hasAttribute("download")) return false;
  let destino: URL, aqui: URL;
  try {
    destino = new URL(a.href, atual);
    aqui = new URL(atual);
  } catch {
    return false;
  }
  if (destino.origin !== aqui.origin) return false;
  return destino.pathname !== aqui.pathname || destino.search !== aqui.search;
}

/** Trava de segurança: se a navegação nunca terminar, a barra some sozinha. */
const LIMITE_MS = 15_000;

/**
 * Barrinha âmbar no topo enquanto a próxima tela carrega — o clique responde na
 * hora mesmo quando o servidor demora. Some quando a URL muda.
 */
export function BarraNavegacao() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [estado, setEstado] = useState<"parada" | "andando" | "fim">("parada");

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (a && deveIniciarBarra(e, a, window.location.href)) setEstado("andando");
    };
    // Captura: roda antes do <Link> do Next, que cancela o evento (preventDefault).
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // URL mudou: a tela nova chegou — completa a barra e esconde.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado((s) => (s === "andando" ? "fim" : s));
  }, [pathname, search]);

  useEffect(() => {
    if (estado === "parada") return;
    const t = setTimeout(() => setEstado(estado === "fim" ? "parada" : "fim"), estado === "fim" ? 350 : LIMITE_MS);
    return () => clearTimeout(t);
  }, [estado]);

  if (estado === "parada") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[80] h-[3px]">
      <div className={`h-full rounded-r-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,.6)] ${estado === "fim" ? "barra-nav-fim" : "barra-nav-andando"}`} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// `short` = rótulo curto para a barra inferior do celular; `primary` marca os
// itens que ficam sempre à mão nessa barra (os demais vão para a folha "Mais").
export type Item = { href: string; label: string; short?: string; primary?: boolean; icon: React.ReactNode };

// Telas que entendem `?mes=`. Ao navegar entre elas, o mês selecionado é
// preservado; as demais (Setores, Funcionários, Tendências) ignoram o parâmetro.
const COM_MES = new Set(["/", "/custos", "/receitas", "/devolucoes"]);

export function comMes(href: string, mes: string | null): string {
  return mes && COM_MES.has(href) ? `${href}?mes=${mes}` : href;
}

export const items: Item[] = [
  {
    href: "/",
    label: "Dashboard",
    short: "Início",
    primary: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/setores",
    label: "Setores",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
        <path d="m3 12 9 4.5L21 12" />
        <path d="m3 16.5 9 4.5 9-4.5" />
      </svg>
    ),
  },
  {
    href: "/funcionarios",
    label: "Funcionários",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 5.2a3 3 0 0 1 0 5.6" />
        <path d="M17.5 20a5.2 5.2 0 0 0-3-4.7" />
      </svg>
    ),
  },
  {
    href: "/custos",
    label: "Custos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M3 10h18" />
        <circle cx="16.5" cy="14.5" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: "/receitas",
    label: "Receitas",
    short: "Receitas",
    primary: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 3v18" />
        <path d="M16 7.5c0-1.4-1.8-2.5-4-2.5S8 6.1 8 7.5 9.8 10 12 10s4 1.1 4 2.5S14.2 15 12 15s-4-1.1-4-2.5" />
      </svg>
    ),
  },
  {
    href: "/devolucoes",
    label: "Devoluções",
    short: "Devoluções",
    primary: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 7v6h6" />
        <path d="M3 13a9 9 0 1 0 3-6.7L3 9" />
      </svg>
    ),
  },
  {
    href: "/pedidos-a-faturar",
    label: "Pedidos a Faturar",
    short: "Pedidos",
    primary: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M4 4h11l5 5v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
        <path d="M14 4v5h5" />
        <path d="M8 13h6M8 16h4" />
      </svg>
    ),
  },
  {
    href: "/pedidos",
    label: "Consulta de Pedidos",
    short: "Consultar",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
        <path d="M8.5 11h5M11 8.5v5" />
      </svg>
    ),
  },
  {
    href: "/tendencias",
    label: "Tendências",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 17l6-6 4 4 8-8" />
        <path d="M17 7h4v4" />
      </svg>
    ),
  },
  {
    href: "/fechamento",
    label: "Fechamento",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <circle cx="18" cy="5" r="2.5" />
        <circle cx="6" cy="12" r="2.5" />
        <circle cx="18" cy="19" r="2.5" />
        <path d="m8.2 10.8 7.6-4.4M8.2 13.2l7.6 4.4" />
      </svg>
    ),
  },
  {
    href: "/painel",
    label: "Painel (TV)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <rect x="2.5" y="4" width="19" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
    ),
  },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SidebarNav({ variant = "sidebar" }: { variant?: "sidebar" | "top" }) {
  const pathname = usePathname();
  const mes = useSearchParams().get("mes");

  if (variant === "top") {
    return (
      <nav className="flex gap-1 overflow-x-auto">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={comMes(it.href, mes)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              {it.icon}
              {it.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-1">
      {items.map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={comMes(it.href, mes)}
            className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
            }`}
          >
            {active && <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r bg-amber-400" />}
            <span className={active ? "text-amber-300" : ""}>{it.icon}</span>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

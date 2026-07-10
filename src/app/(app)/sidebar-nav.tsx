"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: React.ReactNode };

const items: Item[] = [
  {
    href: "/",
    label: "Dashboard",
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
    href: "/devolucoes",
    label: "Devoluções",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="1.8">
        <path d="M3 7v6h6" />
        <path d="M3 13a9 9 0 1 0 3-6.7L3 9" />
      </svg>
    ),
  },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SidebarNav({ variant = "sidebar" }: { variant?: "sidebar" | "top" }) {
  const pathname = usePathname();

  if (variant === "top") {
    return (
      <nav className="flex gap-1 overflow-x-auto">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
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
            href={it.href}
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

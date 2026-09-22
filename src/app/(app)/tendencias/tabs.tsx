"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Abas do hub de Tendências — o "método de gestão" (comparativo mês a mês)
 * aplicado a cada eixo da operação. Faturamento e Descarrego hoje; Custos e
 * Efetivos entram nas próximas fases (mesma casa, mesma linguagem visual).
 */
const ABAS = [
  { href: "/tendencias", label: "Faturamento" },
  { href: "/tendencias/custos", label: "Custos" },
  { href: "/tendencias/descarrego", label: "Descarrego" },
  { href: "/tendencias/efetivos", label: "Efetivos" },
] as const;

export function TendenciasTabs() {
  const pathname = usePathname();
  return (
    <nav className="inline-flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
      {ABAS.map((a) => {
        // "/tendencias" só casa exato; as demais casam por prefixo.
        const active = a.href === "/tendencias" ? pathname === a.href : pathname.startsWith(a.href);
        return (
          <Link
            key={a.href}
            href={a.href}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-white text-[#141a4d] shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-[#141a4d]"
            }`}
          >
            {a.label}
          </Link>
        );
      })}
    </nav>
  );
}

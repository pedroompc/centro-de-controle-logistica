import type { ReactNode } from "react";
import Link from "next/link";
import {
  ABAS_BI,
  ROTULO_ABA,
  hrefBI,
  type AbaBI,
} from "@/domain/bi-geral-rotas";

/** Barra de abas do BI Geral (tema escuro do BIShell). Os links levam período e comparação; `direita` = seletor de comparação. */
export function AbasBI({
  ativa,
  q,
  direita,
}: {
  ativa: AbaBI;
  q: Record<string, string>;
  direita?: ReactNode;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
      <nav
        aria-label="Abas do BI"
        className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1"
      >
        {ABAS_BI.map((a) => (
          <Link
            key={a}
            href={hrefBI(a, q)}
            aria-current={a === ativa ? "page" : undefined}
            className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${
              a === ativa
                ? "bg-white text-[#141a4d] shadow-sm"
                : "bg-white/[0.06] text-white/70 ring-1 ring-white/10 hover:bg-white/15 hover:text-white"
            }`}
          >
            {ROTULO_ABA[a]}
          </Link>
        ))}
      </nav>
      {direita && <div className="shrink-0 pb-1">{direita}</div>}
    </div>
  );
}

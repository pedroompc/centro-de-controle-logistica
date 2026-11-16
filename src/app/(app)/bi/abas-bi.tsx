import Link from "next/link";
import { ABAS_BI, ROTULO_ABA, hrefBI, type AbaBI } from "@/domain/bi-geral-rotas";

/** Barra de abas do BI Geral (tema escuro do BIShell). Os links levam período e comparação. */
export function AbasBI({ ativa, q }: { ativa: AbaBI; q: Record<string, string> }) {
  return (
    <nav aria-label="Abas do BI" className="mt-3 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {ABAS_BI.map((a) => (
        <Link
          key={a}
          href={hrefBI(a, q)}
          aria-current={a === ativa ? "page" : undefined}
          className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition ${
            a === ativa ? "bg-white text-[#141a4d] shadow-sm" : "bg-white/[0.06] text-white/70 ring-1 ring-white/10 hover:bg-white/15 hover:text-white"
          }`}
        >
          {ROTULO_ABA[a]}
        </Link>
      ))}
    </nav>
  );
}

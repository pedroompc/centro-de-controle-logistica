import type { Comparacao } from "@/domain/comparacao";

// Cores da comparação no tema claro: boa/neutra = slate, ruim = rose. Verde nunca.
export const COR_VARIACAO = { boa: "#64748b", ruim: "#e11d48" } as const; // slate-500 · rose-600

export function SetaVariacao({ subindo, className = "h-3 w-3" }: { subindo: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true">
      {subindo ? <path d="M8 13V3M8 3l-4 4M8 3l4 4" /> : <path d="M8 3v10M8 13l-4-4M8 13l4-4" />}
    </svg>
  );
}

/**
 * Variação contra o período anterior (tema claro): seta + texto, rose só quando
 * a direção é ruim. `referencia` vem esmaecida ao lado ("vs mês anterior").
 * Sem comparação (`null`), mostra um traço com o motivo no hover.
 */
export function Variacao({
  c,
  referencia,
  tamanho = "xs",
  className = "",
}: {
  c: Comparacao | null;
  referencia?: string;
  tamanho?: "xs" | "sm";
  className?: string;
}) {
  const fonte = tamanho === "sm" ? "text-sm font-bold" : "text-xs font-semibold";
  if (!c) return <span className={`text-xs text-slate-300 ${className}`} title="sem período anterior para comparar">—</span>;
  return (
    <span className={`inline-flex items-center gap-1 tabular-nums ${fonte} ${className}`} style={{ color: c.positivo ? COR_VARIACAO.boa : COR_VARIACAO.ruim }}>
      <SetaVariacao subindo={c.subindo} className={tamanho === "sm" ? "h-3.5 w-3.5" : "h-3 w-3"} />
      {c.texto}
      {referencia && <span className="font-normal text-slate-400">{referencia}</span>}
    </span>
  );
}

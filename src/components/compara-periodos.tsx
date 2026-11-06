import type { Comparacao } from "@/domain/comparacao";
import { Variacao } from "./variacao";

export interface ItemComparacao {
  c: Comparacao | null;
  /** "vs 2º tri/26" */
  referencia: string;
}

/**
 * As duas comparações do período (vs anterior · vs ano passado), lado a lado.
 * Sem base, a comparação vira "—" com o motivo no hover — nunca "−100%".
 */
export function ComparaPeriodos({ itens, className = "" }: { itens: ItemComparacao[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 ${className}`}>
      {itens.map((i) => (
        <span key={i.referencia} className="inline-flex items-center gap-1">
          {i.c ? (
            <Variacao c={i.c} referencia={i.referencia} />
          ) : (
            <span className="text-xs text-slate-300" title="sem dado no período de comparação">
              — <span className="text-slate-400">{i.referencia}</span>
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

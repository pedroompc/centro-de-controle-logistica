import { Suspense } from "react";
import type { Periodo } from "@/domain/periodo";
import { PISO_TENDENCIAS } from "@/domain/tendencias";
import { PeriodoNav } from "@/components/periodo-nav";
import { TendenciasTabs } from "./tabs";

/** Abas das Tendências + o seletor da janela de meses. */
export function BarraTendencias({ periodo, base, piso = PISO_TENDENCIAS }: { periodo: Periodo; base: string; piso?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Suspense fallback={<div className="h-11 w-96 rounded-xl bg-slate-50" />}>
        <TendenciasTabs />
      </Suspense>
      <PeriodoNav periodo={periodo} piso={piso} explicito hrefFor={(p) => `${base}?${new URLSearchParams(p)}`} />
    </div>
  );
}

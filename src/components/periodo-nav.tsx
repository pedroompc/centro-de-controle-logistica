import Link from "next/link";
import { Suspense } from "react";
import {
  type Periodo,
  INICIO_HISTORICO,
  atalhosPeriodo,
  deslocarPeriodo,
  paramsDoPeriodo,
  rotuloPeriodo,
} from "@/domain/periodo";
import { hojeISO } from "@/domain/fechamento";
import { SeletorPeriodo } from "./seletor-periodo";

const btn = "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 transition hover:bg-slate-50";
const btnOff = "rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-slate-300";

/**
 * ◀ período ▶ + seletor (atalhos e calendário). As setas andam o período
 * inteiro pelo seu tamanho (mês → mês, trimestre → trimestre, intervalo livre
 * → mesmo nº de dias). `hrefFor` recebe os parâmetros de período (`{}`, `{mes}`
 * ou `{de, ate}`) e monta a URL com os demais filtros da tela.
 */
export function PeriodoNav({
  periodo,
  hrefFor,
  piso = INICIO_HISTORICO,
  limpar,
}: {
  periodo: Periodo;
  hrefFor: (params: Record<string, string>) => string;
  piso?: string;
  limpar?: string[];
}) {
  const hoje = hojeISO();
  const ant = deslocarPeriodo(periodo, -1);
  const prox = deslocarPeriodo(periodo, 1);
  const temAnterior = ant.ate >= piso;
  const temProximo = prox.de <= hoje;
  const atalhos = atalhosPeriodo().filter((a) => a.periodo.ate >= piso);
  const rotulo = <span className="min-w-[7rem] px-2 text-center text-sm font-semibold text-[#141a4d]">{rotuloPeriodo(periodo)}</span>;
  return (
    <div className="flex items-center gap-1">
      {temAnterior ? (
        <Link href={hrefFor(paramsDoPeriodo(ant))} aria-label="Período anterior" className={btn}>◀</Link>
      ) : (
        <span aria-hidden className={btnOff}>◀</span>
      )}
      {/* useSearchParams no cliente pede um Suspense em volta. */}
      <Suspense fallback={rotulo}>
        <SeletorPeriodo periodo={periodo} atalhos={atalhos} piso={piso} hoje={hoje} limpar={limpar} />
      </Suspense>
      {temProximo ? (
        <Link href={hrefFor(paramsDoPeriodo(prox))} aria-label="Próximo período" className={btn}>▶</Link>
      ) : (
        <span aria-hidden className={btnOff}>▶</span>
      )}
    </div>
  );
}

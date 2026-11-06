import Link from "next/link";
import { Suspense } from "react";
import {
  type Periodo,
  INICIO_HISTORICO,
  atalhosPeriodo,
  deslocarPeriodo,
  paramsDoPeriodo,
  rotuloPeriodo,
  paramComparacao,
  type PeriodoComparado,
} from "@/domain/periodo";
import { hojeISO } from "@/domain/fechamento";
import { SeletorPeriodo } from "./seletor-periodo";
import { SeletorComparacao } from "./seletor-comparacao";

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
  explicito = false,
  comparacao,
}: {
  periodo: Periodo;
  hrefFor: (params: Record<string, string>) => string;
  piso?: string;
  limpar?: string[];
  /** Sempre escreve o período na URL (tela cujo padrão não é o mês atual). */
  explicito?: boolean;
  /** Tela com cards comparáveis: mostra o botão "Comparar" (`null` = desligada). */
  comparacao?: PeriodoComparado | null;
}) {
  const hoje = hojeISO();
  const ant = deslocarPeriodo(periodo, -1);
  const prox = deslocarPeriodo(periodo, 1);
  const temAnterior = ant.ate >= piso;
  const temProximo = prox.de <= hoje;
  const atalhos = atalhosPeriodo().filter((a) => a.periodo.ate >= piso);
  // As setas mantêm a comparação ligada (anterior/ano passado se recalculam).
  const cmp: Record<string, string> = comparacao ? { cmp: paramComparacao(comparacao.modo, comparacao.periodo) } : {};
  const href = (p: Periodo) => hrefFor({ ...paramsDoPeriodo(p, undefined, explicito), ...cmp });
  const rotulo = <span className="min-w-[7rem] px-2 text-center text-sm font-semibold text-[#141a4d]">{rotuloPeriodo(periodo)}</span>;
  return (
    <div className="flex items-center gap-1">
      {comparacao !== undefined && (
        <Suspense fallback={null}>
          <div className="mr-1">
            <SeletorComparacao periodo={periodo} comparacao={comparacao} piso={piso} hoje={hoje} />
          </div>
        </Suspense>
      )}
      {temAnterior ? (
        <Link href={href(ant)} aria-label="Período anterior" className={btn}>◀</Link>
      ) : (
        <span aria-hidden className={btnOff}>◀</span>
      )}
      {/* useSearchParams no cliente pede um Suspense em volta. */}
      <Suspense fallback={rotulo}>
        <SeletorPeriodo periodo={periodo} atalhos={atalhos} piso={piso} hoje={hoje} limpar={limpar} explicito={explicito} />
      </Suspense>
      {temProximo ? (
        <Link href={href(prox)} aria-label="Próximo período" className={btn}>▶</Link>
      ) : (
        <span aria-hidden className={btnOff}>▶</span>
      )}
    </div>
  );
}

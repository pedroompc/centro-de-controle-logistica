import Link from "next/link";
import { primeiroDiaDoMes, formatMesAno, mesAnterior, mesProximo, INICIO_HISTORICO } from "@/domain/periodo";

const btn =
  "rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-slate-600 transition hover:bg-slate-50";
const btnOff =
  "rounded-lg border border-slate-100 bg-slate-50 px-3 py-1.5 text-slate-300";

/**
 * Navegador de mês ◀ Mês/Ano ▶, limitado à janela [INICIO_HISTORICO, mês
 * atual]. As setas viram texto inerte nos extremos, deixando claro que não há
 * mais histórico para trás nem futuro para frente. Cada tela passa `hrefFor`
 * para preservar seus próprios parâmetros (filtros, vista, motivo/setor) ao
 * trocar de mês.
 */
export function MesNav({ mes, hrefFor }: { mes: string; hrefFor: (mesISO: string) => string }) {
  const temAnterior = mes > INICIO_HISTORICO;
  const temProximo = mes < primeiroDiaDoMes();
  return (
    <div className="flex items-center gap-1">
      {temAnterior ? (
        <Link href={hrefFor(mesAnterior(mes))} aria-label="Mês anterior" className={btn}>◀</Link>
      ) : (
        <span aria-hidden className={btnOff}>◀</span>
      )}
      <span className="min-w-[7rem] text-center text-sm font-semibold text-[#141a4d]">{formatMesAno(mes)}</span>
      {temProximo ? (
        <Link href={hrefFor(mesProximo(mes))} aria-label="Próximo mês" className={btn}>▶</Link>
      ) : (
        <span aria-hidden className={btnOff}>▶</span>
      )}
    </div>
  );
}

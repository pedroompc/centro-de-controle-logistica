"use client";

import { imprimirRelatorio } from "@/lib/imprimir-relatorio";

const BOTAO =
  "flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#141a4d] transition hover:bg-slate-50";

/** PDF = diálogo de impressão com o documento pronto; Excel = .xlsx da rota export. */
export function Exportar({ html, hrefExcel }: { html: string; hrefExcel: string }) {
  return (
    <>
      <button type="button" onClick={() => imprimirRelatorio(html)} className={BOTAO} title="Imprimir ou salvar como PDF">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
          <path d="M14 3v5h5M9 13h6M9 17h4" />
        </svg>
        PDF
      </button>
      <a href={hrefExcel} className={BOTAO} title="Baixar planilha do Excel (.xlsx)">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 10h18M3 15h18M9 4v16" />
        </svg>
        Excel
      </a>
    </>
  );
}

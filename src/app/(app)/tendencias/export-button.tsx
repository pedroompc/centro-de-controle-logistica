"use client";

/**
 * Baixa a série mensal como CSV (separador ";" e decimais pt-BR, para abrir
 * limpo no Excel em português). Recebe as linhas já formatadas do servidor.
 */
export function ExportButton({ cabecalho, linhas, nomeArquivo }: {
  cabecalho: string[]; linhas: string[][]; nomeArquivo: string;
}) {
  function baixar() {
    const escapar = (c: string) => (/[";\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c);
    const corpo = [cabecalho, ...linhas].map((l) => l.map(escapar).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + corpo], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button onClick={baixar}
      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-[#141a4d]">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 3v12M12 15l-4-4M12 15l4-4" />
        <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
      </svg>
      Exportar
    </button>
  );
}

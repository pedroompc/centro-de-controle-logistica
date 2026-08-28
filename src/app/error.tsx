"use client"; // Boundaries de erro precisam ser Client Components.

import { useEffect, useRef, useState } from "react";

/**
 * Boundary de erro de toda a árvore abaixo do layout raiz — pega qualquer falha
 * de render nas páginas e no layout do grupo (app).
 *
 * O sintoma que isto corrige: na PRIMEIRA carga o painel às vezes estourava a
 * tela crua de erro do Next ("A server error occurred"), e um reload manual
 * resolvia. A causa é transitória — conexão fria com o Supabase/Oracle ou o
 * refresh de token do Supabase correndo no primeiro request. Sem boundary, o
 * throw de qualquer leitura de dados derrubava a página inteira.
 *
 * `unstable_retry()` (Next 16.2+) refaz o fetch e re-renderiza o segmento no
 * servidor — é o "reload" que o usuário fazia na mão. `reset()` NÃO serve aqui:
 * ele só limpa o estado do cliente e re-renderiza com o MESMO payload que já
 * falhou. Por isso tentamos um retry automático UMA vez: numa falha transitória
 * a tela se recupera sozinha; numa falha real, mostramos o aviso e o botão.
 */
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const jaTentou = useRef(false);
  const [tentandoDeNovo, setTentandoDeNovo] = useState(true);

  useEffect(() => {
    console.error(error);
    if (!jaTentou.current) {
      jaTentou.current = true;
      // Recupera sozinho a falha transitória da primeira carga.
      unstable_retry();
    } else {
      // Já tentou e voltou a cair: é falha de verdade, mostra a tela.
      setTentandoDeNovo(false);
    }
  }, [error, unstable_retry]);

  if (tentandoDeNovo) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[#0a1650]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 ring-1 ring-red-100">
        <svg viewBox="0 0 24 24" fill="none" className="h-7 w-7 text-red-500" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 9v4m0 4h.01M10.3 3.9 2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </svg>
      </div>
      <h1 className="mt-5 font-[family-name:var(--font-sora)] text-xl font-extrabold tracking-tight text-[#141a4d]">
        Não foi possível carregar
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Um erro no servidor aconteceu — costuma ser uma instabilidade momentânea da
        conexão com o banco. Tente novamente.
      </p>
      <button
        onClick={() => {
          setTentandoDeNovo(true);
          jaTentou.current = false;
          unstable_retry();
        }}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#181d55] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[#181d55]/20 transition hover:bg-[#10143f]"
      >
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" stroke="currentColor" strokeWidth="1.8">
          <path d="M20 11A8 8 0 1 0 4 12m0 0-2-2m2 2 2-2" />
        </svg>
        Tentar novamente
      </button>
      {error.digest && (
        <p className="mt-6 font-mono text-[10px] uppercase tracking-widest text-slate-300">
          Ref {error.digest}
        </p>
      )}
    </div>
  );
}

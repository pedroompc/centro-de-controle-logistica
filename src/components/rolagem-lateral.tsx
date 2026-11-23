"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { estadoRolagem, passoRolagem, type EstadoRolagem } from "@/domain/rolagem-lateral";

// Tabelas largas: no Mac o touchpad rola para o lado; com mouse comum a única
// saída era a barra horizontal, lá embaixo da última linha. Este hook mede a
// área que rola (para os botões ◀ ▶ e para o detalhe expandido acompanhar a
// largura visível). A área em si leva altura máxima (barra sempre à vista).

export function useRolagemLateral(larguraFixa = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [estado, setEstado] = useState<EstadoRolagem>({ transborda: false, podeEsquerda: false, podeDireita: false });
  const [largura, setLargura] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const novo = estadoRolagem(el);
      setEstado((v) => (v.transborda === novo.transborda && v.podeEsquerda === novo.podeEsquerda && v.podeDireita === novo.podeDireita ? v : novo));
      setLargura(el.clientWidth);
    };
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    // A tabela muda de largura quando a lista muda (busca, filtro), sem a área mudar.
    if (el.firstElementChild) obs.observe(el.firstElementChild);
    return () => {
      el.removeEventListener("scroll", medir);
      obs.disconnect();
    };
  }, []);

  const rolar = useCallback(
    (sentido: -1 | 1) => {
      const el = ref.current;
      if (!el) return;
      el.scrollBy({ left: sentido * passoRolagem(el.clientWidth, larguraFixa), behavior: "smooth" });
    },
    [larguraFixa],
  );

  return { ref, ...estado, largura, rolar };
}

function Seta({ sentido }: { sentido: -1 | 1 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round">
      <path d={sentido < 0 ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} />
    </svg>
  );
}

/** Botões ◀ ▶ — só aparecem quando a tabela não cabe. */
export function BotoesRolagem({ transborda, podeEsquerda, podeDireita, rolar }: EstadoRolagem & { rolar: (s: -1 | 1) => void }) {
  if (!transborda) return null;
  const btn =
    "inline-flex h-8 w-8 items-center justify-center text-slate-600 transition hover:bg-slate-100 hover:text-[#141a4d] disabled:cursor-default disabled:text-slate-300 disabled:hover:bg-transparent";
  return (
    <div className="hidden shrink-0 items-center overflow-hidden rounded-lg border border-slate-300 md:inline-flex" role="group" aria-label="Rolar a tabela para o lado">
      <button type="button" onClick={() => rolar(-1)} disabled={!podeEsquerda} className={btn} title="Ver colunas anteriores" aria-label="Ver colunas anteriores">
        <Seta sentido={-1} />
      </button>
      <span className="h-5 w-px bg-slate-200" />
      <button type="button" onClick={() => rolar(1)} disabled={!podeDireita} className={btn} title="Ver mais colunas" aria-label="Ver mais colunas">
        <Seta sentido={1} />
      </button>
    </div>
  );
}

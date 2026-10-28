"use client";

import { useEffect, useState } from "react";

// Número em pt-BR dentro de um texto já formatado: "1.234,56", "312", "12,5".
const NUMERO = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/;

/**
 * O texto formatado com o número escalado por `p` (0 → 1), preservando
 * prefixo, sufixo, casas decimais e separador de milhar. Em `p = 1` devolve o
 * texto original intacto; texto sem número volta igual.
 */
export function interpolarTexto(texto: string, p: number): string {
  if (p >= 1) return texto;
  const m = NUMERO.exec(texto);
  if (!m) return texto;
  const bruto = m[0];
  const casas = bruto.includes(",") ? bruto.length - bruto.indexOf(",") - 1 : 0;
  const valor = Number(bruto.replace(/\./g, "").replace(",", "."));
  const meio = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
    useGrouping: bruto.includes("."),
  }).format(valor * Math.max(0, p));
  return texto.slice(0, m.index) + meio + texto.slice(m.index + bruto.length);
}

export function prefereMenosMovimento(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Número que "conta" de zero até o valor (ease-out, uma vez por valor novo).
 * O servidor já renderiza o valor final; a contagem começa ao montar.
 */
export function NumeroAnimado({ texto, ms = 900 }: { texto: string; ms?: number }) {
  const [mostrado, setMostrado] = useState(texto);

  useEffect(() => {
    if (prefereMenosMovimento() || !NUMERO.test(texto)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMostrado(texto);
      return;
    }
    const t0 = performance.now();
    let quadro = 0;
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setMostrado(interpolarTexto(texto, 1 - Math.pow(1 - p, 3)));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [texto, ms]);

  return <span className="tabular-nums">{mostrado}</span>;
}

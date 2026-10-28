"use client";

import { useEffect, useLayoutEffect, useState } from "react";

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

  // Layout effect: o valor inicial da contagem entra antes da pintura — com
  // useEffect o número final aparecia por um quadro e "caía" para zero.
  useLayoutEffect(() => {
    if (prefereMenosMovimento() || !NUMERO.test(texto)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMostrado(texto);
      return;
    }
    setMostrado(interpolarTexto(texto, 0));
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

/**
 * Número de painel ao vivo: quando `valor` muda de um refresh para o outro, o
 * número dá um brilho âmbar e mostra a variação por alguns segundos. Primeiro
 * render (ou vindo de "sem dado") não brilha.
 */
export function ValorVivo({
  valor,
  texto,
  formatarDelta,
  className = "",
}: {
  valor: number | null;
  texto: string;
  formatarDelta: (d: number) => string;
  className?: string;
}) {
  const [anterior, setAnterior] = useState(valor);
  const [mudanca, setMudanca] = useState<{ delta: number; vez: number } | null>(null);

  // Ajuste durante o render (padrão do React p/ reagir a prop que mudou).
  if (valor !== anterior) {
    setAnterior(valor);
    if (anterior !== null && valor !== null) setMudanca({ delta: valor - anterior, vez: (mudanca?.vez ?? 0) + 1 });
  }

  useEffect(() => {
    if (!mudanca) return;
    const t = setTimeout(() => setMudanca(null), 1800);
    return () => clearTimeout(t);
  }, [mudanca]);

  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span key={mudanca?.vez ?? 0} className={`rounded-md tabular-nums ${mudanca ? "brilho-ambar" : ""}`}>
        {texto}
      </span>
      {mudanca && <span className="entrar text-[0.45em] font-bold text-amber-400">{formatarDelta(mudanca.delta)}</span>}
    </span>
  );
}

/** "AO VIVO · HH:MM" com ponto pulsando (Painel TV) ou só "Atualizado às HH:MM" (Dashboard). */
export function SeloVivo({ relogio, pulsando, className = "" }: { relogio: string; pulsando: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${className}`}>
      {pulsando && <span aria-hidden className="pulso-vivo h-2 w-2 rounded-full bg-amber-500" />}
      {pulsando ? `AO VIVO · ${relogio}` : `Atualizado às ${relogio}`}
    </span>
  );
}

/** O número contido num texto formatado em pt-BR ("R$ 1.234,56" → 1234.56); null se não houver. */
export function numeroDoTexto(texto: string): number | null {
  const m = NUMERO.exec(texto);
  if (!m) return null;
  const n = Number(m[0].replace(/\./g, "").replace(",", "."));
  return texto.slice(0, m.index).includes("-") ? -n : n;
}

/** Variação com sinal, nas mesmas casas decimais do texto original ("+3", "−1.250,40"). */
export function deltaNoFormato(texto: string, delta: number): string {
  const m = NUMERO.exec(texto);
  const casas = m && m[0].includes(",") ? m[0].length - m[0].indexOf(",") - 1 : 0;
  const abs = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas }).format(Math.abs(delta));
  return `${delta > 0 ? "+" : "−"}${abs}`;
}

"use client";

import { useEffect, useState } from "react";
import { MapaDevolucoes, type MunicipioMapa } from "./mapa-devolucoes";
import type { CidadeDevolucao } from "@/domain/devolucoes-mapa";

/**
 * Carrega a GEOMETRIA de PE (JSON grande) dinamicamente — só quando a aba do
 * mapa é aberta — e mescla com as cidades (com dado) para desenhar o mapa. Assim
 * a geometria não pesa no bundle inicial da página.
 */
export default function MapaLazy({ cidades }: { cidades: CidadeDevolucao[] }) {
  const [municipios, setMunicipios] = useState<MunicipioMapa[] | null>(null);

  useEffect(() => {
    let vivo = true;
    import("@/data/geo/pe-municipios.json").then((mod) => {
      if (!vivo) return;
      const geo = (mod.default ?? mod) as { ibge: string; nome: string; d: string }[];
      const porIbge = new Map(cidades.map((c) => [c.ibge, c]));
      setMunicipios(
        geo.map((g) => ({ ibge: g.ibge, nome: g.nome, d: g.d, dados: porIbge.get(g.ibge) ?? null })),
      );
    });
    return () => {
      vivo = false;
    };
  }, [cidades]);

  if (!municipios) {
    return <p className="py-8 text-center text-sm text-slate-400">Carregando mapa…</p>;
  }
  return <MapaDevolucoes municipios={municipios} cidades={cidades} />;
}

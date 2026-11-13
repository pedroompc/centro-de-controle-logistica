"use client";

import { useRouter } from "next/navigation";
import MapaLazy from "../devolucoes/mapa-lazy";
import type { CidadeDevolucao } from "@/domain/devolucoes-mapa";

/**
 * Mapa da Telemetria: clicar numa cidade com devolução abre a aba Devoluções
 * filtrada por ela, no mesmo período (como no app Flask).
 */
export default function MapaFrota({ cidades, periodo }: { cidades: CidadeDevolucao[]; periodo: Record<string, string> }) {
  const router = useRouter();
  const abrir = (c: CidadeDevolucao) => {
    const q = new URLSearchParams({ ...periodo, cidade: c.ibge });
    router.push(`/devolucoes?${q.toString()}`);
  };
  return <MapaLazy cidades={cidades} onAbrirCidade={abrir} abrirAoClicar />;
}

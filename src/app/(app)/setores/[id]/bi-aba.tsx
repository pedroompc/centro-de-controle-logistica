"use client";

import { useState } from "react";
import type { FiltroBI } from "@/domain/bi-recebimento";
import { MenuBI, PalcoBI, VISOES_BI, type DadosBI, type VisaoBI } from "./bi-recebimento";
import { BIShell, type HrefMes } from "./bi-shell";

/**
 * BI do Recebimento em tela cheia. O topo é o menu (quadros), o clique abre o
 * detalhe embaixo e o filtro cruzado (dia, fornecedor, tipo) vale para tudo.
 * Esc limpa os filtros.
 */
export function BIAba({ dados, hrefMes, hrefSair }: { dados: DadosBI; hrefMes: HrefMes; hrefSair: string }) {
  const [visao, setVisao] = useState<VisaoBI | null>(null);
  const [filtro, setFiltro] = useState<FiltroBI>({});
  const abrir = (v: VisaoBI) => setVisao((a) => (a === v ? null : v));
  const titulo = visao ? VISOES_BI.find((v) => v.id === visao) : null;

  return (
    <BIShell
      titulo="BI do Recebimento"
      mes={dados.mes}
      hrefMes={hrefMes}
      hrefSair={hrefSair}
      onEsc={() => setFiltro({})}
      dicaTopo="clique num quadro para abrir · Esc limpa os filtros"
      menu={
        dados.serie.length > 0 ? (
          <MenuBI dados={dados} visao={visao} onVisao={abrir} filtro={filtro} onFiltro={setFiltro} />
        ) : (
          <div className="mt-4 rounded-2xl bg-white/[0.06] px-5 py-6 text-center text-white/40 ring-1 ring-white/10">Sem dados de recebimento.</div>
        )
      }
      palco={
        visao && titulo
          ? { chave: visao, titulo: titulo.titulo, contexto: titulo.contexto, conteudo: <PalcoBI dados={dados} visao={visao} filtro={filtro} onFiltro={setFiltro} /> }
          : null
      }
    />
  );
}

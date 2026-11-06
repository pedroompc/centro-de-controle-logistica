"use client";

import { useState } from "react";
import { formatPercent } from "@/domain/format";
import { Vazio, Bloco, Mini, Dica, BarrasTV, BarraComposicao, ChipTV, ddmm } from "../bi-ui";
import { resumoVolume, historicoProduto } from "@/domain/abastecimento";
import type { DadosHarpiaAbastecimento } from "@/data/harpia-abastecimento";
import { corCurva, n0, n1 } from "./base";

const TOP_GIRO = 20;

const rotuloCurva = (c: string) => (c === "?" ? "Sem classificação" : `Curva ${c}`);

export function VisaoGiro({ h }: { h: DadosHarpiaAbastecimento }) {
  const [produtoAberto, setProdutoAberto] = useState<number | null>(null);
  const [curvaSel, setCurvaSel] = useState<string | null>(null);
  const resumo = resumoVolume(h.reabastecimento);
  const diasAtivos = resumo.dias;
  if (h.produtos.length === 0) return <Vazio>Nenhum abastecimento registrado no período.</Vazio>;
  const totalCurvas = h.curvas.reduce((t, c) => t + c.abastecimentos, 0);
  const curva = curvaSel ? h.curvas.find((c) => c.curva === curvaSel) ?? null : null;
  // Recorte: a curva clicada ou o mês inteiro.
  const abast = curva ? curva.abastecimentos : totalCurvas;
  const skus = curva ? curva.skus : h.curvas.reduce((t, c) => t + c.skus, 0);
  const lista = h.produtos
    .filter((p) => !curvaSel || (p.curva ?? "?") === curvaSel)
    .sort((a, b) => b.abastecimentos - a.abastecimentos)
    .slice(0, TOP_GIRO);
  const somaTop = lista.reduce((t, p) => t + p.abastecimentos, 0);
  const max = Math.max(1, ...lista.map((p) => p.abastecimentos));
  const fatiasCurva = h.curvas.map((c) => ({ rotulo: rotuloCurva(c.curva), valor: c.abastecimentos, cor: corCurva(c.curva) }));
  const produtoSel = produtoAberto ? h.produtos.find((p) => p.produto === produtoAberto) ?? null : null;
  const historico = produtoAberto ? historicoProduto(h.produtosDia, produtoAberto) : [];
  const toggle = (p: number) => setProdutoAberto((a) => (a === p ? null : p));
  const selecionarCurva = (r: string | null) => setCurvaSel(r === null ? null : h.curvas.find((c) => rotuloCurva(c.curva) === r)?.curva ?? null);
  const recorte = curva ? rotuloCurva(curva.curva).toLowerCase() : "no período";
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)] gap-3">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Mini
          rotulo={curva ? `Reabastecimentos · ${rotuloCurva(curva.curva)}` : "Reabastecimentos"}
          valor={n0(abast)}
          sub={curva && totalCurvas ? `${formatPercent(abast / totalCurvas, 0)} do total do período` : `${n0(resumo.caixas)} caixas no período`}
        />
        <Mini rotulo="Produtos reabastecidos" valor={n0(skus)} sub={`${n1(abast / Math.max(1, skus))} abast. por produto · ${recorte}`} />
        <Mini rotulo="Dias com reabastecimento" valor={String(diasAtivos)} sub={diasAtivos ? `${n0(abast / diasAtivos)} abast. por dia · ${recorte}` : undefined} />
        <Mini
          rotulo={`Peso do top ${TOP_GIRO}`}
          valor={abast ? formatPercent(somaTop / abast, 0) : "—"}
          sub={`${n0(somaTop)} abast. nos ${lista.length} produtos da lista`}
        />
      </div>
      {totalCurvas > 0 && (
        <Bloco titulo="Reabastecimento por curva ABC" direita={<Dica>clique numa curva pra ver os produtos dela · CLASSEVENDA do Winthor</Dica>} className="shrink-0">
          <BarraComposicao fatias={fatiasCurva} fmt={(v) => `${n0(v)} abast.`} selecionado={curva ? rotuloCurva(curva.curva) : null} onSelecionar={selecionarCurva} />
          <p className="mt-2 text-xs text-white/35">
            {h.curvas
              .filter((c) => c.curva !== "?")
              .map((c) => `curva ${c.curva}: ${c.skus} produtos, ${n1(c.abastecimentos / Math.max(1, c.skus))}/produto`)
              .join(" · ")}
          </p>
        </Bloco>
      )}
      <div className="grid min-h-0 gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Bloco
          titulo={curva ? `${rotuloCurva(curva.curva)} · mais reabastecidos` : "Produtos mais reabastecidos"}
          direita={
            curva ? (
              <ChipTV ativo onClick={() => setCurvaSel(null)}>
                {rotuloCurva(curva.curva)} ✕
              </ChipTV>
            ) : (
              <Dica>clique num produto pra ver o histórico diário</Dica>
            )
          }
        >
          <ul className="h-full space-y-2 overflow-auto pr-1">
            {lista.map((p) => (
              <li key={p.produto}>
                <button
                  type="button"
                  onClick={() => toggle(p.produto)}
                  className={`w-full rounded-lg px-1.5 py-1 text-left transition ${p.produto === produtoAberto ? "bg-amber-400/10 ring-1 ring-amber-400/40" : "hover:bg-white/[0.04]"}`}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-white" title={p.descricao ?? undefined}>
                      {p.curva && (
                        <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded text-[0.6rem] font-bold text-[#0a1650]" style={{ background: corCurva(p.curva) }}>
                          {p.curva}
                        </span>
                      )}
                      <span className="text-white/45">{p.produto}</span> {p.descricao ?? ""}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums text-white">
                      {n0(p.abastecimentos)} <span className="font-normal text-white/45">· {diasAtivos ? n1(p.abastecimentos / diasAtivos) : "—"}/dia</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-[#5b6fd6]" style={{ width: `${(p.abastecimentos / max) * 100}%` }} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Bloco>
        <Bloco titulo={produtoSel ? `${produtoSel.produto} · histórico diário` : "Histórico diário"} direita={produtoSel?.descricao ? <Dica>{produtoSel.descricao}</Dica> : undefined}>
          {produtoSel ? (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2">
                <Mini rotulo="Caixas" valor={n0(produtoSel.caixas)} />
                <Mini rotulo="Reabast./dia" valor={diasAtivos ? n1(produtoSel.abastecimentos / diasAtivos) : "—"} />
              </div>
              <BarrasTV
                altura={150}
                fmt={n0}
                itens={historico.map((d) => ({ chave: d.dia, rotulo: d.dia.slice(8, 10), valor: d.abastecimentos, detalhe: `${ddmm(d.dia)} · ${n0(d.abastecimentos)}` }))}
              />
            </>
          ) : (
            <p className="py-6 text-center text-sm text-white/40">Clique num produto na lista pra ver o histórico diário dele.</p>
          )}
        </Bloco>
      </div>
    </div>
  );
}

// --- MOVIMENTAÇÃO DE ENDEREÇO (equipe real de piso) -------------------------------

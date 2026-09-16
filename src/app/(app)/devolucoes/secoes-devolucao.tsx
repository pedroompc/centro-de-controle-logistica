"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { formatBRL } from "@/domain/format";
import type {
  DevolucaoPorMotivo,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  DevolucaoPorMotorista,
  SecaoRanking,
} from "@/domain/devolucoes";
import type { CidadeDevolucao, BairroDevolucao } from "@/domain/devolucoes-mapa";
import { setorPill } from "@/domain/devolucoes-ui";
import { carregarClientes, carregarVendedores, carregarMotoristas, carregarMapa, carregarBairrosRMR } from "./actions";
import TabelaMotoristas from "./tabela-motoristas";
import PainelRanking, { type ItemRanking } from "./painel-ranking";
import TabelaBairrosRMR from "./tabela-bairros-rmr";
import MapaLazy from "./mapa-lazy";
import { IconeCaminhao, IconePredio, IconeUsuario, IconeEtiqueta } from "./icons";

type Aba = "motoristas" | "clientes" | "vendedores" | "motivos" | "mapa" | "bairros";

/** Cache client-side das abas já carregadas (some ao trocar mês/filtro via `key`). */
interface Cache {
  clientes?: SecaoRanking<DevolucaoPorCliente>;
  vendedores?: SecaoRanking<DevolucaoPorVendedor>;
  motoristas?: SecaoRanking<DevolucaoPorMotorista>;
  mapa?: CidadeDevolucao[];
  bairros?: BairroDevolucao[];
}

function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <Card className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
      {texto}
    </Card>
  );
}

/** Lista "Por motivo" — já vem do núcleo (SSR), então a aba Motivos é instantânea. */
function PainelMotivos({ motivos }: { motivos: DevolucaoPorMotivo[] }) {
  const max = Math.max(1, ...motivos.map((m) => m.valor));
  return (
    <div className="max-h-[30rem] divide-y divide-slate-100 overflow-y-auto">
      {motivos.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-400">Sem devoluções no período.</p>
      ) : (
        motivos.map((m) => {
          const pct = Math.max(2, Math.round((m.valor / max) * 100));
          return (
            <div key={`${m.motivo}-${m.setor}`} className="px-5 py-2.5">
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-medium text-[#141a4d]" title={m.motivo}>{m.motivo}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${setorPill(m.setor)}`}>{m.setor}</span>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[#141a4d]">{formatBRL(m.valor)}</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-[#1b2168]" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-xs text-slate-400">{m.notas} notas</span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

export default function SecoesDevolucao({
  mes,
  motivo,
  setor,
  porMotivo,
}: {
  mes: string;
  motivo?: string;
  setor?: string;
  porMotivo: DevolucaoPorMotivo[];
}) {
  const [aba, setAba] = useState<Aba>("motoristas");
  const [cache, setCache] = useState<Cache>({});
  const [carregando, setCarregando] = useState<Aba | null>(null);
  const [erro, setErro] = useState<Partial<Record<Aba, boolean>>>({});

  // Busca os dados de uma aba (se ainda não estão em cache). Motivos usa o núcleo
  // (já veio do SSR) e o mapa/rankings vêm por Server Action, guardados no cache.
  const garantir = useCallback(async (alvo: Aba) => {
    if (alvo === "motivos") return;
    if (cache[alvo] !== undefined) return; // já carregado — usa o cache
    setCarregando(alvo);
    setErro((e) => ({ ...e, [alvo]: false }));
    try {
      if (alvo === "clientes") {
        const d = await carregarClientes(mes, motivo, setor);
        setCache((c) => ({ ...c, clientes: d }));
      } else if (alvo === "vendedores") {
        const d = await carregarVendedores(mes, motivo, setor);
        setCache((c) => ({ ...c, vendedores: d }));
      } else if (alvo === "motoristas") {
        const d = await carregarMotoristas(mes, motivo, setor);
        setCache((c) => ({ ...c, motoristas: d }));
      } else if (alvo === "mapa") {
        const d = await carregarMapa(mes);
        setCache((c) => ({ ...c, mapa: d }));
      } else if (alvo === "bairros") {
        const d = await carregarBairrosRMR(mes);
        setCache((c) => ({ ...c, bairros: d }));
      }
    } catch {
      setErro((e) => ({ ...e, [alvo]: true }));
    } finally {
      setCarregando((atual) => (atual === alvo ? null : atual));
    }
  }, [cache, mes, motivo, setor]);

  // Carrega a aba ativa quando ela muda (inclui a aba inicial ao montar). É uma
  // busca sob demanda: o setState (spinner) faz parte do fluxo, por isso a regra
  // de "setState no efeito" é dispensada aqui de propósito.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void garantir(aba);
  }, [aba, garantir]);

  const clientesItens: ItemRanking[] = (cache.clientes?.itens ?? []).map((c) => ({ cod: c.codcli, nome: c.nome, notas: c.notas, valor: c.valor }));
  const vendedoresItens: ItemRanking[] = (cache.vendedores?.itens ?? []).map((v) => ({ cod: v.codVendedor, nome: v.nome, notas: v.notas, valor: v.valor }));

  const abas: { id: Aba; label: string; icon: React.ReactNode }[] = [
    { id: "motoristas", label: "Motoristas", icon: <IconeCaminhao className="h-4 w-4" /> },
    { id: "clientes", label: "Clientes", icon: <IconePredio className="h-4 w-4" /> },
    { id: "vendedores", label: "Vendedores", icon: <IconeUsuario className="h-4 w-4" /> },
    { id: "motivos", label: "Motivos", icon: <IconeEtiqueta className="h-4 w-4" /> },
    { id: "mapa", label: "Mapa PE", icon: <IconePredio className="h-4 w-4" /> },
    { id: "bairros", label: "RMR/Bairros", icon: <IconePredio className="h-4 w-4" /> },
  ];

  const estaCarregando = carregando === aba && cache[aba as keyof Cache] === undefined;
  const falhou = erro[aba];

  return (
    <div>
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Seções de devolução">
        {abas.map((t) => {
          const ativo = aba === t.id;
          const lido = t.id === "motivos" || cache[t.id as keyof Cache] !== undefined;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={ativo}
              onClick={() => setAba(t.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition ${
                ativo
                  ? "border-[#181d55] bg-[#181d55] text-white"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
              }`}
              title={lido ? "Já carregado (em cache)" : "Carrega ao abrir"}
            >
              <span className={ativo ? "text-white" : "text-slate-400"}>{t.icon}</span>
              {t.label}
              {/* Pontinho = seção já carregada nesta sessão (cache quente). */}
              {lido && !ativo && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />}
            </button>
          );
        })}
      </div>

      {estaCarregando ? (
        <Carregando texto={`Carregando ${aba}…`} />
      ) : falhou ? (
        <Card className="flex flex-col items-center gap-3 py-14 text-sm text-slate-500">
          Não foi possível carregar esta seção.
          <button
            onClick={() => garantir(aba)}
            className="rounded-lg bg-[#181d55] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#10143f]"
          >
            Tentar de novo
          </button>
        </Card>
      ) : (
        <>
          {aba === "motoristas" && (
            <TabelaMotoristas motoristas={cache.motoristas?.itens ?? []} motivos={cache.motoristas?.motivos ?? {}} />
          )}

          {aba === "clientes" && (
            <PainelRanking
              icon={<IconePredio />}
              title="Clientes que mais devolvem"
              unidade="cliente"
              unidadePlural="clientes"
              buscaPlaceholder="Buscar cliente…"
              itens={clientesItens}
              motivos={cache.clientes?.motivos ?? {}}
            />
          )}

          {aba === "vendedores" && (
            <PainelRanking
              icon={<IconeUsuario />}
              tone="gold"
              title="Vendedores com mais devolução"
              unidade="vendedor"
              unidadePlural="vendedores"
              buscaPlaceholder="Buscar vendedor…"
              itens={vendedoresItens}
              motivos={cache.vendedores?.motivos ?? {}}
            />
          )}

          {aba === "motivos" && (
            <Card className="overflow-hidden">
              <PanelHeader icon={<IconeEtiqueta />} tone="gold" title="Por motivo" context={`${porMotivo.length} motivos · por valor`} />
              <PainelMotivos motivos={porMotivo} />
            </Card>
          )}

          {aba === "mapa" && (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-[#141a4d]">Mapa de devolução por cidade · Pernambuco</h3>
              {(cache.mapa?.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-400">Mapa indisponível — sem dado de cidade no período.</p>
              ) : (
                <MapaLazy cidades={cache.mapa ?? []} />
              )}
            </Card>
          )}

          {aba === "bairros" && <TabelaBairrosRMR bairros={cache.bairros ?? []} />}
        </>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { formatBRL } from "@/domain/format";
import type {
  DevolucaoPorMotivo,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  DevolucaoPorMotorista,
  MotivoDetalhe,
} from "@/domain/devolucoes";
import { setorPill } from "@/domain/devolucoes-ui";
import TabelaMotoristas from "./tabela-motoristas";
import PainelRanking, { type ItemRanking } from "./painel-ranking";
import { MapaDevolucoes, type MunicipioMapa } from "./mapa-devolucoes";
import type { CidadeDevolucao } from "@/domain/devolucoes-mapa";
import { IconeCaminhao, IconePredio, IconeUsuario, IconeEtiqueta } from "./icons";

type Aba = "motoristas" | "clientes" | "vendedores" | "motivos" | "mapa";

/** Lista "Por motivo" (mesma da versão empilhada), agora dentro da aba Motivos. */
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
  porMotivo,
  clientes,
  motivosPorCliente,
  vendedores,
  motivosPorVendedor,
  motoristas,
  motivosPorMotorista,
  municipios,
  cidades,
}: {
  porMotivo: DevolucaoPorMotivo[];
  clientes: DevolucaoPorCliente[];
  motivosPorCliente: Record<number, MotivoDetalhe[]>;
  vendedores: DevolucaoPorVendedor[];
  motivosPorVendedor: Record<number, MotivoDetalhe[]>;
  motoristas: DevolucaoPorMotorista[];
  motivosPorMotorista: Record<number, MotivoDetalhe[]>;
  municipios: MunicipioMapa[];
  cidades: CidadeDevolucao[];
}) {
  const [aba, setAba] = useState<Aba>("motoristas");

  const itensClientes: ItemRanking[] = clientes.map((c) => ({ cod: c.codcli, nome: c.nome, notas: c.notas, valor: c.valor }));
  const itensVendedores: ItemRanking[] = vendedores.map((v) => ({ cod: v.codVendedor, nome: v.nome, notas: v.notas, valor: v.valor }));

  const abas: { id: Aba; label: string; icon: React.ReactNode; n: number }[] = [
    { id: "motoristas", label: "Motoristas", icon: <IconeCaminhao className="h-4 w-4" />, n: motoristas.length },
    { id: "clientes", label: "Clientes", icon: <IconePredio className="h-4 w-4" />, n: clientes.length },
    { id: "vendedores", label: "Vendedores", icon: <IconeUsuario className="h-4 w-4" />, n: vendedores.length },
    { id: "motivos", label: "Motivos", icon: <IconeEtiqueta className="h-4 w-4" />, n: porMotivo.length },
    { id: "mapa", label: "Mapa PE", icon: <IconePredio className="h-4 w-4" />, n: cidades.length },
  ];

  return (
    <div>
      {/* Barra de abas — rola no mobile, sem estourar a largura da página */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Seções de devolução">
        {abas.map((t) => {
          const ativo = aba === t.id;
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
            >
              <span className={ativo ? "text-white" : "text-slate-400"}>{t.icon}</span>
              {t.label}
              <span className={`rounded-full px-1.5 text-[11px] font-bold tabular-nums ${ativo ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"}`}>
                {t.n}
              </span>
            </button>
          );
        })}
      </div>

      {aba === "motoristas" && <TabelaMotoristas motoristas={motoristas} motivos={motivosPorMotorista} />}

      {aba === "clientes" && (
        <PainelRanking
          icon={<IconePredio />}
          title="Clientes que mais devolvem"
          unidade="cliente"
          unidadePlural="clientes"
          buscaPlaceholder="Buscar cliente…"
          itens={itensClientes}
          motivos={motivosPorCliente}
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
          itens={itensVendedores}
          motivos={motivosPorVendedor}
        />
      )}

      {aba === "motivos" && (
        <Card className="overflow-hidden">
          <PanelHeader
            icon={<IconeEtiqueta />}
            tone="gold"
            title="Por motivo"
            context={`${porMotivo.length} motivos · por valor`}
          />
          <PainelMotivos motivos={porMotivo} />
        </Card>
      )}

      {aba === "mapa" && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold text-[#141a4d]">Mapa de devolução por cidade · Pernambuco</h3>
          {cidades.length === 0 ? (
            <p className="text-sm text-slate-400">Mapa indisponível — sem dado de cidade no período.</p>
          ) : (
            <MapaDevolucoes municipios={municipios} cidades={cidades} />
          )}
        </Card>
      )}
    </div>
  );
}

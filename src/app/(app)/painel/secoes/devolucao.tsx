"use client";

import { useEffect, useState, type ReactNode } from "react";
import { formatPercent } from "@/domain/format";
import type { DevolucaoPorMotorista, DevolucaoPorCliente, DevolucaoPorVendedor, DevolucaoPorMotivo, MotivoDetalhe } from "@/domain/devolucoes";
import { setorPredominante, motivoPredominante } from "@/domain/devolucoes-ui";
import { BigRanking, RankingDuasColunas, SeloSetor } from "./base";

/**
 * Devoluções · clientes e vendedores lado a lado, numa página só.
 *
 * Sem R$ exposto (decisão da diretoria): cada linha mostra a PARTICIPAÇÃO no
 * total devolvido (valor da linha ÷ total devolvido geral), não o valor. O nº de
 * notas continua — é contagem, não dinheiro.
 */
export function SecaoClientesVendedores({
  clientes,
  vendedores,
  totalDevolvido,
  clientesMotivos,
  vendedoresMotivos,
}: {
  clientes: DevolucaoPorCliente[];
  vendedores: DevolucaoPorVendedor[];
  totalDevolvido: number;
  clientesMotivos: Record<number, MotivoDetalhe[]>;
  vendedoresMotivos: Record<number, MotivoDetalhe[]>;
}) {
  const parte = (valor: number) => (totalDevolvido > 0 ? formatPercent(valor / totalDevolvido) : "—");
  // Chip do setor predominante (Comercial/Logística/...) — responde "é comercial
  // ou logístico?" para cada cliente/vendedor.
  const seloDe = (motivos: MotivoDetalhe[] | undefined) => {
    const sp = setorPredominante(motivos);
    return sp ? <SeloSetor setor={sp.setor} /> : undefined;
  };
  // Linha de detalhe: "N notas · <motivo predominante>" (motivo truncado p/ não poluir).
  const detalheDe = (notas: number, motivos: MotivoDetalhe[] | undefined) => {
    const mt = motivoPredominante(motivos);
    const curto = mt ? (mt.length > 26 ? `${mt.slice(0, 25)}…` : mt) : null;
    return curto ? `${notas} notas · ${curto}` : `${notas} notas`;
  };
  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-0">
      {/* Coluna clientes — separada da de vendedores por uma divisória. */}
      <div className="flex min-h-0 flex-col lg:pr-8">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
          <span className="h-4 w-1 rounded-full bg-amber-400" />
          Clientes que mais devolvem
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <BigRanking
            denso
            linhas={[...clientes].sort((a, b) => b.valor - a.valor).slice(0, 8).map((c) => ({
              chave: c.codcli,
              nome: c.nome,
              principal: parte(c.valor),
              secundario: detalheDe(c.notas, clientesMotivos[c.codcli]),
              seloDireita: seloDe(clientesMotivos[c.codcli]),
            }))}
          />
        </div>
      </div>
      <div className="flex min-h-0 flex-col border-t border-white/15 pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
          <span className="h-4 w-1 rounded-full bg-amber-400" />
          Vendedores com mais devolução
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <BigRanking
            denso
            linhas={[...vendedores].sort((a, b) => b.valor - a.valor).slice(0, 8).map((v) => ({
              chave: v.codVendedor,
              nome: v.nome,
              principal: parte(v.valor),
              secundario: detalheDe(v.notas, vendedoresMotivos[v.codVendedor]),
              seloDireita: seloDe(vendedoresMotivos[v.codVendedor]),
            }))}
          />
        </div>
      </div>
    </div>
  );
}

const STAGE_MS = 7500; // tempo de cada etapa (por nota / por valor)

const MIN_ENTREGAS = 20; // piso p/ ranking em % (senão 1 entrega vira 100%)

function seloTipoMotorista(tipo: DevolucaoPorMotorista["tipo"]): ReactNode {
  if (tipo === "F") return <span className="shrink-0 rounded-full bg-[#2a327f] px-2 py-0.5 text-xs font-semibold text-indigo-100">Da casa</span>;
  if (tipo === "T") return <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-200">Terceirizado</span>;
  return null;
}

/**
 * Devoluções · motoristas que mais voltam. Duas etapas que se alternam sozinhas
 * (mesmo efeito do mapa): etapa 1 = taxa por NOTA (devolvidas/expedidas), etapa
 * 2 = taxa por VALOR (R$ devolvido/R$ expedido). Só motoristas com volume
 * mínimo (senão 1 entrega vira 100%).
 */
export function SecaoMotoristas({ motoristas, pausado = false }: { motoristas: DevolucaoPorMotorista[]; pausado?: boolean }) {
  const [etapa, setEtapa] = useState(0);
  // Painel travado: para de alternar e fica na etapa escolhida (dá para trocar no clique).
  useEffect(() => {
    if (pausado) return;
    const t = setInterval(() => setEtapa((e) => (e === 0 ? 1 : 0)), STAGE_MS);
    return () => clearInterval(t);
  }, [pausado]);

  const elegiveis = motoristas.filter((m) => m.expedidas >= MIN_ENTREGAS);

  const porNota = [...elegiveis].sort((a, b) => b.taxa - a.taxa).slice(0, 10);
  const porValor = elegiveis
    .filter((m) => m.valorExpedido > 0)
    .map((m) => ({ m, tx: m.valorDevolvido / m.valorExpedido }))
    .sort((a, b) => b.tx - a.tx)
    .slice(0, 10);

  const etapas = [
    {
      id: "nota",
      titulo: "Por nota",
      sub: "entregas voltadas ÷ entregas (%)",
      linhas: porNota.map((m) => ({
        chave: m.codMotorista,
        nome: m.nome,
        principal: formatPercent(m.taxa / 100),
        secundario: `${m.devolvidas} de ${m.expedidas} entregas`,
        selo: seloTipoMotorista(m.tipo),
      })),
    },
    {
      id: "valor",
      titulo: "Por valor",
      sub: "valor devolvido ÷ valor expedido (%)",
      linhas: porValor.map(({ m, tx }) => ({
        chave: m.codMotorista,
        nome: m.nome,
        principal: formatPercent(tx),
        secundario: `${m.devolvidas} de ${m.expedidas} entregas`,
        selo: seloTipoMotorista(m.tipo),
      })),
    },
  ];
  const atual = etapas[etapa];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center gap-3">
        <div className="flex gap-1.5">
          {etapas.map((e, i) => (
            <button
              key={e.id}
              type="button"
              onClick={() => setEtapa(i)}
              aria-pressed={i === etapa}
              className={`rounded-full px-3 py-1 text-sm font-semibold uppercase tracking-[0.12em] transition ${
                i === etapa ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/60" : "text-white/45 hover:bg-white/10 hover:text-white/80"
              }`}
            >
              {e.titulo}
            </button>
          ))}
        </div>
        <span className="text-xs text-white/45">{atual.sub}</span>
        <span className="ml-auto text-xs text-white/35">com {MIN_ENTREGAS}+ entregas</span>
      </div>
      <div key={atual.id} className="etapa-fade min-h-0 flex-1">
        <RankingDuasColunas linhas={atual.linhas} />
      </div>
      <style>{`
        @keyframes etapaFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        .etapa-fade { animation: etapaFade 0.45s ease-out both; }
      `}</style>
    </div>
  );
}

/** Devoluções · motivos (participação no total devolvido, sem R$). */
export function SecaoMotivos({ porMotivo }: { porMotivo: DevolucaoPorMotivo[] }) {
  const totalDevolvido = porMotivo.reduce((s, m) => s + m.valor, 0);
  const parte = (valor: number) => (totalDevolvido > 0 ? formatPercent(valor / totalDevolvido) : "—");
  const top = [...porMotivo].sort((a, b) => b.valor - a.valor).slice(0, 10);
  return (
    <RankingDuasColunas
      linhas={top.map((m) => ({
        chave: `${m.motivo}-${m.setor}`,
        nome: m.motivo,
        principal: parte(m.valor),
        secundario: `${m.notas} notas`,
        selo: <SeloSetor setor={m.setor} />,
      }))}
    />
  );
}

"use client";

import { useMemo, useState } from "react";
import { Card, StatCard, Pill } from "@/components/ui";
import { formatBRL, formatKg } from "@/domain/format";
import type { PedidoPendente } from "@/domain/pedidos-a-faturar/tipos";

/** Pedido enriquecido com a região operacional (do calendário, só p/ filtro). */
export interface PedidoLista extends PedidoPendente {
  regiao: string | null;
}

/** Máximo de linhas renderizadas de uma vez — acima disso, refine com os filtros. */
const LIMITE_LINHAS = 200;

/** Horas paradas → "3d 1h" (ou "5h" abaixo de um dia). Tempo no sistema. */
function tempoParado(horas: number): string {
  const h = Math.floor(horas);
  if (h < 24) return `${h}h`;
  const dias = Math.floor(h / 24);
  const resto = h % 24;
  return resto ? `${dias}d ${resto}h` : `${dias}d`;
}

function statusLabel(status: string): string {
  if (status === "L") return "Liberado";
  if (status === "M") return "Montado";
  return status;
}

/** Opções distintas ordenadas de uma chave string (ignora nulos/vazios). */
function distintos(valores: (string | null)[]): string[] {
  return [...new Set(valores.filter((v): v is string => !!v && v.trim() !== ""))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

const selectClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[#1b2168] focus:ring-2 focus:ring-[#1b2168]/15";

export function PedidosAFaturarView({ pedidos }: { pedidos: PedidoLista[] }) {
  const [busca, setBusca] = useState("");
  const [regiao, setRegiao] = useState("");
  const [cidade, setCidade] = useState("");
  const [rca, setRca] = useState("");

  const regioes = useMemo(() => distintos(pedidos.map((p) => p.regiao)), [pedidos]);
  const cidades = useMemo(() => distintos(pedidos.map((p) => p.cidadeCliente)), [pedidos]);
  const rcas = useMemo(() => distintos(pedidos.map((p) => p.nomeRca)), [pedidos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (regiao && p.regiao !== regiao) return false;
      if (cidade && p.cidadeCliente !== cidade) return false;
      if (rca && p.nomeRca !== rca) return false;
      if (termo) {
        const alvo = `${p.nomeCliente} ${p.numeroPedido}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [pedidos, busca, regiao, cidade, rca]);

  const resumo = useMemo(
    () => ({
      total: filtrados.length,
      valorTotal: filtrados.reduce((s, p) => s + p.valorPedido, 0),
      pesoTotal: filtrados.reduce((s, p) => s + p.pesoPedido, 0),
    }),
    [filtrados],
  );

  const temFiltro = !!(busca || regiao || cidade || rca);
  const visiveis = filtrados.slice(0, LIMITE_LINHAS);

  return (
    <div className="space-y-6">
      {/* Resumo — reage aos filtros */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pedidos a faturar"
          value={`${resumo.total}`}
          hint={temFiltro ? `de ${pedidos.length} no total` : undefined}
          accent="navy"
        />
        <StatCard label="Valor parado" value={formatBRL(resumo.valorTotal)} accent="navy" />
        <StatCard label="Peso parado" value={formatKg(resumo.pesoTotal)} accent="navy" />
      </div>

      {/* Barra de filtros */}
      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente ou nº do pedido…"
              className={selectClass}
            />
          </div>
          <div className="md:col-span-3">
            <select value={regiao} onChange={(e) => setRegiao(e.target.value)} className={selectClass}>
              <option value="">
                {regioes.length ? "Todas as regiões" : "Região (aplique o calendário)"}
              </option>
              {regioes.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-3">
            <select value={cidade} onChange={(e) => setCidade(e.target.value)} className={selectClass}>
              <option value="">Todas as cidades</option>
              {cidades.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <select value={rca} onChange={(e) => setRca(e.target.value)} className={selectClass}>
              <option value="">Todos os RCAs</option>
              {rcas.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>
        {temFiltro && (
          <div className="mt-3 flex items-center gap-3 text-sm text-slate-500">
            <span className="tabular-nums">
              {filtrados.length} de {pedidos.length} pedidos
            </span>
            <button
              type="button"
              onClick={() => {
                setBusca("");
                setRegiao("");
                setCidade("");
                setRca("");
              }}
              className="font-medium text-[#1b2168] underline-offset-2 hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </Card>

      {/* Tabela */}
      <Card className="p-0">
        <div className="max-h-[70vh] overflow-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Pedido</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Cidade</th>
                <th className="px-4 py-3">Vendedor (RCA)</th>
                <th className="px-4 py-3">Supervisor</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-right">Tempo parado</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
                <tr key={p.numeroPedido} className="border-b border-slate-100 transition hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 tabular-nums text-slate-700">
                    {p.numeroPedido}
                    {p.reentrega && (
                      <span className="ml-1 text-xs font-medium text-amber-600" title="Reentrega">
                        ↩
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-[#141a4d]">{p.nomeCliente}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-slate-700">{p.cidadeCliente ?? "—"}</span>
                    {p.regiao && <span className="block text-xs text-slate-400">{p.regiao}</span>}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{p.nomeRca}</td>
                  <td className="px-4 py-2.5 text-slate-600">{p.nomeSupervisor ?? "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-700">{formatBRL(p.valorPedido)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-[#141a4d]">
                    {tempoParado(p.horasParado)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Pill tone={p.statusWinthor === "M" ? "gold" : "navy"}>{statusLabel(p.statusWinthor)}</Pill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtrados.length === 0 && (
          <p className="px-4 py-6 text-sm text-slate-500">Nenhum pedido encontrado com esses filtros.</p>
        )}
        {filtrados.length > LIMITE_LINHAS && (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            Mostrando os {LIMITE_LINHAS} mais antigos de {filtrados.length}. Use os filtros para refinar.
          </p>
        )}
      </Card>
    </div>
  );
}

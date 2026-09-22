"use client";

import { useState, useMemo, useCallback, Fragment } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { filtrarPorBusca } from "@/domain/devolucoes-ui";
import { formatBRL, formatKg } from "@/domain/format";
import { estadoPedidoInfo } from "@/domain/pedidos-consulta";
import type { PedidoConsulta, ItemPedido } from "@/domain/pedidos-consulta";
import { carregarItensPedido } from "./actions";

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Realça pedidos "parados": muitos dias no sistema e ainda não faturado/cancelado.
function corDias(p: PedidoConsulta): string {
  if (p.posicao === "F" || p.posicao === "C") return "text-slate-500";
  if (p.diasNoSistema >= 15) return "text-rose-600 font-semibold";
  if (p.diasNoSistema >= 7) return "text-amber-600 font-semibold";
  return "text-slate-500";
}

const IconeBusca = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
  </svg>
);
const IconeBaixo = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
);
const IconeCima = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className} strokeLinecap="round" strokeLinejoin="round"><path d="m6 15 6-6 6 6" /></svg>
);
const IconeCarrinho = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 5h2l2 11h10l2-7H7" /><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" />
  </svg>
);

function Selo({ posicao }: { posicao: string }) {
  const info = estadoPedidoInfo(posicao);
  return <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${info.badge}`}>{info.label}</span>;
}

function Detalhe({ pedido, itens, carregando }: { pedido: PedidoConsulta; itens: ItemPedido[] | undefined; carregando: boolean }) {
  const endereco = [pedido.endereco, pedido.bairro].filter(Boolean).join(", ");
  const local = [pedido.cidade, pedido.uf].filter(Boolean).join(" · ");
  return (
    <div className="space-y-3 px-4 py-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Endereço de entrega</p>
          <p className="mt-0.5 text-[#141a4d]">{endereco || "—"}</p>
          <p className="text-slate-500">{local || "—"}</p>
        </div>
        <div className="sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Situação</p>
          <p className="mt-0.5 text-slate-600">
            RCA: <b className="text-[#141a4d]">{pedido.rca ?? "—"}</b>
          </p>
          <p className="text-slate-600">
            DT Pedido: <b className="text-[#141a4d]">{fmtData(pedido.data)}</b>
            {" · "}DT Faturada: <b className="text-[#141a4d]">{fmtData(pedido.dataFaturamento)}</b>
            {pedido.notaFiscal != null && <> {" · "}NF <b className="text-[#141a4d]">{pedido.notaFiscal}</b></>}
          </p>
          <p className="text-slate-600">
            Devolução:{" "}
            <b className={pedido.temDevolucao ? "text-rose-600" : "text-slate-500"}>
              {pedido.temDevolucao ? "Sim" : "Não"}
            </b>
            {" · "}Motorista: <b className="text-[#141a4d]">{pedido.motorista ?? "—"}</b>
          </p>
          {pedido.temDevolucao && (
            <p className="text-slate-600">
              Motivo:{" "}
              <b className="text-rose-600">{pedido.motivoDevolucao ?? "Não informado"}</b>
            </p>
          )}
        </div>
      </div>

      {pedido.notaFiscal != null && (
        <div>
          <a
            href={`/pedidos/${pedido.numped}/danfe`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-2 rounded-lg bg-[#181d55] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#10143f]"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2" />
            </svg>
            Baixar DANFE (PDF)
          </a>
        </div>
      )}

      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Produtos {pedido.qtdItens > 0 && `(${pedido.qtdItens})`}
        </p>
        {carregando ? (
          <p className="py-3 text-center text-xs text-slate-400">Carregando itens…</p>
        ) : !itens || itens.length === 0 ? (
          <p className="py-3 text-center text-xs text-slate-400">Sem itens para este pedido.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">Produto</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Qtd</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((it) => (
                  <tr key={it.codprod} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">
                      <span className="text-[#141a4d]">{it.descricao}</span>
                      <span className="ml-1.5 text-[10px] text-slate-400">#{it.codprod}</span>
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-slate-600">{it.quantidade}</td>
                    <td className="px-3 py-1.5 text-right font-medium tabular-nums text-[#141a4d]">{formatBRL(it.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default function TabelaPedidos({ pedidos }: { pedidos: PedidoConsulta[] }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const [itens, setItens] = useState<Record<number, ItemPedido[]>>({});
  const [carregando, setCarregando] = useState<number | null>(null);

  const lista = useMemo(
    () => filtrarPorBusca(pedidos, busca, (p) => [
      p.numped, p.cliente, p.motorista ?? "", p.cidade ?? "", p.rca ?? "", p.notaFiscal ?? "",
    ]),
    [pedidos, busca],
  );

  const totalValor = useMemo(() => lista.reduce((t, p) => t + p.valor, 0), [lista]);
  const comDev = useMemo(() => lista.filter((p) => p.temDevolucao).length, [lista]);

  const abrir = useCallback(async (numped: number) => {
    setAberto((a) => (a === numped ? null : numped));
    if (itens[numped] !== undefined) return; // já em cache
    setCarregando(numped);
    try {
      const dados = await carregarItensPedido(numped);
      setItens((m) => ({ ...m, [numped]: dados }));
    } finally {
      setCarregando((c) => (c === numped ? null : c));
    }
  }, [itens]);

  const campoBusca = (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconeBusca /></span>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar pedido, cliente, motorista…"
        aria-label="Buscar pedido"
        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50 sm:w-72"
      />
    </div>
  );

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconeCarrinho />}
        title="Pedidos"
        context={`${lista.length} pedidos · ${formatBRL(totalValor)}${comDev ? ` · ${comDev} com devolução` : ""}`}
        right={campoBusca}
      />

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-3 py-3 text-left font-semibold">Pedido</th>
              <th className="min-w-[200px] px-3 py-3 text-left font-semibold">Cliente</th>
              <th className="px-3 py-3 text-left font-semibold">RCA</th>
              <th className="px-3 py-3 text-left font-semibold">Cidade</th>
              <th className="px-3 py-3 text-left font-semibold">Estado</th>
              <th className="px-3 py-3 text-right font-semibold">Dias</th>
              <th className="px-3 py-3 text-left font-semibold">Motorista</th>
              <th className="px-3 py-3 text-left font-semibold">DT Pedido</th>
              <th className="px-3 py-3 text-left font-semibold">DT Faturada</th>
              <th className="px-3 py-3 text-right font-semibold">Peso</th>
              <th className="px-3 py-3 text-right font-semibold">Valor</th>
              <th className="w-10 px-3 py-3" aria-label="Detalhes" />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={12} className="py-12 text-center text-sm text-slate-400">
                  {busca ? `Nenhum pedido para "${busca}".` : "Nenhum pedido para os filtros selecionados."}
                </td>
              </tr>
            ) : (
              lista.map((p) => {
                const estaAberto = aberto === p.numped;
                return (
                  <Fragment key={p.numped}>
                    <tr
                      onClick={() => abrir(p.numped)}
                      aria-expanded={estaAberto}
                      className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50/50 ${estaAberto ? "bg-amber-50/40" : ""}`}
                    >
                      <td className="px-3 py-3">
                        <div className="font-semibold tabular-nums text-[#141a4d]">{p.numped}</div>
                        {p.temDevolucao && <span className="mt-0.5 inline-flex rounded bg-rose-50 px-1.5 text-[9px] font-semibold text-rose-600">devolução</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="max-w-[260px] truncate text-[#141a4d]">{p.cliente}</div>
                        <div className="text-[10px] text-slate-400">Cód. {p.codcli}</div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        <div className="max-w-[160px] truncate">{p.rca ?? <span className="text-slate-300">—</span>}</div>
                        {p.codRca != null && <div className="text-[10px] text-slate-400">Cód. {p.codRca}</div>}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {p.cidade ?? "—"}{p.uf ? <span className="text-slate-400"> / {p.uf}</span> : null}
                      </td>
                      <td className="px-3 py-3"><Selo posicao={p.posicao} /></td>
                      <td className={`px-3 py-3 text-right tabular-nums ${corDias(p)}`}>{p.diasNoSistema}</td>
                      <td className="px-3 py-3 text-slate-600">{p.motorista ?? <span className="text-slate-300">—</span>}</td>
                      <td className="px-3 py-3 tabular-nums text-slate-600">{fmtData(p.data)}</td>
                      <td className="px-3 py-3 text-slate-600">
                        <div className="tabular-nums">{fmtData(p.dataFaturamento)}</div>
                        {p.notaFiscal != null && <div className="text-[10px] tabular-nums text-slate-400">NF {p.notaFiscal}</div>}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-600">{formatKg(p.peso)}</td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#141a4d]">{formatBRL(p.valor)}</td>
                      <td className="px-3 py-3 text-center text-slate-400">
                        {estaAberto ? <IconeCima className="mx-auto h-4 w-4" /> : <IconeBaixo className="mx-auto h-4 w-4" />}
                      </td>
                    </tr>
                    {estaAberto && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={12} className="p-0">
                          <Detalhe pedido={p} itens={itens[p.numped]} carregando={carregando === p.numped} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {lista.length === 0 ? (
          <li className="py-12 text-center text-sm text-slate-400">
            {busca ? `Nenhum pedido para "${busca}".` : "Nenhum pedido no período/estado selecionado."}
          </li>
        ) : (
          lista.map((p) => {
            const estaAberto = aberto === p.numped;
            return (
              <li key={p.numped} className={estaAberto ? "bg-amber-50/40" : ""}>
                <div onClick={() => abrir(p.numped)} className="cursor-pointer px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold tabular-nums text-[#141a4d]">#{p.numped}</span>
                    <Selo posicao={p.posicao} />
                    {p.temDevolucao && <span className="rounded bg-rose-50 px-1.5 text-[9px] font-semibold text-rose-600">devolução</span>}
                    <span className="ml-auto font-semibold tabular-nums text-[#141a4d]">{formatBRL(p.valor)}</span>
                    {estaAberto ? <IconeCima className="h-4 w-4 text-slate-400" /> : <IconeBaixo className="h-4 w-4 text-slate-400" />}
                  </div>
                  <p className="mt-1 truncate text-sm text-[#141a4d]">{p.cliente}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
                    <span>{p.cidade ?? "—"}{p.uf ? `/${p.uf}` : ""}</span>
                    <span className={corDias(p)}>{p.diasNoSistema} dias</span>
                    {p.rca && <span>RCA: {p.rca}</span>}
                    {p.motorista && <span>Mot.: {p.motorista}</span>}
                    <span>Ped.: {fmtData(p.data)}</span>
                    <span>Fat.: {fmtData(p.dataFaturamento)}</span>
                    <span>{formatKg(p.peso)}</span>
                    {p.notaFiscal != null && <span>NF {p.notaFiscal}</span>}
                  </div>
                </div>
                {estaAberto && <Detalhe pedido={p} itens={itens[p.numped]} carregando={carregando === p.numped} />}
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}

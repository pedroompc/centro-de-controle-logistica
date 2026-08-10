"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, StatCard, Pill } from "@/components/ui";
import { formatBRL, formatKg } from "@/domain/format";
import type { PedidoPendente } from "@/domain/pedidos-a-faturar/tipos";

/** Pedido enriquecido com a região operacional (do calendário, só p/ filtro). */
export interface PedidoLista extends PedidoPendente {
  regiao: string | null;
}

/** Máximo de linhas renderizadas de uma vez — acima disso, refine com os filtros. */
const LIMITE_LINHAS = 200;

/** Colunas ordenáveis: chave do pedido, rótulo, tipo (p/ comparador) e alinhamento. */
const COLUNAS = [
  { chave: "numeroPedido", label: "Pedido", tipo: "num", align: "left" },
  { chave: "nomeCliente", label: "Cliente", tipo: "texto", align: "left" },
  { chave: "cidadeCliente", label: "Cidade", tipo: "texto", align: "left" },
  { chave: "nomeRca", label: "Vendedor (RCA)", tipo: "texto", align: "left" },
  { chave: "nomeSupervisor", label: "Supervisor", tipo: "texto", align: "left" },
  { chave: "valorPedido", label: "Valor", tipo: "num", align: "right" },
  { chave: "horasParado", label: "Tempo parado", tipo: "num", align: "right" },
  { chave: "statusWinthor", label: "Status", tipo: "texto", align: "left" },
] as const;

type ColunaChave = (typeof COLUNAS)[number]["chave"];
type Direcao = "asc" | "desc";

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

export function PedidosAFaturarView({
  pedidos,
  atualizadoEm,
}: {
  pedidos: PedidoLista[];
  atualizadoEm?: string;
}) {
  const router = useRouter();
  const [atualizando, startTransition] = useTransition();
  const atualizar = () => startTransition(() => router.refresh());

  const [busca, setBusca] = useState("");
  const [regiao, setRegiao] = useState("");
  const [cidade, setCidade] = useState("");
  const [rca, setRca] = useState("");
  const [status, setStatus] = useState(""); // "" = todos | "L" | "M"
  const [ordenarPor, setOrdenarPor] = useState<ColunaChave>("horasParado");
  const [direcao, setDirecao] = useState<Direcao>("desc");

  const regioes = useMemo(() => distintos(pedidos.map((p) => p.regiao)), [pedidos]);
  const cidades = useMemo(() => distintos(pedidos.map((p) => p.cidadeCliente)), [pedidos]);
  const rcas = useMemo(() => distintos(pedidos.map((p) => p.nomeRca)), [pedidos]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (regiao && p.regiao !== regiao) return false;
      if (cidade && p.cidadeCliente !== cidade) return false;
      if (rca && p.nomeRca !== rca) return false;
      if (status && p.statusWinthor !== status) return false;
      if (termo) {
        const alvo = `${p.nomeCliente} ${p.numeroPedido}`.toLowerCase();
        if (!alvo.includes(termo)) return false;
      }
      return true;
    });
  }, [pedidos, busca, regiao, cidade, rca, status]);

  const ordenados = useMemo(() => {
    const tipo = COLUNAS.find((c) => c.chave === ordenarPor)!.tipo;
    const arr = [...filtrados];
    arr.sort((a, b) => {
      const va = a[ordenarPor];
      const vb = b[ordenarPor];
      // Vazios sempre por último, independente da direção.
      const na = va == null || va === "";
      const nb = vb == null || vb === "";
      if (na && nb) return 0;
      if (na) return 1;
      if (nb) return -1;
      const cmp =
        tipo === "num"
          ? Number(va) - Number(vb)
          : String(va).localeCompare(String(vb), "pt-BR");
      return direcao === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtrados, ordenarPor, direcao]);

  function ordenar(chave: ColunaChave) {
    if (chave === ordenarPor) {
      setDirecao((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setOrdenarPor(chave);
      // Número começa do maior→menor; texto começa de A→Z.
      setDirecao(COLUNAS.find((c) => c.chave === chave)!.tipo === "num" ? "desc" : "asc");
    }
  }

  const resumo = useMemo(
    () => ({
      total: filtrados.length,
      valorTotal: filtrados.reduce((s, p) => s + p.valorPedido, 0),
      pesoTotal: filtrados.reduce((s, p) => s + p.pesoPedido, 0),
    }),
    [filtrados],
  );

  const temFiltro = !!(busca || regiao || cidade || rca || status);
  const visiveis = ordenados.slice(0, LIMITE_LINHAS);

  return (
    <div className="space-y-6">
      {/* Barra superior: atualização ao vivo do Winthor */}
      <div className="flex items-center justify-end gap-3">
        {atualizadoEm && (
          <span className="text-xs text-slate-400">Atualizado às {atualizadoEm}</span>
        )}
        <button
          type="button"
          onClick={atualizar}
          disabled={atualizando}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1b2168] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#141a4d] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 ${atualizando ? "animate-spin" : ""}`}
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
          {atualizando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>

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
        <div className="grid grid-cols-2 gap-3 md:grid-cols-12">
          <div className="col-span-2 md:col-span-3">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente ou nº do pedido…"
              className={selectClass}
            />
          </div>
          <div className="col-span-2 md:col-span-3">
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
          <div className="md:col-span-2">
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
          <div className="col-span-2 md:col-span-2">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
              <option value="">Todos os status</option>
              <option value="L">Liberado</option>
              <option value="M">Montado</option>
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
                setStatus("");
              }}
              className="font-medium text-[#1b2168] underline-offset-2 hover:underline"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </Card>

      {/* Tabela — desktop */}
      <Card className="hidden p-0 md:block">
        <div className="max-h-[70vh] overflow-auto rounded-2xl">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-white/95 backdrop-blur">
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                {COLUNAS.map((c) => {
                  const ativo = ordenarPor === c.chave;
                  return (
                    <th key={c.chave} className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""}`}>
                      <button
                        type="button"
                        onClick={() => ordenar(c.chave)}
                        className={`inline-flex items-center gap-1 uppercase tracking-wide transition hover:text-[#1b2168] ${
                          c.align === "right" ? "flex-row-reverse" : ""
                        } ${ativo ? "text-[#1b2168]" : ""}`}
                      >
                        {c.label}
                        <span className={`text-[10px] leading-none ${ativo ? "text-[#1b2168]" : "text-slate-300"}`}>
                          {ativo ? (direcao === "asc" ? "▲" : "▼") : "⇅"}
                        </span>
                      </button>
                    </th>
                  );
                })}
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
            Mostrando {LIMITE_LINHAS} de {filtrados.length} (pela ordenação atual). Use os filtros para refinar.
          </p>
        )}
      </Card>

      {/* Lista — mobile */}
      <div className="md:hidden">
        {/* Ordenação (as colunas clicáveis não existem no card) */}
        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs font-medium text-slate-400">Ordenar</label>
          <select
            value={ordenarPor}
            onChange={(e) => ordenar(e.target.value as ColunaChave)}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm outline-none focus:border-[#1b2168] focus:ring-2 focus:ring-[#1b2168]/15"
          >
            {COLUNAS.map((c) => (
              <option key={c.chave} value={c.chave}>
                {c.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setDirecao((d) => (d === "asc" ? "desc" : "asc"))}
            aria-label={direcao === "asc" ? "Crescente" : "Decrescente"}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-[#1b2168] shadow-sm active:bg-slate-50"
          >
            {direcao === "asc" ? "▲" : "▼"}
          </button>
        </div>

        {filtrados.length === 0 ? (
          <Card className="p-6 text-center text-sm text-slate-500">
            Nenhum pedido encontrado com esses filtros.
          </Card>
        ) : (
          <div className="space-y-2.5">
            {visiveis.map((p) => (
              <div key={p.numeroPedido} className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-[#141a4d]">{p.nomeCliente}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Pedido <span className="tabular-nums text-slate-600">{p.numeroPedido}</span>
                      {p.reentrega && (
                        <span className="ml-1 font-medium text-amber-600" title="Reentrega">
                          ↩
                        </span>
                      )}
                    </p>
                  </div>
                  <Pill tone={p.statusWinthor === "M" ? "gold" : "navy"}>{statusLabel(p.statusWinthor)}</Pill>
                </div>
                <div className="mt-2.5 flex items-end justify-between gap-3">
                  <div className="min-w-0 text-xs text-slate-500">
                    <p className="truncate">
                      {p.cidadeCliente ?? "—"}
                      {p.regiao ? ` · ${p.regiao}` : ""}
                    </p>
                    <p className="mt-0.5 truncate">RCA: {p.nomeRca}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular-nums font-semibold text-[#141a4d]">{formatBRL(p.valorPedido)}</p>
                    <p className="mt-0.5 text-xs tabular-nums text-slate-500">parado {tempoParado(p.horasParado)}</p>
                  </div>
                </div>
              </div>
            ))}
            {filtrados.length > LIMITE_LINHAS && (
              <p className="px-1 py-2 text-center text-xs text-slate-400">
                Mostrando {LIMITE_LINHAS} de {filtrados.length}. Use os filtros para refinar.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

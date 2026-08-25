"use client";

import { useState, useMemo, Fragment } from "react";
import { Card, PanelHeader } from "@/components/ui";
import { filtrarPorBusca, filtrarPorTipo, ordenarMotoristas, corTaxa, tipoMotoristaInfo } from "@/domain/devolucoes-ui";
import type { ColunaMotorista, Direcao, FiltroTipoMotorista } from "@/domain/devolucoes-ui";
import type { TipoMotorista, MotivoDetalhe } from "@/domain/devolucoes";
import { formatBRL, formatPercent } from "@/domain/format";
import { piorMotorista } from "@/domain/devolucoes";
import type { DevolucaoPorMotorista } from "@/domain/devolucoes";
import DetalheMotivos from "./detalhe-motivos";
import { IconeCaminhao, IconeUsuario, IconeBusca, IconeChevronCima, IconeChevronBaixo } from "./icons";

type Sort = { col: ColunaMotorista; dir: Direcao };

const FILTROS_TIPO: { v: FiltroTipoMotorista; label: string }[] = [
  { v: "", label: "Todos" },
  { v: "F", label: "Da casa" },
  { v: "T", label: "Terceirizado" },
];

/** Etiqueta de vínculo (só quando conhecido — motoristas sem tipo ficam sem selo). */
function SeloTipo({ tipo }: { tipo: TipoMotorista }) {
  if (!tipo) return null;
  const info = tipoMotoristaInfo(tipo);
  return (
    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${info.badge}`}>
      {info.label}
    </span>
  );
}

function Th({
  col, rotulo, sort, onSort,
}: {
  col: ColunaMotorista; rotulo: string; sort: Sort; onSort: (c: ColunaMotorista) => void;
}) {
  const ativo = sort.col === col;
  return (
    <th
      onClick={() => onSort(col)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSort(col);
        }
      }}
      tabIndex={0}
      aria-sort={ativo ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className="cursor-pointer select-none px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
    >
      <span className="inline-flex items-center gap-1">
        {rotulo}
        {ativo ? (
          sort.dir === "asc" ? (
            <IconeChevronCima className="h-3 w-3 text-amber-500" />
          ) : (
            <IconeChevronBaixo className="h-3 w-3 text-amber-500" />
          )
        ) : (
          <IconeChevronBaixo className="h-3 w-3 opacity-20" />
        )}
      </span>
    </th>
  );
}

export default function TabelaMotoristas({
  motoristas,
  motivos = {},
}: {
  motoristas: DevolucaoPorMotorista[];
  motivos?: Record<number, MotivoDetalhe[]>;
}) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<FiltroTipoMotorista>("");
  const [sort, setSort] = useState<Sort>({ col: "taxa", dir: "desc" });
  const [aberto, setAberto] = useState<number | null>(null); // codMotorista com drill-down aberto

  function onSort(col: ColunaMotorista) {
    setSort((p) => (p.col === col ? { col, dir: p.dir === "desc" ? "asc" : "desc" } : { col, dir: "desc" }));
  }
  const toggle = (cod: number) => setAberto((a) => (a === cod ? null : cod));
  const temMotivos = (cod: number) => (motivos[cod]?.length ?? 0) > 0;

  const filtrados = useMemo(
    () => filtrarPorTipo(
      filtrarPorBusca(motoristas, busca, (m) => [m.nome, m.codMotorista]),
      tipo,
    ),
    [motoristas, busca, tipo],
  );
  const lista = useMemo(() => ordenarMotoristas(filtrados, sort.col, sort.dir), [filtrados, sort]);
  const pior = useMemo(() => piorMotorista(filtrados), [filtrados]);

  const segTipo = (
    <div
      className="inline-flex items-center rounded-lg bg-slate-100 p-0.5"
      role="group"
      aria-label="Filtrar por vínculo do motorista"
    >
      {FILTROS_TIPO.map((ft) => (
        <button
          key={ft.v}
          type="button"
          onClick={() => setTipo(ft.v)}
          aria-pressed={tipo === ft.v}
          className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
            tipo === ft.v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          {ft.label}
        </button>
      ))}
    </div>
  );

  const campoBusca = (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
        <IconeBusca />
      </span>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar motorista…"
        aria-label="Buscar motorista"
        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50 sm:w-56"
      />
    </div>
  );

  const controles = (
    <div className="flex flex-wrap items-center gap-2">
      {segTipo}
      {campoBusca}
    </div>
  );

  // Mensagem do estado vazio, sensível a qual filtro esvaziou a lista.
  const msgVazio = busca
    ? `Nenhum motorista para "${busca}".`
    : tipo === "F"
      ? "Nenhum motorista da casa no período."
      : tipo === "T"
        ? "Nenhum motorista terceirizado no período."
        : "Sem entregas em carga no período.";

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconeCaminhao />}
        title="Taxa de devolução por motorista"
        context={`${lista.length} motoristas · clique para ver os motivos`}
        right={controles}
      />
      {pior && (
        <p className="border-b border-slate-100 px-5 py-3 text-sm text-slate-500">
          Maior taxa (com 50+ entregas):{" "}
          <span className="font-semibold text-rose-600">{pior.nome}</span> —{" "}
          {formatPercent(pior.taxa / 100)} ({pior.devolvidas} de {pior.expedidas}).
        </p>
      )}
      {/* Mobile: ordenação (as colunas clicáveis não existem no card) */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 md:hidden">
        <label className="text-xs font-medium text-slate-400">Ordenar por</label>
        <select
          value={sort.col}
          onChange={(e) => setSort({ col: e.target.value as ColunaMotorista, dir: "desc" })}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
        >
          <option value="taxa">Taxa de devolução</option>
          <option value="valorDevolvido">Valor devolvido</option>
          <option value="expedidas">Entregas</option>
          <option value="devolvidas">Devolvidas</option>
        </select>
      </div>

      {/* Desktop: tabela */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="w-10 px-3 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">#</th>
              <th className="min-w-[180px] px-3 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">Motorista</th>
              <Th col="expedidas" rotulo="Entregas" sort={sort} onSort={onSort} />
              <Th col="devolvidas" rotulo="Devolvidas" sort={sort} onSort={onSort} />
              <Th col="taxa" rotulo="Taxa" sort={sort} onSort={onSort} />
              <Th col="valorDevolvido" rotulo="Valor devolvido" sort={sort} onSort={onSort} />
              <th className="w-10 px-3 py-3" aria-label="Motivos" />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-sm text-slate-400">
                  {msgVazio}
                </td>
              </tr>
            ) : (
              lista.map((m, i) => {
                const expansivel = temMotivos(m.codMotorista);
                const estaAberto = aberto === m.codMotorista;
                return (
                  <Fragment key={m.codMotorista}>
                    <tr
                      onClick={expansivel ? () => toggle(m.codMotorista) : undefined}
                      aria-expanded={expansivel ? estaAberto : undefined}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 ${estaAberto ? "bg-amber-50/40" : ""} ${expansivel ? "cursor-pointer" : ""}`}
                    >
                      <td className="px-3 py-3 text-center font-mono text-xs text-slate-400">{i + 1}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="shrink-0 rounded-lg bg-[#eef0fb] p-1.5 text-[#1b2168]">
                            <IconeUsuario />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium leading-none text-[#141a4d]">{m.nome}</p>
                              <SeloTipo tipo={m.tipo} />
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-400">Cód. {m.codMotorista}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-slate-500">{m.expedidas}</td>
                      <td className="px-3 py-3 text-right font-medium tabular-nums text-slate-600">{m.devolvidas}</td>
                      <td className={`px-3 py-3 text-right text-base font-bold tabular-nums ${corTaxa(m.taxa)}`}>
                        {formatPercent(m.taxa / 100)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#141a4d]">{formatBRL(m.valorDevolvido)}</td>
                      <td className="px-3 py-3 text-center text-slate-400">
                        {expansivel ? (
                          estaAberto ? <IconeChevronCima className="mx-auto h-4 w-4" /> : <IconeChevronBaixo className="mx-auto h-4 w-4" />
                        ) : (
                          <span className="text-slate-200">—</span>
                        )}
                      </td>
                    </tr>
                    {estaAberto && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={7} className="p-0">
                          <DetalheMotivos motivos={motivos[m.codMotorista] ?? []} />
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
            {msgVazio}
          </li>
        ) : (
          lista.map((m, i) => {
            const expansivel = temMotivos(m.codMotorista);
            const estaAberto = aberto === m.codMotorista;
            return (
              <li key={m.codMotorista} className={estaAberto ? "bg-amber-50/40" : ""}>
                <div
                  onClick={expansivel ? () => toggle(m.codMotorista) : undefined}
                  className={`px-4 py-3 ${expansivel ? "cursor-pointer" : ""}`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 shrink-0 text-center font-mono text-xs text-slate-400">{i + 1}</span>
                    <div className="shrink-0 rounded-lg bg-[#eef0fb] p-1.5 text-[#1b2168]">
                      <IconeUsuario />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium leading-tight text-[#141a4d]">{m.nome}</p>
                        <SeloTipo tipo={m.tipo} />
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">Cód. {m.codMotorista}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-lg font-bold leading-none tabular-nums ${corTaxa(m.taxa)}`}>
                        {formatPercent(m.taxa / 100)}
                      </p>
                      <p className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-400">taxa</p>
                    </div>
                    {expansivel && (
                      estaAberto
                        ? <IconeChevronCima className="h-4 w-4 shrink-0 text-slate-400" />
                        : <IconeChevronBaixo className="h-4 w-4 shrink-0 text-slate-400" />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-4 pl-[3.25rem] text-xs text-slate-500">
                    <span>
                      Entregas <b className="tabular-nums text-slate-700">{m.expedidas}</b>
                    </span>
                    <span>
                      Devolvidas <b className="tabular-nums text-slate-700">{m.devolvidas}</b>
                    </span>
                    <span className="ml-auto tabular-nums font-semibold text-[#141a4d]">
                      {formatBRL(m.valorDevolvido)}
                    </span>
                  </div>
                </div>
                {estaAberto && <DetalheMotivos motivos={motivos[m.codMotorista] ?? []} />}
              </li>
            );
          })
        )}
      </ul>
    </Card>
  );
}

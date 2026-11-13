"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/domain/format";

/** Uma linha por produto cortado no período (auditoria, no padrão do app Flask). */
export interface LinhaAuditoria {
  codprod: number;
  produto: string; // "cód - descrição"
  href: string; // filtra a tela pelo produto
  cargas: number;
  comprador: string;
  cliente: string; // nome, ou "N clientes"
  fornecedor: string;
  qt: number;
  pedidos: number;
  valor: number;
  ultimoDia: string; // yyyy-mm-dd
  conferente: string | null;
  motivo: string;
  estoqueHoje: number | null; // null = ainda carregando / indisponível
  estoqueNaData: number | null;
}

const inteiro = new Intl.NumberFormat("pt-BR");
const dataBR = (iso: string) => iso.split("-").reverse().join("/");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Colunas com caixa de filtro, como no Flask (carregamento, comprador, cliente, fornecedor, produto).
const FILTRAVEIS = [
  { id: "cargas", rotulo: "Carreg.", texto: (l: LinhaAuditoria) => `${l.cargas} carga(s)` },
  { id: "comprador", rotulo: "Comprador", texto: (l: LinhaAuditoria) => l.comprador },
  { id: "cliente", rotulo: "Cliente", texto: (l: LinhaAuditoria) => l.cliente },
  { id: "fornecedor", rotulo: "Fornecedor", texto: (l: LinhaAuditoria) => l.fornecedor },
  { id: "produto", rotulo: "Produto", texto: (l: LinhaAuditoria) => l.produto },
] as const;

type IdFiltro = (typeof FILTRAVEIS)[number]["id"];

export default function TabelaAuditoria({ linhas, carregandoEstoque = false, semEstoque = false }: {
  linhas: LinhaAuditoria[];
  carregandoEstoque?: boolean;
  semEstoque?: boolean;
}) {
  const [filtro, setFiltro] = useState<Partial<Record<IdFiltro, string>>>({});
  const [busca, setBusca] = useState(""); // mobile: uma caixa só

  const visiveis = useMemo(() => {
    const ativos = FILTRAVEIS.filter((c) => filtro[c.id]?.trim());
    const b = norm(busca.trim());
    return linhas.filter(
      (l) =>
        ativos.every((c) => norm(c.texto(l)).includes(norm(filtro[c.id]!.trim()))) &&
        (!b || FILTRAVEIS.some((c) => norm(c.texto(l)).includes(b))),
    );
  }, [linhas, filtro, busca]);

  const est = (v: number | null) =>
    v !== null ? inteiro.format(v) : <span className="text-slate-300" title={carregandoEstoque ? "Carregando estoque…" : semEstoque ? "Estoque indisponível agora" : undefined}>{carregandoEstoque ? "…" : "—"}</span>;
  const th = "bg-[#F4F7FA] px-4 py-3 font-semibold text-slate-700 border-b border-slate-200";
  const td = "px-4 py-2.5 border-b border-slate-100";
  const total = visiveis.reduce((s, l) => s + l.valor, 0);

  return (
    <>
      {/* Desktop: tabela com filtro por coluna */}
      <div className="hidden w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full whitespace-nowrap text-left text-sm text-slate-600">
          <thead>
            <tr>
              {FILTRAVEIS.map((c) => <th key={c.id} className={th}>{c.rotulo}</th>)}
              <th className={`${th} text-right`}>Qtd cortada</th>
              <th className={`${th} text-right`}>Ped. cortados</th>
              <th className={`${th} text-right`}>Valor perdido</th>
              <th className={th} title="Último dia em que o produto foi cortado no período">Data corte</th>
              <th className={th}>Conferente</th>
              <th className={th}>Motivo do corte</th>
              <th className={`${th} text-right`} title="Estoque gerencial de hoje (PCEST.QTESTGER) na filial do corte">Estoque atual</th>
              <th className={`${th} text-right`} title="Estoque de hoje com as entradas e saídas depois do último corte desfeitas">Estoque na data</th>
            </tr>
            <tr>
              {FILTRAVEIS.map((c) => (
                <th key={c.id} className="border-b border-slate-200 bg-[#F4F7FA] px-2 pb-2">
                  <input
                    value={filtro[c.id] ?? ""}
                    onChange={(e) => setFiltro((f) => ({ ...f, [c.id]: e.target.value }))}
                    placeholder="..."
                    aria-label={`Filtrar ${c.rotulo.toLowerCase()}`}
                    className="w-full min-w-[80px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-normal text-slate-800 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
                  />
                </th>
              ))}
              <th colSpan={8} className="border-b border-slate-200 bg-[#F4F7FA] px-4 pb-2 text-right text-xs font-medium text-slate-400">
                {visiveis.length !== linhas.length && `${inteiro.format(visiveis.length)} de ${inteiro.format(linhas.length)} produtos · ${formatBRL(total)}`}
              </th>
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr><td colSpan={13} className="py-10 text-center text-sm text-slate-400">Nenhum produto com esses filtros.</td></tr>
            ) : (
              visiveis.map((l) => (
                <tr key={l.codprod} className="transition-colors hover:bg-slate-50">
                  <td className={`${td} tabular-nums`}>{l.cargas} carga(s)</td>
                  <td className={`${td} max-w-[12rem] truncate`} title={l.comprador}>{l.comprador}</td>
                  <td className={`${td} max-w-[14rem] truncate`} title={l.cliente}>{l.cliente}</td>
                  <td className={`${td} max-w-[14rem] truncate`} title={l.fornecedor}>{l.fornecedor}</td>
                  <td className={`${td} max-w-[18rem] truncate font-medium text-[#141a4d]`} title={l.produto}>
                    <Link href={l.href} scroll={false} className="hover:underline">{l.produto}</Link>
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{inteiro.format(l.qt)}</td>
                  <td className={`${td} text-right tabular-nums`}>{inteiro.format(l.pedidos)}</td>
                  <td className={`${td} text-right font-semibold tabular-nums text-[#141a4d]`}>{formatBRL(l.valor)}</td>
                  <td className={`${td} tabular-nums`}>{dataBR(l.ultimoDia)}</td>
                  <td className={`${td} max-w-[12rem] truncate`} title={l.conferente ?? undefined}>{l.conferente ?? <span className="text-slate-300">—</span>}</td>
                  <td className={`${td} max-w-[14rem] truncate`} title={l.motivo}>{l.motivo}</td>
                  <td className={`${td} text-right tabular-nums`}>{est(l.estoqueHoje)}</td>
                  <td className={`${td} text-right tabular-nums`}>{est(l.estoqueNaData)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile: busca única + cartões */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm md:hidden">
        <div className="border-b border-slate-100 p-3">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto, cliente, fornecedor…"
            aria-label="Buscar na auditoria"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50"
          />
        </div>
        <ul className="divide-y divide-slate-100">
          {visiveis.length === 0 ? (
            <li className="py-10 text-center text-sm text-slate-400">Nenhum produto com essa busca.</li>
          ) : (
            visiveis.map((l) => (
              <li key={l.codprod} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <Link href={l.href} scroll={false} className="min-w-0 truncate font-medium text-[#141a4d]">{l.produto}</Link>
                  <span className="shrink-0 font-semibold tabular-nums text-[#141a4d]">{formatBRL(l.valor)}</span>
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {inteiro.format(l.qt)} un · {l.pedidos} ped. · {l.cargas} carga(s) · {dataBR(l.ultimoDia).slice(0, 5)}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{l.fornecedor} · {l.cliente}</p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  {l.motivo}{l.conferente ? ` · ${l.conferente}` : ""} · estoque {est(l.estoqueHoje)} hoje, {est(l.estoqueNaData)} na data
                </p>
              </li>
            ))
          )}
        </ul>
      </div>
    </>
  );
}

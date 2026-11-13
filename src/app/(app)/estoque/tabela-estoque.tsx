"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatBRL } from "@/domain/format";
import type { LinhaTabelaEstoque, Situacao, TipoTabela } from "@/domain/estoque";

const inteiro = new Intl.NumberFormat("pt-BR");
const dataBR = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const COR_SITUACAO: Record<Situacao, string> = {
  ruptura: "bg-rose-50 text-rose-700 border-rose-200",
  iminente: "bg-amber-50 text-amber-700 border-amber-200",
  comprar: "bg-[#eef0fb] text-[#1b2168] border-[#d6dbf5]",
  ideal: "bg-slate-100 text-slate-600 border-slate-200",
  excesso: "bg-amber-100 text-amber-800 border-amber-300",
};

const LIMITE = 300; // linhas na tela; a planilha traz todas

/** Tabela de detalhe da aba Estoque (excesso, obsoletos ou ruptura), com situação e busca. */
export default function TabelaEstoque({ tipo, titulo, linhas, situacoes, hrefPlanilha, hrefFechar }: {
  tipo: TipoTabela;
  titulo: string;
  linhas: LinhaTabelaEstoque[];
  situacoes: { id: Situacao; rotulo: string }[];
  hrefPlanilha: string;
  hrefFechar: string;
}) {
  const [busca, setBusca] = useState("");
  const [sit, setSit] = useState<Situacao | "">("");
  const rotulo = (s: Situacao) => situacoes.find((x) => x.id === s)?.rotulo ?? s;

  const visiveis = useMemo(() => {
    const b = norm(busca.trim());
    return linhas.filter((l) => (!sit || l.situacao === sit) && (!b || norm(`${l.produto} ${l.fornecedor} ${l.comprador}`).includes(b)));
  }, [linhas, busca, sit]);

  const total = visiveis.reduce((s, l) => s + (tipo === "excesso" ? l.excessoValor : tipo === "ruptura" ? l.perda : l.estoque * l.custo), 0);
  const rotuloTotal = tipo === "excesso" ? "em excesso" : tipo === "ruptura" ? "de perda mensal" : "parados a custo";
  const th = "bg-[#F4F7FA] px-3 py-2.5 font-semibold text-slate-700 border-b border-slate-200";
  const td = "px-3 py-2 border-b border-slate-100";
  const campo = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50";

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#141a4d]">{titulo}</h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {inteiro.format(visiveis.length)} produtos · {formatBRL(total)} {rotuloTotal}
            {visiveis.length > LIMITE && ` · mostrando os ${LIMITE} primeiros (a planilha traz todos)`}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {tipo === "ruptura" && (
            <select value={sit} onChange={(e) => setSit(e.target.value as Situacao | "")} aria-label="Situação" className={campo}>
              <option value="">Todas as situações</option>
              {situacoes.map((s) => <option key={s.id} value={s.id}>{s.rotulo}</option>)}
            </select>
          )}
          <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto, fornecedor ou comprador" aria-label="Buscar" className={`${campo} min-w-0 flex-1 sm:w-72`} />
          <a href={hrefPlanilha} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50">Baixar planilha</a>
          <Link href={hrefFechar} scroll={false} aria-label="Fechar tabela" className="px-2 text-xl font-bold leading-none text-slate-400 hover:text-slate-600">&times;</Link>
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden max-h-[600px] w-full overflow-auto rounded-xl border border-slate-200 md:block">
        <table className="w-full whitespace-nowrap text-left text-sm text-slate-600">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className={th}>Produto</th>
              {tipo === "ruptura" && <th className={th}>Situação</th>}
              <th className={th}>Fornecedor</th>
              <th className={th}>Comprador</th>
              <th className={`${th} text-right`}>Estoque</th>
              {tipo === "excesso" ? (
                <>
                  <th className={`${th} text-right`}>Ideal (60d)</th>
                  <th className={`${th} text-right`}>Excesso</th>
                  <th className={`${th} text-right`}>Valor excesso</th>
                </>
              ) : (
                <>
                  <th className={`${th} text-right`}>Disponível</th>
                  <th className={`${th} text-right`}>Avaria</th>
                  <th className={th}>Última saída</th>
                  <th className={th}>Última entrada</th>
                  <th className={`${th} text-right`}>Custo</th>
                  <th className={`${th} text-right`} title="Preço médio praticado nos últimos 90 dias">Preço venda</th>
                  {tipo === "ruptura" ? (
                    <>
                      <th className={`${th} text-right`} title="Dias que o estoque dura no giro dos 3 últimos meses">Dias de estoque</th>
                      <th className={`${th} text-right`}>Perda mensal</th>
                    </>
                  ) : (
                    <th className={`${th} text-right`}>Dias sem venda</th>
                  )}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr><td colSpan={12} className="py-10 text-center text-sm text-slate-400">Nenhum produto com esse filtro.</td></tr>
            ) : (
              visiveis.slice(0, LIMITE).map((l) => (
                <tr key={l.codprod} className="hover:bg-slate-50">
                  <td className={`${td} max-w-[18rem] truncate font-medium text-[#141a4d]`} title={l.produto}>{l.produto}</td>
                  {tipo === "ruptura" && (
                    <td className={td}><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${COR_SITUACAO[l.situacao]}`}>{rotulo(l.situacao)}</span></td>
                  )}
                  <td className={`${td} max-w-[14rem] truncate`} title={l.fornecedor}>{l.fornecedor}</td>
                  <td className={`${td} max-w-[10rem] truncate`}>{l.comprador}</td>
                  <td className={`${td} text-right tabular-nums`}>{inteiro.format(l.estoque)}</td>
                  {tipo === "excesso" ? (
                    <>
                      <td className={`${td} text-right tabular-nums`}>{inteiro.format(l.ideal)}</td>
                      <td className={`${td} text-right tabular-nums`}>{inteiro.format(l.excessoQt)}</td>
                      <td className={`${td} text-right font-semibold tabular-nums text-[#141a4d]`}>{formatBRL(l.excessoValor)}</td>
                    </>
                  ) : (
                    <>
                      <td className={`${td} text-right tabular-nums`}>{inteiro.format(l.disponivel)}</td>
                      <td className={`${td} text-right tabular-nums`}>{inteiro.format(l.avaria)}</td>
                      <td className={`${td} tabular-nums`}>{dataBR(l.ultimaSaida)}</td>
                      <td className={`${td} tabular-nums`}>{dataBR(l.ultimaEntrada)}</td>
                      <td className={`${td} text-right tabular-nums`}>{formatBRL(l.custo)}</td>
                      <td className={`${td} text-right tabular-nums`}>{l.preco === null ? "—" : formatBRL(l.preco)}</td>
                      {tipo === "ruptura" ? (
                        <>
                          <td className={`${td} text-right tabular-nums`}>{l.cobertura === null ? "—" : inteiro.format(l.cobertura)}</td>
                          <td className={`${td} text-right font-semibold tabular-nums text-[#141a4d]`}>{l.perda > 0 ? formatBRL(l.perda) : "—"}</td>
                        </>
                      ) : (
                        <td className={`${td} text-right tabular-nums`}>{l.diasSemVenda === null ? "nunca vendeu" : inteiro.format(l.diasSemVenda)}</td>
                      )}
                    </>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 md:hidden">
        {visiveis.length === 0 ? (
          <li className="py-10 text-center text-sm text-slate-400">Nenhum produto com esse filtro.</li>
        ) : (
          visiveis.slice(0, LIMITE).map((l) => (
            <li key={l.codprod} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate text-sm font-medium text-[#141a4d]">{l.produto}</p>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[#141a4d]">
                  {tipo === "excesso" ? formatBRL(l.excessoValor) : tipo === "ruptura" ? (l.perda > 0 ? formatBRL(l.perda) : rotulo(l.situacao)) : `${l.diasSemVenda ?? "—"} d`}
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                estoque {inteiro.format(l.estoque)}{tipo === "excesso" ? ` · ideal ${inteiro.format(l.ideal)}` : ` · última saída ${dataBR(l.ultimaSaida)}`} · {l.comprador}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-400">{l.fornecedor}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

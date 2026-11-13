"use client";

import { useState, useMemo, useCallback, useEffect, useRef, Fragment } from "react";
import { createPortal } from "react-dom";
import { Card, PanelHeader } from "@/components/ui";
import { filtrarPorBusca } from "@/domain/devolucoes-ui";
import { formatBRL, formatKg } from "@/domain/format";
import { estadoPedidoInfo } from "@/domain/pedidos-consulta";
import type { PedidoConsulta, ItemPedido } from "@/domain/pedidos-consulta";
import { formatarFoneBR, linkWhatsApp } from "@/domain/whatsapp";
import { carregarItensPedido } from "./actions";

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

// Versão curta p/ as células da tabela (dd/mm/aa) — economiza largura.
function fmtDataCurta(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return d && m && y ? `${d}/${m}/${y.slice(2)}` : iso;
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

// DANFE e boletos no layout impresso pelo Winthor, num modal com "Imprimir /
// Salvar PDF". Cada documento é uma página própria (/pedidos/:numped/danfe e
// /pedidos/:numped/boletos) carregada num iframe: o botão imprime só o iframe,
// então sai só o documento, em A4. Dá para trocar de um para o outro sem fechar.
type Documento = "danfe" | "boletos";

const DOCUMENTO: Record<Documento, { titulo: (nf: number) => string; carregando: string }> = {
  danfe: { titulo: (nf) => `DANFE · NF-e Nº ${nf}`, carregando: "Obtendo XML autorizado e montando o DANFE…" },
  boletos: { titulo: (nf) => `Boletos · NF ${nf}`, carregando: "Buscando as parcelas no Winthor e montando os boletos…" },
};

const IconeBoleto = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round">
    <path d="M4 6v12M7 6v12M10 6v12M14 6v12M16 6v12M20 6v12" />
  </svg>
);
const IconeNota = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);

function ModalDocumento({ documento, numped, notaFiscal, onTrocar, onFechar }: {
  documento: Documento; numped: number; notaFiscal: number; onTrocar: (d: Documento) => void; onFechar: () => void;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [carregado, setCarregado] = useState<Documento | null>(null);
  const pronto = carregado === documento;
  const outro: Documento = documento === "danfe" ? "boletos" : "danfe";

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = overflow; };
  }, [onFechar]);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:p-4"
      // React propaga eventos do portal até a linha da tabela: barra aqui pra não abrir/fechar o pedido.
      onClick={(e) => { e.stopPropagation(); onFechar(); }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        className="flex h-full w-full max-w-[860px] flex-col bg-slate-100 shadow-2xl sm:h-auto sm:max-h-[95vh] sm:rounded-2xl sm:border sm:border-slate-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
          <h3 className="text-sm font-black text-slate-800 sm:text-base">{DOCUMENTO[documento].titulo(notaFiscal)}</h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pronto}
              onClick={() => frame.current?.contentWindow?.print()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#141a4d] px-3.5 py-1.5 text-xs font-bold text-white shadow transition hover:bg-[#1b2168] disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2" /><path d="M6 14h12v7H6z" />
              </svg>
              Imprimir / Salvar PDF
            </button>
            <button
              type="button"
              onClick={() => onTrocar(outro)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold shadow transition ${
                outro === "boletos" ? "bg-amber-500 text-white hover:bg-amber-600" : "border border-slate-300 bg-white text-[#141a4d] hover:bg-slate-50"
              }`}
            >
              {outro === "boletos" ? <><IconeBoleto /> Boletos</> : <><IconeNota /> DANFE</>}
            </button>
            <button type="button" onClick={onFechar} aria-label="Fechar" className="px-1 text-2xl font-bold leading-none text-slate-400 hover:text-slate-600">
              &times;
            </button>
          </div>
        </div>
        <div className="relative min-h-0 flex-1 sm:h-[80vh] sm:flex-none">
          {!pronto && (
            <p className="absolute inset-x-0 top-16 text-center text-sm text-slate-400">{DOCUMENTO[documento].carregando}</p>
          )}
          <iframe
            key={documento}
            ref={frame}
            src={`/pedidos/${numped}/${documento}`}
            title={DOCUMENTO[documento].titulo(notaFiscal)}
            onLoad={() => setCarregado(documento)}
            className={`h-full w-full border-0 ${pronto ? "" : "opacity-0"}`}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

function fmtDataHora(v: string | null): string {
  if (!v) return "—";
  const [data, hora] = v.split(" ");
  return hora ? `${fmtData(data)} às ${hora.slice(0, 5)}` : fmtData(data);
}

// Intervalo emissão → liberação ("50 min", "2h 05min", "3 dias").
function intervalo(de: string | null, ate: string | null): string | null {
  if (!de || !ate) return null;
  const a = new Date(de.replace(" ", "T"));
  // A emissão só tem minuto: corta os segundos da liberação p/ bater com o exibido.
  const b = new Date(ate.slice(0, 16).replace(" ", "T"));
  const min = Math.round((b.getTime() - a.getTime()) / 60000);
  if (!Number.isFinite(min) || min < 0) return null;
  if (min < 60) return `${min} min`;
  if (min < 24 * 60) return `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}min`;
  const dias = Math.floor(min / (24 * 60));
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
}

function Campo({ rotulo, valor, sub }: { rotulo: string; valor: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{rotulo}</p>
      <p className="mt-0.5 font-semibold text-[#141a4d]">{valor}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

// Detalhes do pedido (duplo clique na linha): quem emitiu e quem liberou, com hora.
function ModalCabecalho({ pedido, onFechar }: { pedido: PedidoConsulta; onFechar: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onFechar(); };
    window.addEventListener("keydown", esc);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.body.style.overflow = overflow; };
  }, [onFechar]);

  const espera = intervalo(pedido.emissao, pedido.liberadoEm);
  const emitente = pedido.emitidoPelaForcaDeVendas
    ? `Força de Vendas${pedido.rca ? ` · ${pedido.rca}` : ""}`
    : pedido.emitente ?? "—";

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
      onClick={(e) => { e.stopPropagation(); onFechar(); }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div
        role="dialog"
        aria-label={`Detalhes do pedido ${pedido.numped}`}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-black tabular-nums text-[#141a4d]">Pedido {pedido.numped}</h3>
            <Selo posicao={pedido.posicao} />
          </div>
          <button type="button" onClick={onFechar} aria-label="Fechar" className="px-1 text-2xl font-bold leading-none text-slate-400 hover:text-slate-600">
            &times;
          </button>
        </div>
        <div className="space-y-4 px-5 py-4 text-sm">
          <p className="truncate text-slate-500" title={pedido.cliente}>{pedido.cliente} <span className="text-xs text-slate-400">· Cód. {pedido.codcli}</span></p>
          <div className="grid grid-cols-2 gap-4">
            <Campo rotulo="Emitente" valor={emitente} />
            <Campo rotulo="Emitido em" valor={fmtDataHora(pedido.emissao)} />
            <Campo
              rotulo="Liberado por"
              valor={pedido.liberadoPor ?? <span className="font-normal text-slate-400">{pedido.liberadoEm ? "—" : "Sem liberação manual"}</span>}
            />
            <Campo
              rotulo="Liberado em"
              valor={pedido.liberadoEm ? fmtDataHora(pedido.liberadoEm) : <span className="font-normal text-slate-400">—</span>}
              sub={espera ? `${espera} após a emissão` : undefined}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Detalhe({ pedido, itens, carregando, onCabecalho }: {
  pedido: PedidoConsulta; itens: ItemPedido[] | undefined; carregando: boolean; onCabecalho: () => void;
}) {
  const [documento, setDocumento] = useState<Documento | null>(null);
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
            {pedido.horaPedido && <> às <b className="text-[#141a4d]">{pedido.horaPedido}</b></>}
            {" · "}DT Faturada: <b className="text-[#141a4d]">{fmtData(pedido.dataFaturamento)}</b>
            {pedido.notaFiscal != null && <> {" · "}NF <b className="text-[#141a4d]">{pedido.notaFiscal}</b></>}
          </p>
          <p className="text-slate-600">
            Devolução:{" "}
            <b className={pedido.temDevolucao ? "text-rose-600" : "text-slate-500"}>
              {pedido.temDevolucao ? "Sim" : "Não"}
            </b>
            {" · "}Motorista: <b className="text-[#141a4d]">{pedido.motorista ?? "—"}</b>
            {" · "}Carga: <b className="text-[#141a4d]">{pedido.numcar ?? "—"}</b>
          </p>
          {pedido.temDevolucao && (
            <p className="text-slate-600">
              Motivo:{" "}
              <b className="text-rose-600">{pedido.motivoDevolucao ?? "Não informado"}</b>
            </p>
          )}
          {pedido.temDevolucao && (
            <p className="text-slate-600">
              NF de origem: <b className="text-[#141a4d]">{pedido.nfOrigemDevolucao ?? "—"}</b>
              {" · "}NF de devolução: <b className="text-[#141a4d]">{pedido.nfDevolucao ?? "—"}</b>
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCabecalho(); }}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-[#141a4d] transition hover:bg-slate-50"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" />
          </svg>
          Emitente e liberação
        </button>
      {pedido.notaFiscal != null && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setDocumento("danfe"); }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#181d55] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#10143f]"
          >
            <IconeNota />
            Ver DANFE
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setDocumento("boletos"); }}
            title={`Boletos da NF ${pedido.notaFiscal}, prontos para imprimir ou salvar em PDF`}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-600"
          >
            <IconeBoleto />
            Boletos
          </button>
          {documento && (
            <ModalDocumento
              documento={documento}
              numped={pedido.numped}
              notaFiscal={pedido.notaFiscal}
              onTrocar={setDocumento}
              onFechar={() => setDocumento(null)}
            />
          )}
        </>
      )}
      </div>

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

const IconeWhats = ({ className = "h-3.5 w-3.5" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.6-1.3.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
  </svg>
);

// Conversa com o RCA no WhatsApp, já com o pedido na mensagem. Não abre/fecha a linha.
function BotaoWhats({ pedido, compacto = false }: { pedido: PedidoConsulta; compacto?: boolean }) {
  if (!pedido.foneRca) return null;
  // Sem o nome do RCA: o cadastro traz prefixos ("D ", "X WINE ", "OF ATACADIA ").
  const msg = `Olá! Sobre o pedido ${pedido.numped} (${pedido.cliente}).`;
  return (
    <a
      href={linkWhatsApp(pedido.foneRca, msg)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      title={`Abrir conversa no WhatsApp com ${pedido.rca ?? "o RCA"} · ${formatarFoneBR(pedido.foneRca)}`}
      className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#141a4d] transition hover:border-[#141a4d]/40 hover:bg-[#eef0fb]"
    >
      <IconeWhats />
      {!compacto && "WhatsApp"}
    </a>
  );
}

// Data e hora "YYYY-MM-DD HH:MI[:SS]" → "dd/mm/aa hh:mm".
function fmtDataHoraCurta(v: string | null): string {
  if (!v) return "—";
  const [d, h] = v.split(" ");
  return `${fmtDataCurta(d)}${h ? ` ${h.slice(0, 5)}` : ""}`;
}

// Checkbox de seleção. O clique não abre/fecha o detalhe da linha.
function Marcar({ checked, indeterminado = false, onChange, label }: {
  checked: boolean; indeterminado?: boolean; onChange: () => void; label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminado;
  }, [indeterminado]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      aria-label={label}
      className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-[#181d55]"
    />
  );
}

export default function TabelaPedidos({ pedidos }: { pedidos: PedidoConsulta[] }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);
  const [itens, setItens] = useState<Record<number, ItemPedido[]>>({});
  const [carregando, setCarregando] = useState<number | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());

  const lista = useMemo(
    () => filtrarPorBusca(pedidos, busca, (p) => [
      p.numped, p.cliente, p.motorista ?? "", p.cidade ?? "", p.rca ?? "", p.notaFiscal ?? "", p.numcar ?? "",
      p.nfOrigemDevolucao ?? "", p.nfDevolucao ?? "", p.codRca ?? "", p.obsPedido ?? "", p.obsEntrega ?? "",
    ]),
    [pedidos, busca],
  );

  const totalValor = useMemo(() => lista.reduce((t, p) => t + p.valor, 0), [lista]);
  const comDev = useMemo(() => lista.filter((p) => p.temDevolucao).length, [lista]);

  // Autosoma dos selecionados (mesmo os que a busca esconde continuam somando).
  const soma = useMemo(() => {
    let valor = 0, peso = 0, qtd = 0;
    for (const p of pedidos) {
      if (!selecionados.has(p.numped)) continue;
      valor += p.valor; peso += p.peso; qtd += 1;
    }
    return { valor, peso, qtd };
  }, [pedidos, selecionados]);

  const visiveisMarcados = lista.filter((p) => selecionados.has(p.numped)).length;
  const todosVisiveis = lista.length > 0 && visiveisMarcados === lista.length;

  const alternar = useCallback((numped: number) => {
    setSelecionados((s) => {
      const n = new Set(s);
      if (n.has(numped)) n.delete(numped); else n.add(numped);
      return n;
    });
  }, []);

  const alternarTodos = () => {
    setSelecionados((s) => {
      const n = new Set(s);
      if (todosVisiveis) lista.forEach((p) => n.delete(p.numped));
      else lista.forEach((p) => n.add(p.numped));
      return n;
    });
  };

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

  // Clique simples abre/fecha o detalhe; duplo clique abre a janela de detalhes
  // do pedido. O clique simples espera um instante p/ não disparar junto com o duplo.
  const [cabecalho, setCabecalho] = useState<PedidoConsulta | null>(null);
  const timerClique = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerClique.current) clearTimeout(timerClique.current); }, []);
  const clique = (numped: number) => {
    if (timerClique.current) clearTimeout(timerClique.current);
    timerClique.current = setTimeout(() => { timerClique.current = null; abrir(numped); }, 220);
  };
  const duploClique = (p: PedidoConsulta) => {
    if (timerClique.current) { clearTimeout(timerClique.current); timerClique.current = null; }
    window.getSelection()?.removeAllRanges(); // duplo clique seleciona texto da linha
    setCabecalho(p);
  };
  const fecharCabecalho = useCallback(() => setCabecalho(null), []);
  // DANFE / boletos abertos direto da linha (coluna DANFE, como no Flask).
  const [doc, setDoc] = useState<{ pedido: PedidoConsulta; tipo: Documento } | null>(null);
  const abrirDoc = (e: React.MouseEvent, pedido: PedidoConsulta, tipo: Documento) => { e.stopPropagation(); setDoc({ pedido, tipo }); };

  const campoBusca = (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><IconeBusca /></span>
      <input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar pedido, cliente, motorista, carga…"
        aria-label="Buscar pedido"
        className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/50 sm:w-72"
      />
    </div>
  );

  const th = "px-3 py-3 font-semibold";
  const td = "px-3 py-2.5";

  return (
    <Card className="overflow-hidden">
      <PanelHeader
        icon={<IconeCarrinho />}
        title="Pedidos"
        context={`${lista.length} pedidos · ${formatBRL(totalValor)}${comDev ? ` · ${comDev} com devolução` : ""}`}
        right={campoBusca}
      />

      {/* Desktop: tabela no layout do app Flask (rola para o lado em telas menores). */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full whitespace-nowrap text-sm">
          <thead className="border-b border-slate-200 bg-[#F4F7FA] text-[11px] uppercase tracking-wider text-slate-600">
            <tr>
              <th className="w-8 py-3 pl-4 pr-1 text-left">
                <Marcar
                  checked={todosVisiveis}
                  indeterminado={visiveisMarcados > 0 && !todosVisiveis}
                  onChange={alternarTodos}
                  label="Selecionar todos os pedidos"
                />
              </th>
              <th className={`${th} text-left`}>Pedido</th>
              <th className={`${th} text-left`}>Data</th>
              <th className={`${th} text-center`}>Dias</th>
              <th className={`${th} text-left`}>Liberação</th>
              <th className={`${th} text-left`}>Cliente</th>
              <th className={`${th} text-center`}>Cód. RCA</th>
              <th className={`${th} text-left`}>RCA</th>
              <th className={`${th} text-left`}>Telefone RCA</th>
              <th className={`${th} text-left`}>Posição</th>
              <th className={`${th} text-left`}>Carga</th>
              <th className={`${th} text-left`}>Motorista</th>
              <th className={`${th} text-right`}>Valor total</th>
              <th className={`${th} text-right`}>Peso</th>
              <th className={`${th} text-center`}>DANFE</th>
              <th className={`${th} text-center`}>Devolução</th>
              <th className={`${th} text-left`}>Observação</th>
              <th className="w-8 py-3 pr-3" aria-label="Detalhes" />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 ? (
              <tr>
                <td colSpan={18} className="py-12 text-center text-sm text-slate-400">
                  {busca ? `Nenhum pedido para "${busca}".` : "Nenhum pedido para os filtros selecionados."}
                </td>
              </tr>
            ) : (
              lista.map((p) => {
                const estaAberto = aberto === p.numped;
                const marcado = selecionados.has(p.numped);
                const obs = [
                  ...(p.obsPedido ? [{ r: "Pedido", t: p.obsPedido }] : []),
                  ...(p.obsEntrega ? [{ r: "Entrega", t: p.obsEntrega }] : []),
                ];
                return (
                  <Fragment key={p.numped}>
                    <tr
                      onClick={() => clique(p.numped)}
                      onDoubleClick={() => duploClique(p)}
                      title="Clique: itens e endereço · duplo clique: emitente e liberação"
                      aria-expanded={estaAberto}
                      className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50/70 ${marcado ? "bg-indigo-50/50" : estaAberto ? "bg-amber-50/40" : ""}`}
                    >
                      <td className="py-2.5 pl-4 pr-1">
                        <Marcar checked={marcado} onChange={() => alternar(p.numped)} label={`Selecionar pedido ${p.numped}`} />
                      </td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-1 font-bold tabular-nums text-[#2a327f]">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-3.5 w-3.5" strokeLinejoin="round"><path d="M3 8 12 3l9 5v8l-9 5-9-5Z" /><path d="m3 8 9 5 9-5M12 13v8" /></svg>
                          {p.numped}
                        </span>
                      </td>
                      <td className={`${td} text-xs tabular-nums text-slate-600`}>
                        {fmtDataCurta(p.data)}
                        {p.horaPedido && <span className="ml-1 text-slate-400" title="Hora da digitação">{p.horaPedido}</span>}
                      </td>
                      <td className={`${td} text-center text-xs tabular-nums ${corDias(p)}`}>{p.diasNoSistema}d</td>
                      <td className={`${td} text-xs tabular-nums text-slate-600`} title={p.liberadoPor ? `Liberado por ${p.liberadoPor}` : undefined}>{fmtDataHoraCurta(p.liberadoEm)}</td>
                      <td className={td}>
                        <div className="max-w-[220px] truncate text-xs font-semibold text-slate-800" title={`${p.cliente} · Cód. ${p.codcli}`}>{p.cliente}</div>
                        <div className="text-[10px] text-slate-400">{p.cidade ?? "—"}{p.uf ? ` / ${p.uf}` : ""}</div>
                      </td>
                      <td className={`${td} text-center text-xs tabular-nums text-slate-700`}>{p.codRca ?? "—"}</td>
                      <td className={`${td} text-xs text-slate-700`}>
                        <div className="max-w-[150px] truncate" title={p.rca ?? undefined}>{p.rca ?? "—"}</div>
                      </td>
                      <td className={`${td} text-xs tabular-nums text-slate-700`}>
                        {p.foneRca ? (
                          <div className="flex items-center gap-1.5">
                            <span>{formatarFoneBR(p.foneRca)}</span>
                            <BotaoWhats pedido={p} compacto />
                          </div>
                        ) : "—"}
                      </td>
                      <td className={td}><Selo posicao={p.posicao} /></td>
                      <td className={`${td} text-xs tabular-nums text-slate-600`}>{p.numcar ? `#${p.numcar}` : "—"}</td>
                      <td className={`${td} text-xs text-slate-600`}>
                        <div className="max-w-[150px] truncate" title={p.motorista ?? undefined}>{p.motorista ?? "—"}</div>
                      </td>
                      <td className={`${td} text-right font-bold tabular-nums text-slate-800`}>{formatBRL(p.valor)}</td>
                      <td className={`${td} text-right text-xs tabular-nums text-slate-600`}>{formatKg(p.peso)}</td>
                      <td className={`${td} text-center`}>
                        {p.notaFiscal != null ? (
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={(e) => abrirDoc(e, p, "danfe")} onDoubleClick={(e) => e.stopPropagation()} title={`Ver o DANFE da NF ${p.notaFiscal}`}
                              className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 transition hover:bg-amber-200">
                              <IconeNota /> NF {p.notaFiscal}
                            </button>
                            <button type="button" onClick={(e) => abrirDoc(e, p, "boletos")} onDoubleClick={(e) => e.stopPropagation()} title={`Boletos da NF ${p.notaFiscal}`}
                              className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200">
                              <IconeBoleto /> Boletos
                            </button>
                          </div>
                        ) : <span className="text-xs text-slate-400">Sem NF</span>}
                      </td>
                      <td className={`${td} text-center`}>
                        {p.temDevolucao ? (
                          <span className="inline-block max-w-[180px] truncate rounded bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700"
                            title={`${p.motivoDevolucao ?? "Devolução"}${p.nfOrigemDevolucao ? ` · NF de origem ${p.nfOrigemDevolucao}` : ""}${p.nfDevolucao ? ` · NF de devolução ${p.nfDevolucao}` : ""}`}>
                            SIM ({p.motivoDevolucao ?? "Devolução"})
                          </span>
                        ) : <span className="text-xs text-slate-300">Não</span>}
                      </td>
                      <td className={`${td} text-xs`}>
                        {obs.length ? (
                          <div className="max-w-[260px] space-y-0.5" title={obs.map((o) => `${o.r}: ${o.t}`).join("\n")}>
                            {obs.map((o) => (
                              <div key={o.r} className="truncate"><span className="font-semibold text-amber-700">{o.r}:</span> <span className="text-slate-700">{o.t}</span></div>
                            ))}
                          </div>
                        ) : <span className="text-slate-300">Sem obs.</span>}
                      </td>
                      <td className="py-2.5 pr-3 text-center text-slate-400">
                        {estaAberto ? <IconeCima className="mx-auto h-4 w-4" /> : <IconeBaixo className="mx-auto h-4 w-4" />}
                      </td>
                    </tr>
                    {estaAberto && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={18} className="whitespace-normal p-0">
                          <Detalhe pedido={p} itens={itens[p.numped]} carregando={carregando === p.numped} onCabecalho={() => setCabecalho(p)} />
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
            const marcado = selecionados.has(p.numped);
            return (
              <li key={p.numped} className={marcado ? "bg-indigo-50/50" : estaAberto ? "bg-amber-50/40" : ""}>
                <div onClick={() => clique(p.numped)} onDoubleClick={() => duploClique(p)} className="cursor-pointer px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Marcar checked={marcado} onChange={() => alternar(p.numped)} label={`Selecionar pedido ${p.numped}`} />
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
                    {p.numcar != null && <span>Carga: {p.numcar}</span>}
                    {p.motorista && <span>Mot.: {p.motorista}</span>}
                    <span>Ped.: {fmtData(p.data)}{p.horaPedido ? ` ${p.horaPedido}` : ""}</span>
                    <span>Fat.: {fmtData(p.dataFaturamento)}</span>
                    <span>{formatKg(p.peso)}</span>
                    {p.notaFiscal != null && <span>NF {p.notaFiscal}</span>}
                    {p.nfOrigemDevolucao && <span className="text-rose-600">NF origem {p.nfOrigemDevolucao}</span>}
                  </div>
                  {p.foneRca && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-slate-500">
                      <span className="tabular-nums">RCA {formatarFoneBR(p.foneRca)}</span>
                      <BotaoWhats pedido={p} />
                    </div>
                  )}
                  {(p.obsPedido || p.obsEntrega) && (
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {p.obsPedido && <><span className="font-semibold text-amber-700">Pedido:</span> {p.obsPedido} </>}
                      {p.obsEntrega && <><span className="font-semibold text-amber-700">Entrega:</span> {p.obsEntrega}</>}
                    </p>
                  )}
                </div>
                {estaAberto && <Detalhe pedido={p} itens={itens[p.numped]} carregando={carregando === p.numped} onCabecalho={() => setCabecalho(p)} />}
              </li>
            );
          })
        )}
      </ul>

      {cabecalho && <ModalCabecalho pedido={cabecalho} onFechar={fecharCabecalho} />}
      {doc && doc.pedido.notaFiscal != null && (
        <ModalDocumento
          documento={doc.tipo}
          numped={doc.pedido.numped}
          notaFiscal={doc.pedido.notaFiscal}
          onTrocar={(tipo) => setDoc((d) => (d ? { ...d, tipo } : d))}
          onFechar={() => setDoc(null)}
        />
      )}

      {/* Autosoma dos selecionados — barra flutuante no rodapé da tela. */}
      {soma.qtd > 0 && (
        <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-2xl bg-[#181d55] px-5 py-3 text-sm text-white shadow-2xl ring-1 ring-white/10">
            <span className="font-semibold">
              {soma.qtd} {soma.qtd === 1 ? "pedido selecionado" : "pedidos selecionados"}
            </span>
            <span className="text-white/70">Valor <b className="tabular-nums text-white">{formatBRL(soma.valor)}</b></span>
            <span className="text-white/70">Peso <b className="tabular-nums text-white">{formatKg(soma.peso)}</b></span>
            <button
              type="button"
              onClick={() => setSelecionados(new Set())}
              className="rounded-lg bg-white/10 px-3 py-1 text-xs font-semibold transition hover:bg-white/20"
            >
              Limpar
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

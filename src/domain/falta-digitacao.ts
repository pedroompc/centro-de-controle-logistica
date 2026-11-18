/**
 * Falta na digitação: item que o vendedor pediu e o Winthor tirou do pedido (ou
 * reduziu) por falta de estoque na hora da digitação (PCFALTA). Não é corte da
 * logística — a mercadoria nunca chegou a ser separada —, por isso fica num bloco
 * próprio da aba de Cortes, sem somar nos cortes. Valor = quantidade em falta ×
 * preço de venda do item no pedido.
 */

export interface LinhaFalta {
  dia: string; // "yyyy-mm-dd"
  numped: number;
  codprod: number;
  produto: string;
  codfornec: number | null;
  fornecedor: string | null;
  comprador: string | null;
  codcli: number | null;
  cliente: string | null;
  codusur: number | null;
  rca: string | null;
  qt: number;
  valor: number;
  temPedido: boolean; // pedido gravado no PCPEDC (todos os itens em falta: o pedido nem é gerado)
}

export interface GrupoFalta {
  chave: string;
  rotulo: string;
  valor: number;
  qt: number;
  itens: number;
  pedidos: number;
}

export interface ProdutoFalta {
  codprod: number;
  produto: string;
  comprador: string | null;
  fornecedor: string | null;
  qt: number;
  itens: number;
  pedidos: number;
  clientes: number;
  valor: number;
  ultimoDia: string;
}

export interface ResumoFaltas {
  valor: number;
  qt: number;
  itens: number;
  pedidos: number;
  skus: number;
  clientes: number;
  rcas: number;
  porProduto: GrupoFalta[];
  porComprador: GrupoFalta[];
  porFornecedor: GrupoFalta[];
  porRca: GrupoFalta[];
  porCliente: GrupoFalta[];
  produtos: ProdutoFalta[];
}

/** Filtros da aba de Cortes que também valem para as faltas (mesma chave). */
export const FILTROS_FALTA = ["fornecedor", "comprador", "produto", "cliente"] as const;
export type FiltroFalta = (typeof FILTROS_FALTA)[number];

type Chave = (l: LinhaFalta) => [string, string] | null;

// Mesmas chaves dos cortes (src/domain/cortes.ts → CHAVES), para o filtro da tela valer nos dois.
const CHAVES: Record<FiltroFalta, Chave> = {
  fornecedor: (l) => (l.codfornec === null ? ["0", "Sem fornecedor"] : [String(l.codfornec), l.fornecedor ?? String(l.codfornec)]),
  comprador: (l) => [l.comprador ?? "Sem comprador", l.comprador ?? "Sem comprador"],
  produto: (l) => [String(l.codprod), `${l.codprod} · ${l.produto}`],
  cliente: (l) => (l.codcli === null ? null : [String(l.codcli), `${l.codcli} · ${l.cliente ?? ""}`.trim()]),
};

const chaveRca: Chave = (l) => (l.codusur === null ? null : [String(l.codusur), `${l.codusur} · ${l.rca ?? ""}`.trim()]);

/** Linhas que batem com os filtros ativos que se aplicam às faltas. */
export function filtrarFaltas(linhas: LinhaFalta[], filtros: Partial<Record<string, string>>): LinhaFalta[] {
  const ativos = FILTROS_FALTA.filter((d) => filtros[d]);
  if (ativos.length === 0) return linhas;
  return linhas.filter((l) => ativos.every((d) => CHAVES[d](l)?.[0] === filtros[d]));
}

function agrupar(linhas: LinhaFalta[], chave: Chave): GrupoFalta[] {
  const m = new Map<string, GrupoFalta & { _peds: Set<number> }>();
  for (const l of linhas) {
    const k = chave(l);
    if (!k) continue;
    const g = m.get(k[0]) ?? { chave: k[0], rotulo: k[1], valor: 0, qt: 0, itens: 0, pedidos: 0, _peds: new Set<number>() };
    g.valor += l.valor;
    g.qt += l.qt;
    g.itens += 1;
    g._peds.add(l.numped);
    m.set(k[0], g);
  }
  return [...m.values()]
    .map(({ _peds, ...g }) => ({ ...g, pedidos: _peds.size }))
    .sort((a, b) => b.valor - a.valor || b.itens - a.itens);
}

function porProduto(linhas: LinhaFalta[]): ProdutoFalta[] {
  const m = new Map<number, ProdutoFalta & { _peds: Set<number>; _clis: Set<number> }>();
  for (const l of linhas) {
    const p = m.get(l.codprod) ?? {
      codprod: l.codprod, produto: l.produto, comprador: l.comprador, fornecedor: l.fornecedor,
      qt: 0, itens: 0, pedidos: 0, clientes: 0, valor: 0, ultimoDia: l.dia, _peds: new Set<number>(), _clis: new Set<number>(),
    };
    p.qt += l.qt;
    p.itens += 1;
    p.valor += l.valor;
    if (l.dia > p.ultimoDia) p.ultimoDia = l.dia;
    p._peds.add(l.numped);
    if (l.codcli !== null) p._clis.add(l.codcli);
    m.set(l.codprod, p);
  }
  return [...m.values()]
    .map(({ _peds, _clis, ...p }) => ({ ...p, pedidos: _peds.size, clientes: _clis.size }))
    .sort((a, b) => b.valor - a.valor || b.itens - a.itens);
}

export function resumoFaltas(linhas: LinhaFalta[]): ResumoFaltas {
  return {
    valor: linhas.reduce((s, l) => s + l.valor, 0),
    qt: linhas.reduce((s, l) => s + l.qt, 0),
    itens: linhas.length,
    pedidos: new Set(linhas.map((l) => l.numped)).size,
    skus: new Set(linhas.map((l) => l.codprod)).size,
    clientes: new Set(linhas.map((l) => l.codcli).filter((c) => c !== null)).size,
    rcas: new Set(linhas.map((l) => l.codusur).filter((c) => c !== null)).size,
    porProduto: agrupar(linhas, CHAVES.produto),
    porComprador: agrupar(linhas, CHAVES.comprador),
    porFornecedor: agrupar(linhas, CHAVES.fornecedor),
    porRca: agrupar(linhas, chaveRca),
    porCliente: agrupar(linhas, CHAVES.cliente),
    produtos: porProduto(linhas),
  };
}

const csvTxt = (s: string | number | null | undefined) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const csvNum = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/** CSV das faltas (";", vírgula decimal e BOM, como o dos cortes). Ordem: data, depois maior valor. */
export function faltasParaCsv(linhas: LinhaFalta[]): string {
  const header = [
    "Data", "Pedido", "Pedido gravado", "Cód. produto", "Produto", "Cód. fornecedor", "Fornecedor", "Comprador",
    "Cód. cliente", "Cliente", "Cód. RCA", "RCA", "Quantidade", "Valor",
  ];
  const corpo = [...linhas]
    .sort((a, b) => a.dia.localeCompare(b.dia) || b.valor - a.valor)
    .map((l) =>
      [
        l.dia.split("-").reverse().join("/"),
        l.numped,
        l.temPedido ? "Sim" : "Não",
        l.codprod,
        csvTxt(l.produto),
        l.codfornec ?? "",
        csvTxt(l.fornecedor),
        csvTxt(l.comprador),
        l.codcli ?? "",
        csvTxt(l.cliente),
        l.codusur ?? "",
        csvTxt(l.rca),
        csvNum(l.qt),
        csvNum(l.valor),
      ].join(";"),
    );
  return "﻿" + [header.join(";"), ...corpo].join("\n");
}

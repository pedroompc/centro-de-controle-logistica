/**
 * Cortes: quantidade do pedido que não foi atendida (PCCORTEI do Winthor). Valor
 * perdido = quantidade cortada × preço de venda do item no pedido.
 *
 * O Harpia grava o corte da separação no MOTIVO, no formato
 *   "1.HARPIA - FALTA DE MERCADORIA - Usuário: 27-CONF EDIVALDO"
 * O resto é digitado no Winthor (ex.: "ERRO DE DIGITACAO").
 */

export type OrigemCorte = "Separação (Harpia)" | "Winthor";

export interface LinhaCorte {
  dia: string; // "yyyy-mm-dd"
  numped: number;
  numcar: number | null;
  codprod: number;
  produto: string;
  codfornec: number | null;
  fornecedor: string | null;
  comprador: string | null;
  codcli: number | null;
  cliente: string | null;
  qt: number;
  valor: number;
  kg: number;
  motivo: string | null; // texto cru
  temPedido: boolean; // pedido ainda existe no PCPEDC (cortado inteiro some de lá)
}

export interface MotivoLido {
  origem: OrigemCorte;
  motivo: string;
  usuario: string | null;
}

const SEM_MOTIVO = "Sem justificativa";

/** Separa origem, motivo e quem cortou do texto do Winthor/Harpia. */
export function lerMotivo(raw: string | null | undefined): MotivoLido {
  const t = String(raw ?? "").replace(/\s+/g, " ").trim();
  const harpia = /HARPIA/i.test(t);
  if (!harpia) return { origem: "Winthor", motivo: t ? capitalizar(t) : SEM_MOTIVO, usuario: null };
  let resto = t.replace(/^.*?HARPIA\s*/i, "");
  let usuario: string | null = null;
  const u = resto.match(/Usu[aá]rio\s*:\s*(.*)$/i);
  if (u) {
    usuario = u[1].replace(/^\d+\s*-\s*/, "").trim() || null;
    resto = resto.slice(0, u.index);
  }
  const motivo = resto.replace(/^[\s.\-]+|[\s.\-]+$/g, "");
  return { origem: "Separação (Harpia)", motivo: motivo ? capitalizar(motivo) : SEM_MOTIVO, usuario };
}

function capitalizar(s: string): string {
  const l = s.toLocaleLowerCase("pt-BR");
  return l.charAt(0).toLocaleUpperCase("pt-BR") + l.slice(1);
}

export interface GrupoCorte {
  chave: string;
  rotulo: string;
  valor: number;
  qt: number;
  itens: number; // linhas cortadas
  pedidos: number;
}

export interface ResumoCortes {
  valor: number;
  qt: number; // unidades cortadas
  itens: number;
  pedidos: number;
  skus: number;
  clientes: number;
  kg: number;
  harpia: number; // valor cortado na separação
  porDia: Map<string, number>;
  porOrigem: GrupoCorte[];
  porMotivo: GrupoCorte[];
  porUsuario: GrupoCorte[];
  porProduto: GrupoCorte[];
  porFornecedor: GrupoCorte[];
  porComprador: GrupoCorte[];
  porCliente: GrupoCorte[];
}

function agrupar(linhas: LinhaCorte[], chave: (l: LinhaCorte) => [string, string] | null): GrupoCorte[] {
  const m = new Map<string, GrupoCorte & { _peds: Set<number> }>();
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

/** Dimensões clicáveis do painel de cortes (cada uma vira filtro na URL). */
export const DIMENSOES_CORTE = ["origem", "motivo", "usuario", "fornecedor", "comprador", "produto", "cliente"] as const;
export type DimensaoCorte = (typeof DIMENSOES_CORTE)[number];
export type FiltrosCorte = Partial<Record<DimensaoCorte, string>>;

type Chave = (l: LinhaCorte, m: MotivoLido) => [string, string] | null;

// Mesma chave para agrupar e para filtrar: o clique numa barra estreita exatamente aquele grupo.
const CHAVES: Record<DimensaoCorte, Chave> = {
  origem: (_l, m) => [m.origem, m.origem],
  motivo: (_l, m) => [m.motivo, m.motivo],
  usuario: (_l, m) => (m.usuario ? [m.usuario, m.usuario] : null),
  fornecedor: (l) => (l.codfornec === null ? ["0", "Sem fornecedor"] : [String(l.codfornec), l.fornecedor ?? String(l.codfornec)]),
  comprador: (l) => [l.comprador ?? "Sem comprador", l.comprador ?? "Sem comprador"],
  produto: (l) => [String(l.codprod), `${l.codprod} · ${l.produto}`],
  cliente: (l) => (l.codcli === null ? null : [String(l.codcli), `${l.codcli} · ${l.cliente ?? ""}`.trim()]),
};

/** Linhas que batem com todos os filtros ativos. */
export function filtrarCortes(linhas: LinhaCorte[], filtros: FiltrosCorte): LinhaCorte[] {
  const ativos = DIMENSOES_CORTE.filter((d) => filtros[d]);
  if (ativos.length === 0) return linhas;
  return linhas.filter((l) => {
    const m = lerMotivo(l.motivo);
    return ativos.every((d) => CHAVES[d](l, m)?.[0] === filtros[d]);
  });
}

/** Rótulo legível do valor filtrado (ex.: código do fornecedor → nome). */
export function rotuloFiltro(linhas: LinhaCorte[], dim: DimensaoCorte, chave: string): string {
  for (const l of linhas) {
    const k = CHAVES[dim](l, lerMotivo(l.motivo));
    if (k && k[0] === chave) return k[1];
  }
  return chave;
}

export function resumoCortes(linhas: LinhaCorte[], dia: string | null = null): ResumoCortes {
  const ls = dia ? linhas.filter((l) => l.dia === dia) : linhas;
  const lidos = new Map(ls.map((l) => [l, lerMotivo(l.motivo)]));
  const porDia = new Map<string, number>();
  for (const l of linhas) porDia.set(l.dia, (porDia.get(l.dia) ?? 0) + l.valor);
  const soma = (f: (l: LinhaCorte) => number) => ls.reduce((s, l) => s + f(l), 0);
  const por = (d: DimensaoCorte) => agrupar(ls, (l) => CHAVES[d](l, lidos.get(l)!));
  return {
    valor: soma((l) => l.valor),
    qt: soma((l) => l.qt),
    itens: ls.length,
    pedidos: new Set(ls.map((l) => l.numped)).size,
    skus: new Set(ls.map((l) => l.codprod)).size,
    clientes: new Set(ls.map((l) => l.codcli).filter((c) => c !== null)).size,
    kg: soma((l) => l.kg),
    harpia: soma((l) => (lidos.get(l)!.origem === "Winthor" ? 0 : l.valor)),
    porDia,
    porOrigem: por("origem"),
    porMotivo: por("motivo"),
    porUsuario: por("usuario"),
    porProduto: por("produto"),
    porFornecedor: por("fornecedor"),
    porComprador: por("comprador"),
    porCliente: por("cliente"),
  };
}

/** % do que foi pedido que deixou de ser vendido: corte ÷ (corte + venda líquida). */
export function taxaCorte(valorCortado: number, vendaLiquida: number | null): number | null {
  if (vendaLiquida === null) return null;
  const base = valorCortado + vendaLiquida;
  return base > 0 ? valorCortado / base : null;
}

// --- Comparação e série diária -------------------------------------------------

/** Comparação de um card com o mês anterior. Em corte, subir é sempre piorar. */
export interface VariacaoCorte {
  texto: string; // "+12% vs set" / "−0,11 p.p. vs set"
  piorou: boolean;
}

const sinal = (v: number) => (v > 0 ? "+" : v < 0 ? "−" : "");

/** Variação relativa (%) contra o mês anterior. `null` sem base (anterior zero). */
export function variacaoCorte(atual: number, anterior: number, mesCurto: string): VariacaoCorte | null {
  if (!(anterior > 0)) return null;
  const v = (atual - anterior) / anterior;
  const pct = Math.round(Math.abs(v) * 100);
  return { texto: `${pct === 0 ? "" : sinal(v)}${pct}% vs ${mesCurto}`, piorou: v > 0 && pct > 0 };
}

/**
 * Variação de uma TAXA em pontos percentuais (0,20% → 0,09% = −0,11 p.p.).
 * Taxa pequena variando em "%" engana (−55%); p.p. é a leitura honesta.
 */
export function variacaoTaxaCorte(atual: number | null, anterior: number | null, mesCurto: string): VariacaoCorte | null {
  if (atual === null || anterior === null) return null;
  const pp = (atual - anterior) * 100;
  const txt = Math.abs(pp).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const zero = txt === "0,00";
  return { texto: `${zero ? "" : sinal(pp)}${txt} p.p. vs ${mesCurto}`, piorou: pp > 0 && !zero };
}

/** Todos os dias de `inicio` a `fim` ("yyyy-mm-dd", inclusivos), com 0 nos dias sem corte. */
export function serieDiaria(porDia: Map<string, number>, inicio: string, fim: string): { dia: string; valor: number }[] {
  const out: { dia: string; valor: number }[] = [];
  const d = new Date(`${inicio}T12:00:00Z`);
  const ate = new Date(`${fim}T12:00:00Z`);
  while (d <= ate) {
    const dia = d.toISOString().slice(0, 10);
    out.push({ dia, valor: porDia.get(dia) ?? 0 });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// --- Exportação (planilha) ----------------------------------------------------

const csvTxt = (s: string | number | null | undefined) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const csvNum = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * CSV das linhas de corte (separador ";", vírgula decimal e BOM — abre direto
 * no Excel PT-BR). Uma linha por item cortado, já com motivo e quem cortou
 * lidos do texto do Harpia/Winthor. Ordem: data, depois maior valor.
 */
export function cortesParaCsv(linhas: LinhaCorte[]): string {
  const header = [
    "Data", "Pedido", "Carregamento", "Cód. produto", "Produto", "Cód. fornecedor", "Fornecedor",
    "Comprador", "Cód. cliente", "Cliente", "Quantidade", "Kg", "Valor", "Origem", "Motivo", "Quem cortou",
  ];
  const corpo = [...linhas]
    .sort((a, b) => a.dia.localeCompare(b.dia) || b.valor - a.valor)
    .map((l) => {
      const m = lerMotivo(l.motivo);
      return [
        l.dia.split("-").reverse().join("/"),
        l.numped,
        l.numcar ?? "",
        l.codprod,
        csvTxt(l.produto),
        l.codfornec ?? "",
        csvTxt(l.fornecedor),
        csvTxt(l.comprador),
        l.codcli ?? "",
        csvTxt(l.cliente),
        csvNum(l.qt),
        csvNum(l.kg),
        csvNum(l.valor),
        csvTxt(m.origem),
        csvTxt(m.motivo),
        csvTxt(m.usuario),
      ].join(";");
    });
  return "﻿" + [header.join(";"), ...corpo].join("\n");
}

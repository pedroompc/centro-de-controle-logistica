import { mesesDoPeriodo } from "./periodo";
/**
 * Cortes: quantidade do pedido que não foi atendida (PCCORTEI do Winthor). Valor
 * perdido = quantidade cortada × preço de venda do item no pedido.
 *
 * O Harpia grava o corte da separação no MOTIVO, no formato
 *   "1.HARPIA - FALTA DE MERCADORIA - Usuário: 27-CONF EDIVALDO"
 * O resto é digitado no Winthor (ex.: "ERRO DE DIGITACAO").
 */

import { compararPct, compararTaxa, comRotulo, type Comparacao } from "./comparacao";

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
  custo: number; // quantidade cortada × custo financeiro de hoje (PCEST.CUSTOFIN)
  kg: number;
  motivo: string | null; // texto cru
  temPedido: boolean; // pedido ainda existe no PCPEDC (cortado inteiro some de lá)
  hora: number | null; // hora do corte (PCCORTEI.HORA, 0–23)
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
  custo: number; // custo da mercadoria cortada
  qt: number; // unidades cortadas
  itens: number;
  pedidos: number;
  skus: number;
  clientes: number;
  kg: number;
  harpia: number; // valor cortado na separação
  porDia: Map<string, number>;
  porOrigem: GrupoCorte[];
  porHora: GrupoCorte[];
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
export const DIMENSOES_CORTE = ["origem", "hora", "motivo", "usuario", "fornecedor", "comprador", "produto", "cliente"] as const;
export type DimensaoCorte = (typeof DIMENSOES_CORTE)[number];
export type FiltrosCorte = Partial<Record<DimensaoCorte, string>>;

type Chave = (l: LinhaCorte, m: MotivoLido) => [string, string] | null;

// Mesma chave para agrupar e para filtrar: o clique numa barra estreita exatamente aquele grupo.
const CHAVES: Record<DimensaoCorte, Chave> = {
  origem: (_l, m) => [m.origem, m.origem],
  hora: (l) => (l.hora === null ? null : [String(l.hora).padStart(2, "0"), `${String(l.hora).padStart(2, "0")}h`]),
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
    custo: soma((l) => l.custo),
    qt: soma((l) => l.qt),
    itens: ls.length,
    pedidos: new Set(ls.map((l) => l.numped)).size,
    skus: new Set(ls.map((l) => l.codprod)).size,
    clientes: new Set(ls.map((l) => l.codcli).filter((c) => c !== null)).size,
    kg: soma((l) => l.kg),
    harpia: soma((l) => (lidos.get(l)!.origem === "Winthor" ? 0 : l.valor)),
    porDia,
    porOrigem: por("origem"),
    porHora: por("hora"),
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

/** Variação relativa (%) contra o mês anterior. `null` sem base (anterior zero). */
export function variacaoCorte(atual: number, anterior: number, mesCurto: string): VariacaoCorte | null {
  return paraCorte(comRotulo(compararPct(atual, anterior, false, 0), mesCurto));
}

/**
 * Variação de uma TAXA em pontos percentuais (0,20% → 0,09% = −0,11 p.p.).
 * Taxa pequena variando em "%" engana (−55%); p.p. é a leitura honesta.
 */
export function variacaoTaxaCorte(atual: number | null, anterior: number | null, mesCurto: string): VariacaoCorte | null {
  return paraCorte(comRotulo(compararTaxa(atual, anterior, false, { casas: 2 }), mesCurto));
}

// Corte: subir é sempre piorar — mas só pinta quando o número exibido mudou.
const paraCorte = (c: Comparacao | null): VariacaoCorte | null => c && { texto: c.texto, piorou: !c.positivo && /[1-9]/.test(c.texto.split(" vs ")[0]) };

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

/** Valor por mês tocado pelo período (período longo: gráfico mês a mês). */
export function serieMensalCortes(porDia: Map<string, number>, p: { de: string; ate: string }): { mes: string; valor: number }[] {
  const porMes = new Map(mesesDoPeriodo(p).map((m) => [m, 0]));
  for (const [dia, v] of porDia) {
    const m = `${dia.slice(0, 7)}-01`;
    if (porMes.has(m)) porMes.set(m, porMes.get(m)! + v);
  }
  return [...porMes].map(([mes, valor]) => ({ mes, valor }));
}

/**
 * Valor cortado por semana do mês (dias 1–7 = semana 1, 8–14 = semana 2…, como
 * o TO_CHAR(DATA, 'W') do Oracle). Período de mais de um mês traz o mês no rótulo.
 */
export function serieSemanal(porDia: Map<string, number>): { chave: string; rotulo: string; valor: number }[] {
  const porSemana = new Map<string, number>();
  for (const [dia, v] of porDia) {
    const chave = `${dia.slice(0, 7)}-${Math.ceil(Number(dia.slice(8)) / 7)}`;
    porSemana.set(chave, (porSemana.get(chave) ?? 0) + v);
  }
  const chaves = [...porSemana.keys()].sort();
  const variosMeses = new Set(chaves.map((c) => c.slice(0, 7))).size > 1;
  return chaves.map((chave) => {
    const [ano, mes, semana] = chave.split("-");
    return { chave, rotulo: variosMeses ? `Semana ${semana} · ${mes}/${ano.slice(2)}` : `Semana ${semana}`, valor: porSemana.get(chave)! };
  });
}

/** Variação % de um número contra o período anterior (null sem base). */
export function variacaoPct(atual: number, anterior: number): number | null {
  return anterior > 0 ? atual / anterior - 1 : null;
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
    "Data", "Hora", "Pedido", "Carregamento", "Cód. produto", "Produto", "Cód. fornecedor", "Fornecedor",
    "Comprador", "Cód. cliente", "Cliente", "Quantidade", "Kg", "Valor", "Origem", "Motivo", "Quem cortou",
  ];
  const corpo = [...linhas]
    .sort((a, b) => a.dia.localeCompare(b.dia) || b.valor - a.valor)
    .map((l) => {
      const m = lerMotivo(l.motivo);
      return [
        l.dia.split("-").reverse().join("/"),
        l.hora === null ? "" : `${String(l.hora).padStart(2, "0")}h`,
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

/**
 * As 24 horas na ordem do dia operacional (começa às `inicio` h, padrão 7h como
 * na Separação), com o valor cortado de cada uma — a noite fica contínua.
 */
export function serieHoraria(porHora: GrupoCorte[], inicio = 7): { chave: string; hora: number; valor: number }[] {
  const v = new Map(porHora.map((g) => [g.chave, g.valor]));
  return Array.from({ length: 24 }, (_, i) => {
    const hora = (inicio + i) % 24;
    const chave = String(hora).padStart(2, "0");
    return { chave, hora, valor: v.get(chave) ?? 0 };
  });
}

/** Uma linha por produto cortado: a auditoria do mês (visão "por produto"). */
export interface ProdutoCortado {
  codprod: number;
  produto: string;
  fornecedor: string | null;
  comprador: string | null;
  qt: number;
  valor: number;
  itens: number;
  pedidos: number;
  clientes: number;
  cargas: number;
  ultimoDia: string;
  motivo: string; // motivo de maior valor no produto
  conferente: string | null; // quem mais cortou o produto (valor), pelo texto do Harpia
  cliente: string | null; // nome do cliente quando só um foi atingido
}

export function porProdutoDetalhado(linhas: LinhaCorte[]): ProdutoCortado[] {
  const m = new Map<number, ProdutoCortado & {
    _p: Set<number>; _c: Set<number>; _k: Set<number>; _mot: Map<string, number>; _usu: Map<string, number>;
  }>();
  for (const l of linhas) {
    const g = m.get(l.codprod) ?? {
      codprod: l.codprod, produto: l.produto, fornecedor: l.fornecedor, comprador: l.comprador,
      qt: 0, valor: 0, itens: 0, pedidos: 0, clientes: 0, cargas: 0, ultimoDia: l.dia, motivo: "",
      conferente: null, cliente: l.cliente,
      _p: new Set<number>(), _c: new Set<number>(), _k: new Set<number>(), _mot: new Map<string, number>(), _usu: new Map<string, number>(),
    };
    g.qt += l.qt;
    g.valor += l.valor;
    g.itens += 1;
    g._p.add(l.numped);
    if (l.codcli !== null) g._c.add(l.codcli);
    if (l.numcar !== null) g._k.add(l.numcar);
    if (l.dia > g.ultimoDia) g.ultimoDia = l.dia;
    const lido = lerMotivo(l.motivo);
    g._mot.set(lido.motivo, (g._mot.get(lido.motivo) ?? 0) + l.valor);
    if (lido.usuario) g._usu.set(lido.usuario, (g._usu.get(lido.usuario) ?? 0) + l.valor);
    m.set(l.codprod, g);
  }
  const maior = (mapa: Map<string, number>) => [...mapa.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return [...m.values()]
    .map(({ _p, _c, _k, _mot, _usu, ...g }) => ({
      ...g,
      pedidos: _p.size,
      clientes: _c.size,
      cargas: _k.size,
      motivo: maior(_mot) ?? "",
      conferente: maior(_usu),
      cliente: _c.size === 1 ? g.cliente : null,
    }))
    .sort((a, b) => b.valor - a.valor);
}

// --- Painel TV ------------------------------------------------------------------

/** Linha de ranking da TV: participação no valor cortado do mês (sem R$ na tela). */
export interface FatiaCorteTV {
  rotulo: string;
  parte: number; // 0..1 do valor cortado do mês
  itens: number;
}

export interface CortesTV {
  valor: number; // só para a taxa (corte ÷ (corte + venda líquida)); a TV não mostra R$
  valorAnt: number;
  itens: number;
  pedidos: number;
  skus: number;
  clientes: number;
  harpia: number; // 0..1 do valor cortado que veio da separação
  porDia: { dia: string; itens: number }[];
  motivos: FatiaCorteTV[];
  usuarios: FatiaCorteTV[];
}

/**
 * Resumo enxuto para o slide da TV — só agregados (as linhas ficam no servidor).
 * `porDia` cobre de `inicio` a `fim` com zero nos dias sem corte.
 */
export function cortesParaTV(linhas: LinhaCorte[], linhasAnt: LinhaCorte[], inicio: string, fim: string, top = 8): CortesTV {
  const r = resumoCortes(linhas);
  const itensDia = new Map<string, number>();
  for (const l of linhas) itensDia.set(l.dia, (itensDia.get(l.dia) ?? 0) + 1);
  const fatia = (g: GrupoCorte): FatiaCorteTV => ({ rotulo: g.rotulo, parte: r.valor > 0 ? g.valor / r.valor : 0, itens: g.itens });
  return {
    valor: r.valor,
    valorAnt: linhasAnt.reduce((s, l) => s + l.valor, 0),
    itens: r.itens,
    pedidos: r.pedidos,
    skus: r.skus,
    clientes: r.clientes,
    harpia: r.valor > 0 ? r.harpia / r.valor : 0,
    porDia: serieDiaria(itensDia, inicio, fim).map((d) => ({ dia: d.dia, itens: d.valor })),
    motivos: r.porMotivo.slice(0, top).map(fatia),
    usuarios: r.porUsuario.slice(0, top).map(fatia),
  };
}

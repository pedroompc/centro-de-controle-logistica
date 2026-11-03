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

export function resumoCortes(linhas: LinhaCorte[], dia: string | null = null): ResumoCortes {
  const ls = dia ? linhas.filter((l) => l.dia === dia) : linhas;
  const lidos = new Map(ls.map((l) => [l, lerMotivo(l.motivo)]));
  const porDia = new Map<string, number>();
  for (const l of linhas) porDia.set(l.dia, (porDia.get(l.dia) ?? 0) + l.valor);
  const soma = (f: (l: LinhaCorte) => number) => ls.reduce((s, l) => s + f(l), 0);
  return {
    valor: soma((l) => l.valor),
    itens: ls.length,
    pedidos: new Set(ls.map((l) => l.numped)).size,
    skus: new Set(ls.map((l) => l.codprod)).size,
    clientes: new Set(ls.map((l) => l.codcli).filter((c) => c !== null)).size,
    kg: soma((l) => l.kg),
    harpia: soma((l) => (lidos.get(l)!.origem === "Winthor" ? 0 : l.valor)),
    porDia,
    porOrigem: agrupar(ls, (l) => [lidos.get(l)!.origem, lidos.get(l)!.origem]),
    porMotivo: agrupar(ls, (l) => [lidos.get(l)!.motivo, lidos.get(l)!.motivo]),
    porUsuario: agrupar(ls, (l) => {
      const u = lidos.get(l)!.usuario;
      return u ? [u, u] : null;
    }),
    porProduto: agrupar(ls, (l) => [String(l.codprod), `${l.codprod} · ${l.produto}`]),
    porFornecedor: agrupar(ls, (l) => (l.codfornec === null ? ["0", "Sem fornecedor"] : [String(l.codfornec), l.fornecedor ?? String(l.codfornec)])),
    porComprador: agrupar(ls, (l) => [l.comprador ?? "Sem comprador", l.comprador ?? "Sem comprador"]),
    porCliente: agrupar(ls, (l) => (l.codcli === null ? null : [String(l.codcli), `${l.codcli} · ${l.cliente ?? ""}`.trim()])),
  };
}

/** % do que foi pedido que deixou de ser vendido: corte ÷ (corte + venda líquida). */
export function taxaCorte(valorCortado: number, vendaLiquida: number | null): number | null {
  if (vendaLiquida === null) return null;
  const base = valorCortado + vendaLiquida;
  return base > 0 ? valorCortado / base : null;
}

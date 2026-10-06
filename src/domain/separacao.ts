/**
 * Separação — regras do BI do setor. Por enquanto só a parte de equipe e
 * custo; a produção (Harpia) entra depois.
 */
import { normalizarTexto, ehCargoEmpilhador } from "./recebimento";

export type PapelSeparacao = "separador" | "conferente" | "maquina" | "lider" | "outros";

export function ehSetorSeparacao(nome: string): boolean {
  return normalizarTexto(nome).includes("separa");
}

/** Mesmo setor, ignorando acento/caixa ("SEPARAÇÃO" = "Separacao"). */
export function mesmoSetor(a: string, b: string): boolean {
  return normalizarTexto(a) === normalizarTexto(b);
}

export function papelSeparacao(cargo: string): PapelSeparacao {
  const c = normalizarTexto(cargo);
  if (c.includes("confer")) return "conferente";
  if (ehCargoEmpilhador(cargo) || c.includes("operador")) return "maquina";
  if (c.includes("lider") || c.includes("encarreg") || c.includes("supervis") || c.includes("coorden")) return "lider";
  if (c.includes("separ") || c.includes("ajudante") || c.includes("auxiliar")) return "separador";
  return "outros";
}

export interface PontoCustoSetor {
  mes: string; // "yyyy-mm-01"
  pessoas: number | null; // null = mês sem foto
  folha: number | null;
}

/**
 * Custo do setor mês a mês: a foto mensal do efetivo (folha dos ativos) e, no
 * mês corrente, o cadastro vivo. Mês sem foto fica sem valor (não inventa).
 */
export function serieCustoSetor(
  meses: string[],
  fotos: { mes: string; ativos: number; custoAtivos: number }[],
  atual: string,
  hoje: { pessoas: number; folha: number },
): PontoCustoSetor[] {
  const porMes = new Map(fotos.map((f) => [f.mes, f]));
  return meses.map((mes) => {
    if (mes === atual) return { mes, pessoas: hoje.pessoas, folha: hoje.folha };
    const f = porMes.get(mes);
    return { mes, pessoas: f ? f.ativos : null, folha: f ? f.custoAtivos : null };
  });
}

// --- Harpia: produção pela conferência ----------------------------------------

export interface LinhaDiaSep {
  dia: string;
  caixas: number;
  unidades: number;
  itens: number;
  pedidos: number;
  clientes: number;
  mapas: number;
}

export interface LinhaConferenteDia {
  dia: string;
  usuario: number;
  caixas: number;
  unidades: number;
  itens: number;
  pedidos: number;
  horas: number;
}

/** Soma dos dias (pedidos/clientes/mapas somam por dia: o mesmo pedido em 2 dias conta 2). */
export function resumoProducao(dias: LinhaDiaSep[]) {
  const r = { caixas: 0, unidades: 0, itens: 0, pedidos: 0, clientes: 0, mapas: 0, dias: 0 };
  for (const d of dias) {
    r.caixas += d.caixas;
    r.unidades += d.unidades;
    r.itens += d.itens;
    r.pedidos += d.pedidos;
    r.clientes += d.clientes;
    r.mapas += d.mapas;
    if (d.itens > 0) r.dias += 1;
  }
  return r;
}

export interface ResumoConferente {
  usuario: number;
  caixas: number;
  unidades: number;
  itens: number;
  pedidos: number;
  dias: number;
  horas: number;
  itensPorHora: number | null; // itens (linhas) por hora, só dos dias com 1h+ conferindo (dia curto engana a taxa)
}

/**
 * Por conferente no recorte. Horas = da 1ª à última conferência de cada dia
 * (inclui pausas — é o tempo "na doca", não o tempo bipando).
 */
export function porConferente(linhas: LinhaConferenteDia[], dia: string | null = null): ResumoConferente[] {
  const m = new Map<number, ResumoConferente>();
  const taxa = new Map<number, { it: number; h: number }>();
  for (const l of linhas) {
    if (dia && l.dia !== dia) continue;
    const r = m.get(l.usuario) ?? { usuario: l.usuario, caixas: 0, unidades: 0, itens: 0, pedidos: 0, dias: 0, horas: 0, itensPorHora: null };
    r.caixas += l.caixas;
    r.unidades += l.unidades;
    r.itens += l.itens;
    r.pedidos += l.pedidos;
    r.horas += l.horas;
    r.dias += 1;
    m.set(l.usuario, r);
    if (l.horas >= 1) {
      const t = taxa.get(l.usuario) ?? { it: 0, h: 0 };
      t.it += l.itens;
      t.h += l.horas;
      taxa.set(l.usuario, t);
    }
  }
  return [...m.values()]
    .map((r) => {
      const t = taxa.get(r.usuario);
      return { ...r, itensPorHora: t ? t.it / t.h : null };
    })
    .sort((a, b) => b.itens - a.itens);
}

/** Erros a cada 1.000 itens conferidos (taxa comparável entre dias de volume diferente). */
export function errosPorMilItens(erros: number, itens: number): number | null {
  return itens > 0 ? (erros / itens) * 1000 : null;
}

// --- Winthor: produção pelos pedidos separados --------------------------------

export interface LinhaProducaoSep {
  dia: string;
  pedidos: number;
  kg: number;
  valor: number;
  carregamentos: number;
  clientes: number;
  skus: number;
}

/**
 * Totais do recorte. Carregamentos e clientes somam por dia (o mesmo
 * carregamento separado em 2 dias conta 2) — é "carregamentos atendidos por dia".
 */
export function resumoPedidos(dias: LinhaProducaoSep[]) {
  const r = { pedidos: 0, kg: 0, valor: 0, carregamentos: 0, clientes: 0, skus: 0, dias: 0 };
  for (const d of dias) {
    r.pedidos += d.pedidos;
    r.kg += d.kg;
    r.valor += d.valor;
    r.carregamentos += d.carregamentos;
    r.clientes += d.clientes;
    r.skus += d.skus;
    if (d.pedidos > 0) r.dias += 1;
  }
  return {
    ...r,
    skuPorPedido: r.pedidos > 0 ? r.skus / r.pedidos : null,
    kgPorPedido: r.pedidos > 0 ? r.kg / r.pedidos : null,
    pedidosPorDia: r.dias > 0 ? r.pedidos / r.dias : null,
  };
}

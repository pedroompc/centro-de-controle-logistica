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

// --- Rendimento, capacidade e horário (visão do gestor) -----------------------

export interface MesProducaoSep {
  mes: string; // "yyyy-mm-01"
  pedidos: number;
  kg: number;
  skus: number;
  dias: number; // dias com separação
}

export interface RendimentoMes {
  mes: string;
  pessoas: number | null; // equipe do setor no mês (foto do efetivo)
  pedidosPorPessoaDia: number | null;
  kgPorPessoaDia: number | null;
  skusPorPessoaDia: number | null;
  pedidosPorDia: number | null;
}

/**
 * Rendimento da EQUIPE por mês: produção ÷ dias trabalhados ÷ pessoas do setor.
 * Sem o separador registrado por mapa, é a média da equipe (não por pessoa).
 */
export function rendimentoMensal(producao: MesProducaoSep[], pessoasPorMes: Map<string, number | null>): RendimentoMes[] {
  return producao.map((p) => {
    const pessoas = pessoasPorMes.get(p.mes) ?? null;
    const base = p.dias > 0 && pessoas ? p.dias * pessoas : 0;
    return {
      mes: p.mes,
      pessoas,
      pedidosPorPessoaDia: base ? p.pedidos / base : null,
      kgPorPessoaDia: base ? p.kg / base : null,
      skusPorPessoaDia: base ? p.skus / base : null,
      pedidosPorDia: p.dias > 0 ? p.pedidos / p.dias : null,
    };
  });
}

function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const v = [...valores].sort((a, b) => a - b);
  const pos = (v.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export interface CapacidadeSep {
  separadores: number;
  media: number; // pedidos por dia (dias com separação)
  p90: number; // dia forte: 9 em cada 10 dias ficam abaixo
  pico: number; // o dia de mais pedidos — o que a equipe já provou que dá conta
  porSeparador: number; // pico ÷ separadores: o ritmo máximo comprovado por pessoa
  ideal: number; // separadores para o dia forte (p90) no ritmo máximo
  cenarios: { separadores: number; capacidade: number; diasAcima: number; folga: number }[];
}

/**
 * Capacidade da separação: o dia de pico mostra quantos pedidos a equipe atual
 * consegue separar; dividido pelas pessoas, é o ritmo máximo por separador.
 * Cada cenário (−2…+1 pessoa) diz quantos dias do período teriam passado da
 * capacidade e a folga contra o dia forte (p90).
 */
export function capacidadeSeparacao(pedidosPorDia: number[], separadores: number): CapacidadeSep | null {
  const dias = pedidosPorDia.filter((v) => v > 0);
  if (dias.length === 0 || separadores <= 0) return null;
  const pico = Math.max(...dias);
  const p90 = percentil(dias, 0.9);
  const porSeparador = pico / separadores;
  const cenarios = [-2, -1, 0, 1]
    .map((d) => separadores + d)
    .filter((n) => n > 0)
    .map((n) => {
      const capacidade = porSeparador * n;
      return { separadores: n, capacidade, diasAcima: dias.filter((v) => v > capacidade + 1e-9).length, folga: capacidade > 0 ? (capacidade - p90) / capacidade : 0 };
    });
  return {
    separadores,
    media: dias.reduce((a, b) => a + b, 0) / dias.length,
    p90,
    pico,
    porSeparador,
    ideal: Math.ceil(p90 / porSeparador - 1e-9),
    cenarios,
  };
}

/** Média de pedidos finalizados por hora do dia (só dias com separação). */
export function mediaPorHora(linhas: { hora: number; pedidos: number }[], diasComSeparacao: number): { hora: number; media: number }[] {
  const porHora = new Map<number, number>();
  for (const l of linhas) porHora.set(l.hora, (porHora.get(l.hora) ?? 0) + l.pedidos);
  const horas = [...porHora.keys()];
  if (!horas.length || diasComSeparacao <= 0) return [];
  const ini = Math.min(...horas);
  const fim = Math.max(...horas);
  const out: { hora: number; media: number }[] = [];
  for (let h = ini; h <= fim; h++) out.push({ hora: h, media: (porHora.get(h) ?? 0) / diasComSeparacao });
  return out;
}

// --- Quem separou o mapa: produção e erros por separador ----------------------

/** Nº do mapa como o líder digita ("0001155", " 1155 ") → chave única ("1155"). */
export function chaveMapa(mapa: string): string {
  const t = mapa.trim();
  return /^\d+$/.test(t) ? String(Number(t)) : t.toUpperCase();
}

export interface MapaHarpia {
  mapa: string; // SEQ_PLANILHA
  dia: string;
  itens: number;
  pedidos: number;
  unidades: number;
  erros: number;
}

export interface RankingSeparador {
  funcionarioId: string;
  mapas: number;
  itens: number;
  pedidos: number;
  unidades: number;
  erros: number;
  dias: number;
  errosPorMil: number | null;
  itensPorDia: number | null;
}

/**
 * Cruza "quem separou" com a conferência do Harpia. Mapa com N separadores
 * divide a produção e os erros por N. Mapa informado que não aparece no
 * Harpia conta como mapa, sem produção (número digitado errado ou não conferido).
 */
export function rankingSeparadores(registros: { mapa: string; funcionarioId: string }[], mapas: MapaHarpia[]) {
  const porMapa = new Map(mapas.map((m) => [chaveMapa(m.mapa), m]));
  const sepsDoMapa = new Map<string, string[]>();
  for (const r of registros) {
    const k = chaveMapa(r.mapa);
    sepsDoMapa.set(k, [...(sepsDoMapa.get(k) ?? []), r.funcionarioId]);
  }
  const acc = new Map<string, RankingSeparador & { diasSet: Set<string> }>();
  let semHarpia = 0;
  for (const [k, seps] of sepsDoMapa) {
    const m = porMapa.get(k);
    if (!m) semHarpia += 1;
    const n = seps.length;
    for (const f of seps) {
      const a = acc.get(f) ?? { funcionarioId: f, mapas: 0, itens: 0, pedidos: 0, unidades: 0, erros: 0, dias: 0, errosPorMil: null, itensPorDia: null, diasSet: new Set<string>() };
      a.mapas += 1;
      if (m) {
        a.itens += m.itens / n;
        a.pedidos += m.pedidos / n;
        a.unidades += m.unidades / n;
        a.erros += m.erros / n;
        a.diasSet.add(m.dia);
      }
      acc.set(f, a);
    }
  }
  const ranking: RankingSeparador[] = [...acc.values()]
    .map(({ diasSet, ...a }) => ({
      ...a,
      dias: diasSet.size,
      errosPorMil: a.itens > 0 ? (a.erros / a.itens) * 1000 : null,
      itensPorDia: diasSet.size > 0 ? a.itens / diasSet.size : null,
    }))
    .sort((x, y) => y.itens - x.itens);
  const informados = new Set([...sepsDoMapa.keys()].filter((k) => porMapa.has(k)));
  return {
    ranking,
    mapasNoHarpia: mapas.length,
    mapasComSeparador: informados.size,
    cobertura: mapas.length > 0 ? informados.size / mapas.length : null,
    informadosSemHarpia: semHarpia,
  };
}

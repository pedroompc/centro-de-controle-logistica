/**
 * BI do Recebimento — tabela de FATOS do descarrego no menor grão que existe
 * (dia × fornecedor × tipo) e os filtros cruzados em cima dela.
 *
 * As três formas de lançar viram fatos que, somados sem filtro, batem com o
 * agregado oficial do mês (`agregarPorMes`):
 *  - lançamento por fornecedor: 1 nota; carro conta 1 (Volume conta descargas
 *    e caixas, nunca carro);
 *  - contagem real de carros do dia (`descarregos_carros_dia`): substitui a
 *    contagem de notas — vira um fato de AJUSTE (sem fornecedor) com a
 *    diferença, por tipo;
 *  - total do dia digitado: carros por tipo (sem peso/receita por tipo) + um
 *    fato sem tipo com o peso e a receita do dia; sem fornecedor.
 *
 * Filtrar por fornecedor tira os fatos sem fornecedor (ajustes e total do dia):
 * os carros passam a ser NOTAS daquele fornecedor. Filtrar por tipo tira os
 * fatos sem tipo (peso/receita do total do dia).
 */
import type { CarrosDia, DescarregamentoTipo, Receita, TotalDiarioDescarregamento } from "./types";
import { TIPOS_CARRO } from "./descarregamento";

export interface FatoDescarrego {
  data: string; // "yyyy-mm-dd"
  fornecedor: string | null; // null = total do dia digitado ou ajuste
  tipo: DescarregamentoTipo | null; // null = sem quebra por tipo
  carros: number; // batido + paletizado + pal-rem
  descargasVolume: number;
  caixas: number;
  pesoKg: number;
  receita: number;
  notas: number; // lançamentos por fornecedor
  ajuste?: boolean; // correção pela contagem real de carros do dia
}

const vazio = (data: string, fornecedor: string | null, tipo: DescarregamentoTipo | null): FatoDescarrego => ({
  data,
  fornecedor,
  tipo,
  carros: 0,
  descargasVolume: 0,
  caixas: 0,
  pesoKg: 0,
  receita: 0,
  notas: 0,
});

export function fatosDoMes(
  lancamentos: Pick<Receita, "data" | "fornecedorNome" | "tipo" | "quantidade" | "carros" | "pesoKg" | "receita">[],
  totais: TotalDiarioDescarregamento[],
  carrosDia: CarrosDia[],
): FatoDescarrego[] {
  const fatos: FatoDescarrego[] = [];
  // Contagem por dia/tipo vinda das notas, para o ajuste da contagem real.
  const contados = new Map<string, Record<DescarregamentoTipo, number>>();
  for (const l of lancamentos) {
    const f = vazio(l.data, l.fornecedorNome, l.tipo);
    f.notas = 1;
    f.pesoKg = l.pesoKg;
    f.receita = l.receita;
    if (l.tipo === "volume") {
      f.descargasVolume = l.carros ?? 1;
      f.caixas = l.quantidade ?? 0;
    } else {
      f.carros = 1;
    }
    fatos.push(f);
    const c = contados.get(l.data) ?? { batido: 0, paletizado: 0, pal_rem: 0, volume: 0 };
    if (l.tipo === "volume") c.volume += f.descargasVolume;
    else c[l.tipo] += 1;
    contados.set(l.data, c);
  }
  for (const real of carrosDia) {
    const c = contados.get(real.data);
    if (!c) continue; // sem lançamento no dia: nada a corrigir (mesma regra do agregado)
    for (const t of TIPOS_CARRO) {
      const dif = real.porTipo[t] - c[t];
      if (dif !== 0) fatos.push({ ...vazio(real.data, null, t), carros: dif, ajuste: true });
    }
    const difV = real.porTipo.volume - c.volume;
    if (difV !== 0) fatos.push({ ...vazio(real.data, null, "volume"), descargasVolume: difV, ajuste: true });
  }
  for (const d of totais) {
    if (d.porTipo) {
      for (const t of TIPOS_CARRO) if (d.porTipo[t]) fatos.push({ ...vazio(d.data, null, t), carros: d.porTipo[t] });
      if (d.porTipo.volume) fatos.push({ ...vazio(d.data, null, "volume"), caixas: d.porTipo.volume });
      fatos.push({ ...vazio(d.data, null, null), pesoKg: d.pesoKg, receita: d.receita });
    } else {
      fatos.push({ ...vazio(d.data, null, null), carros: d.descarregos, pesoKg: d.pesoKg, receita: d.receita });
    }
  }
  return fatos;
}

// --- Filtros cruzados ---------------------------------------------------------

export interface FiltroBI {
  dia?: string | null;
  fornecedor?: string | null;
  tipo?: DescarregamentoTipo | null;
}

export const filtroAtivo = (f: FiltroBI) => !!(f.dia || f.fornecedor || f.tipo);

/**
 * Aplica o filtro. `ignorar` deixa uma dimensão de fora — o visual daquela
 * dimensão continua mostrando todas as barras e só destaca a escolhida (o
 * comportamento do Power BI).
 */
export function filtrarFatos(fatos: FatoDescarrego[], f: FiltroBI, ignorar?: keyof FiltroBI): FatoDescarrego[] {
  return fatos.filter((x) => {
    if (f.dia && ignorar !== "dia" && x.data !== f.dia) return false;
    if (f.fornecedor && ignorar !== "fornecedor" && x.fornecedor !== f.fornecedor) return false;
    if (f.tipo && ignorar !== "tipo" && x.tipo !== f.tipo) return false;
    return true;
  });
}

export interface ResumoFatos {
  carros: number;
  descargasVolume: number;
  caixas: number;
  pesoKg: number;
  receita: number;
  notas: number;
  dias: number; // dias com algum movimento
  fornecedores: number;
}

export function resumir(fatos: FatoDescarrego[]): ResumoFatos {
  const r: ResumoFatos = { carros: 0, descargasVolume: 0, caixas: 0, pesoKg: 0, receita: 0, notas: 0, dias: 0, fornecedores: 0 };
  const dias = new Set<string>();
  const forn = new Set<string>();
  for (const x of fatos) {
    r.carros += x.carros;
    r.descargasVolume += x.descargasVolume;
    r.caixas += x.caixas;
    r.pesoKg += x.pesoKg;
    r.receita += x.receita;
    r.notas += x.notas;
    if (x.carros || x.notas || x.pesoKg || x.caixas) dias.add(x.data);
    if (x.fornecedor) forn.add(x.fornecedor);
  }
  r.dias = dias.size;
  r.fornecedores = forn.size;
  return r;
}

/** Agrupa e resume por uma chave (dia, fornecedor, tipo). Chave `null` sai do grupo. */
export function agrupar<K extends string>(fatos: FatoDescarrego[], chave: (f: FatoDescarrego) => K | null): { chave: K; resumo: ResumoFatos }[] {
  const grupos = new Map<K, FatoDescarrego[]>();
  for (const f of fatos) {
    const k = chave(f);
    if (k === null) continue;
    const g = grupos.get(k) ?? [];
    g.push(f);
    grupos.set(k, g);
  }
  return [...grupos.entries()].map(([k, g]) => ({ chave: k, resumo: resumir(g) }));
}

/**
 * Custo do recebimento no recorte filtrado. O custo é do MÊS; no recorte ele é
 * RATEADO: por dia de descarrego quando filtra o dia; e, dentro disso, pelo
 * peso quando filtra fornecedor ou tipo (o que pesa mais consome mais equipe).
 */
export function custoNoRecorte(p: {
  custoMes: number;
  diasMes: number;
  pesoMes: number;
  pesoDoDia: number; // peso do dia filtrado (todos os fornecedores/tipos)
  pesoRecorte: number;
  filtro: FiltroBI;
}): { custo: number; criterio: string | null } {
  const { filtro } = p;
  if (!filtroAtivo(filtro)) return { custo: p.custoMes, criterio: null };
  const custoBase = filtro.dia ? (p.diasMes > 0 ? p.custoMes / p.diasMes : 0) : p.custoMes;
  if (!filtro.fornecedor && !filtro.tipo) return { custo: custoBase, criterio: "custo do mês ÷ dias de descarrego" };
  const pesoBase = filtro.dia ? p.pesoDoDia : p.pesoMes;
  return { custo: pesoBase > 0 ? (custoBase * p.pesoRecorte) / pesoBase : 0, criterio: "rateado pelo peso" };
}

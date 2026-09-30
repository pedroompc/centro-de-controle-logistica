/**
 * Descarrego mês a mês — o "método de gestão" (comparativo temporal) aplicado ao
 * pátio. Puro e testável sem Supabase: recebe os lançamentos diários já mapeados
 * e agrega por mês, com as métricas que o gestor pergunta:
 *  - carros (quantos descarreguei),
 *  - por tipo (o que descarreguei mais: batido/paletizado/pal-rem),
 *  - peso (kg),
 *  - peso médio por carro (eficiência da viagem),
 *  - receita.
 *
 * "Volume" NÃO é carro — é CAIXA. Fica numa métrica separada (`caixas`) e fora do
 * total de carros e do mix, senão uma descarga de milhares de caixas viraria
 * "milhares de carros".
 *
 * O descarrego entra no app de dois jeitos — total do dia OU lançamento por
 * fornecedor — e a série precisa enxergar os dois. `diariosDosLancamentos`
 * converte os lançamentos por fornecedor para o formato do total do dia; a
 * camada de dados (`src/data/descarregamento-mensal.ts`) junta as duas origens e
 * chama `agregarPorMes`.
 */
import type { CarrosDia, DescarregamentoTipo, Receita, TotalDiarioDescarregamento } from "./types";
import { TIPOS_DESCARREGAMENTO, TIPOS_CARRO } from "./descarregamento";
import { primeiroDiaDoMes } from "./periodo";

export interface PontoDescarregoMensal {
  mes: string; // 1º dia do mês, ISO "yyyy-mm-01"
  carros: number; // batido + paletizado + pal-rem (NÃO inclui volume)
  carrosDetalhados: number; // carros com tipo conhecido (denominador do mix)
  caixas: number; // volume, contado em caixas (unidade separada)
  pesoKg: number;
  receita: number;
  porTipo: Record<DescarregamentoTipo, number>; // inclui volume, para referência
  // Peso (kg) por tipo — só do que tem essa quebra (lançamento por fornecedor).
  // Total do dia digitado entra em `pesoKg`, mas não aqui.
  pesoPorTipo: Record<DescarregamentoTipo, number>;
  // Descargas de Volume (lançamentos por fornecedor), para comparar com os carros
  // na mesma escala. Não entra em `carros`.
  descargasVolume: number;
  dias: number; // dias com lançamento
}

const zeroTipos = (): Record<DescarregamentoTipo, number> => ({
  batido: 0,
  paletizado: 0,
  pal_rem: 0,
  volume: 0,
});

/**
 * Colapsa os lançamentos por fornecedor em um "total do dia" por data, já com a
 * quebra por tipo: cada lançamento de batido/paletizado/pal-rem é 1 carro; o de
 * Volume soma as suas caixas (`quantidade`), nunca vira carro.
 *
 * Sem isso, quem lança por fornecedor em vez do total do dia vê o painel e a
 * tendência de descarrego zerados, com a receita do mesmo mês aparecendo cheia.
 *
 * Cada lançamento é uma nota fiscal, não um caminhão. Quando o dia tem a
 * contagem real em `carros`, ela substitui a contagem de lançamentos (carros por
 * tipo e descargas de volume); peso, receita e caixas seguem dos lançamentos.
 */
export function diariosDosLancamentos(
  rs: (Pick<Receita, "data" | "tipo" | "quantidade" | "pesoKg" | "receita"> & { carros?: number | null })[],
  carros: CarrosDia[] = [],
): TotalDiarioDescarregamento[] {
  const porData = new Map<string, TotalDiarioDescarregamento>();
  for (const r of rs) {
    const d =
      porData.get(r.data) ??
      { id: `lancamentos-${r.data}`, data: r.data, descarregos: 0, porTipo: zeroTipos(), pesoKg: 0, pesoPorTipo: zeroTipos(), descargasVolume: 0, receita: 0, observacao: null };
    if (r.tipo === "volume") {
      d.porTipo!.volume += r.quantidade ?? 0;
      d.descargasVolume! += r.carros ?? 1; // carros informados no lançamento; sem, 1
    } else {
      d.porTipo![r.tipo] += 1;
      d.descarregos += 1;
    }
    d.pesoKg += r.pesoKg;
    d.pesoPorTipo![r.tipo] += r.pesoKg;
    d.receita += r.receita;
    porData.set(r.data, d);
  }
  for (const c of carros) {
    const d = porData.get(c.data);
    if (!d) continue; // contagem de carros sem lançamento no dia não tem o que corrigir
    for (const t of TIPOS_CARRO) d.porTipo![t] = c.porTipo[t];
    d.descarregos = TIPOS_CARRO.reduce((s, t) => s + c.porTipo[t], 0);
    d.descargasVolume = c.porTipo.volume;
  }
  return [...porData.values()];
}

/**
 * Soma os diários por mês. Carros = só os tipos de carro (batido/paletizado/
 * pal-rem); volume entra em `caixas`. Registro sem quebra por tipo (`porTipo ===
 * null`, lançamento antigo) não dá pra separar volume — o total gravado entra
 * como carros (melhor esforço) e não conta no mix.
 */
export function agregarPorMes(diarios: TotalDiarioDescarregamento[]): PontoDescarregoMensal[] {
  const porMes = new Map<string, PontoDescarregoMensal>();
  // Um dia com total do dia E lançamento por fornecedor conta como um dia só.
  const diasPorMes = new Map<string, Set<string>>();
  for (const d of diarios) {
    const mes = primeiroDiaDoMes(d.data);
    const p =
      porMes.get(mes) ??
      { mes, carros: 0, carrosDetalhados: 0, caixas: 0, pesoKg: 0, receita: 0, porTipo: zeroTipos(), pesoPorTipo: zeroTipos(), descargasVolume: 0, dias: 0 };
    p.pesoKg += d.pesoKg;
    if (d.pesoPorTipo) for (const t of TIPOS_DESCARREGAMENTO) p.pesoPorTipo[t] += d.pesoPorTipo[t];
    p.descargasVolume += d.descargasVolume ?? 0;
    p.receita += d.receita;
    const dias = diasPorMes.get(mes) ?? new Set<string>();
    dias.add(d.data);
    diasPorMes.set(mes, dias);
    p.dias = dias.size;
    if (d.porTipo) {
      for (const t of TIPOS_DESCARREGAMENTO) p.porTipo[t] += d.porTipo[t];
      const carrosDia = TIPOS_CARRO.reduce((s, t) => s + d.porTipo![t], 0);
      p.carros += carrosDia;
      p.carrosDetalhados += carrosDia;
      p.caixas += d.porTipo.volume;
    } else {
      p.carros += d.descarregos;
    }
    porMes.set(mes, p);
  }
  return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

/** Peso médio por carro (kg/carro) — 0 se não houve carro. */
export function pesoMedioPorCarro(p: { pesoKg: number; carros: number }): number {
  return p.carros > 0 ? p.pesoKg / p.carros : 0;
}

/** Receita média por carro (R$/carro) — 0 se não houve carro. */
export function receitaMediaPorCarro(p: { receita: number; carros: number }): number {
  return p.carros > 0 ? p.receita / p.carros : 0;
}

export interface TipoPredominante {
  tipo: DescarregamentoTipo | null; // null = mês sem quebra por tipo (só entre carros)
  carros: number;
  fracao: number; // 0..1 sobre carrosDetalhados
}

/** Tipo de CARRO com mais carros no mês (volume não entra — é caixa). */
export function tipoPredominante(p: PontoDescarregoMensal): TipoPredominante {
  let melhor: DescarregamentoTipo | null = null;
  let melhorQtd = 0;
  for (const t of TIPOS_CARRO) {
    if (p.porTipo[t] > melhorQtd) {
      melhorQtd = p.porTipo[t];
      melhor = t;
    }
  }
  return {
    tipo: melhor,
    carros: melhorQtd,
    fracao: p.carrosDetalhados > 0 ? melhorQtd / p.carrosDetalhados : 0,
  };
}

/** Composição do mês por tipo de CARRO, em fração (0..1) sobre os carros detalhados. */
export function mixFracao(p: PontoDescarregoMensal): Record<DescarregamentoTipo, number> {
  const base = p.carrosDetalhados;
  const r = zeroTipos();
  if (base <= 0) return r;
  for (const t of TIPOS_CARRO) r[t] = p.porTipo[t] / base;
  return r;
}

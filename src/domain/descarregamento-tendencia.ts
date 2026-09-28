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
 * A camada de dados (`src/data/descarregamento-mensal.ts`) puxa os diários e
 * chama `agregarPorMes`.
 */
import type { DescarregamentoTipo, TotalDiarioDescarregamento } from "./types";
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
  dias: number; // dias com lançamento
}

const zeroTipos = (): Record<DescarregamentoTipo, number> => ({
  batido: 0,
  paletizado: 0,
  pal_rem: 0,
  volume: 0,
});

/**
 * Soma os diários por mês. Carros = só os tipos de carro (batido/paletizado/
 * pal-rem); volume entra em `caixas`. Registro sem quebra por tipo (`porTipo ===
 * null`, lançamento antigo) não dá pra separar volume — o total gravado entra
 * como carros (melhor esforço) e não conta no mix.
 */
export function agregarPorMes(diarios: TotalDiarioDescarregamento[]): PontoDescarregoMensal[] {
  const porMes = new Map<string, PontoDescarregoMensal>();
  for (const d of diarios) {
    const mes = primeiroDiaDoMes(d.data);
    const p =
      porMes.get(mes) ??
      { mes, carros: 0, carrosDetalhados: 0, caixas: 0, pesoKg: 0, receita: 0, porTipo: zeroTipos(), dias: 0 };
    p.pesoKg += d.pesoKg;
    p.receita += d.receita;
    p.dias += 1;
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

// Custo para atender cada região: o custo logístico do mês dividido entre as
// regiões para onde a mercadoria saiu.
//
//   Entrega (motoristas, ajudantes, frota) → pelo KM rodado pelos caminhões em
//     cada região. KM da viagem = km do rastreador desde o dia da saída até a
//     véspera da próxima saída do mesmo caminhão (o caminhão muitas vezes roda
//     no dia seguinte, e a viagem do Sertão dura dias). Carga mista divide o km
//     pelo peso de cada região. Caminhão sem rastreador recebe a média de km por
//     viagem da região, medida nos que têm.
//   Galpão + Galpão Administrativo → pelo número de notas (cada nota é um pedido
//     separado e conferido). A retira (balcão) entra aqui: usa o galpão, não a frota.
//
// Região = regiao_operacional do calendário de rotas (mesma da Pedidos a
// Faturar); cidade fora do calendário cai na classificação por mesorregião.
import { classificarRegiao } from "./pe-regioes";
import { normalizarPlaca } from "./frota";
import { somarDias } from "./periodo";

export type RegiaoCusto = "RMR" | "Litoral" | "Zona da Mata" | "Agreste" | "Sertão" | "Outras" | "Retira";

export const ORDEM_REGIOES: RegiaoCusto[] = ["RMR", "Litoral", "Zona da Mata", "Agreste", "Sertão", "Outras", "Retira"];

/** Viagem que fica mais que isso sem nova saída: o resto é carro parado/oficina, não a viagem. */
export const JANELA_MAX_DIAS = 7;

const OPERACIONAL: Record<string, RegiaoCusto> = {
  METROPOLITANA: "RMR",
  LITORAL: "Litoral",
  MATA: "Zona da Mata",
  AGRESTE: "Agreste",
  SERTAO: "Sertão",
};

/** Região da cidade do cliente: calendário de rotas → senão mesorregião → senão Outras. */
export function regiaoDaCidade(
  cidade: string | null,
  uf: string | null,
  regiaoOperacional: (cidade: string | null) => string | null,
): RegiaoCusto {
  const op = regiaoOperacional(cidade);
  if (op) return OPERACIONAL[op] ?? "Outras";
  const meso = classificarRegiao(cidade, uf);
  return meso === "Outras" ? "Outras" : meso;
}

/** Pedaço de uma viagem que foi para uma região (ou nota de retira, com `viagem` null). */
export interface TrechoRegiao {
  viagem: string | null; // veículo+motorista+dia; null = retira
  placa: string | null;
  dia: string; // "yyyy-mm-dd" da saída
  regiao: RegiaoCusto;
  notas: number;
  peso: number;
  valor: number;
  entregas: number; // cliente distinto por dia
}

export interface BaseRegiao {
  regiao: RegiaoCusto;
  notas: number;
  peso: number;
  valor: number;
  entregas: number;
  viagens: number; // viagens equivalentes (carga mista conta fração pelo peso)
  kmMedido: number;
  kmEstimado: number; // viagens de caminhão sem rastreador
}

const vazia = (regiao: RegiaoCusto): BaseRegiao => ({
  regiao, notas: 0, peso: 0, valor: 0, entregas: 0, viagens: 0, kmMedido: 0, kmEstimado: 0,
});

interface Viagem {
  placa: string;
  dia: string;
  peso: number;
  partes: { regiao: RegiaoCusto; fracao: number }[];
}

function montarViagens(trechos: TrechoRegiao[]): Viagem[] {
  const por = new Map<string, TrechoRegiao[]>();
  for (const t of trechos) {
    if (t.viagem === null) continue;
    const l = por.get(t.viagem) ?? [];
    l.push(t);
    por.set(t.viagem, l);
  }
  return [...por.values()].map((ts) => {
    const peso = ts.reduce((s, t) => s + t.peso, 0);
    const notas = ts.reduce((s, t) => s + t.notas, 0);
    const soma = new Map<RegiaoCusto, number>();
    for (const t of ts) {
      const f = peso > 0 ? t.peso / peso : notas > 0 ? t.notas / notas : 1 / ts.length;
      soma.set(t.regiao, (soma.get(t.regiao) ?? 0) + f);
    }
    return {
      placa: normalizarPlaca(ts[0].placa),
      dia: ts[0].dia,
      peso,
      partes: [...soma].map(([regiao, fracao]) => ({ regiao, fracao })),
    };
  });
}

/**
 * Soma notas/peso/valor/entregas e o km por região. `kmDia` = "PLACA|dia" → km
 * (só dias com leitura válida, ver mapaKmDia); `fim` = último dia do período,
 * a janela da viagem não passa dele.
 */
export function baseDasRegioes(trechos: TrechoRegiao[], kmDia: Map<string, number>, fim: string): BaseRegiao[] {
  const base = new Map<RegiaoCusto, BaseRegiao>(ORDEM_REGIOES.map((r) => [r, vazia(r)]));
  for (const t of trechos) {
    const b = base.get(t.regiao)!;
    b.notas += t.notas;
    b.peso += t.peso;
    b.valor += t.valor;
    b.entregas += t.entregas;
  }

  const comRastreador = new Set([...kmDia.keys()].map((k) => k.split("|")[0]));
  const viagens = montarViagens(trechos);

  // Dias de saída por placa, para achar a próxima saída.
  const saidas = new Map<string, string[]>();
  for (const v of viagens) {
    if (!v.placa) continue;
    const l = saidas.get(v.placa) ?? [];
    if (!l.includes(v.dia)) l.push(v.dia);
    saidas.set(v.placa, l);
  }
  for (const l of saidas.values()) l.sort();

  // Peso de cada placa+dia (dois motoristas no mesmo carro no mesmo dia dividem o km).
  const pesoPlacaDia = new Map<string, { peso: number; n: number }>();
  for (const v of viagens) {
    const k = `${v.placa}|${v.dia}`;
    const p = pesoPlacaDia.get(k) ?? { peso: 0, n: 0 };
    p.peso += v.peso;
    p.n += 1;
    pesoPlacaDia.set(k, p);
  }

  const kmJanela = (placa: string, dia: string): number => {
    const dias = saidas.get(placa)!;
    const proxima = dias[dias.indexOf(dia) + 1];
    let limite = somarDias(dia, JANELA_MAX_DIAS - 1);
    if (proxima && somarDias(proxima, -1) < limite) limite = somarDias(proxima, -1);
    if (fim < limite) limite = fim;
    let km = 0;
    for (let d = dia; d <= limite; d = somarDias(d, 1)) km += kmDia.get(`${placa}|${d}`) ?? 0;
    return km;
  };

  const semRastreador: Viagem[] = [];
  for (const v of viagens) {
    for (const p of v.partes) base.get(p.regiao)!.viagens += p.fracao;
    if (!v.placa || !comRastreador.has(v.placa)) {
      semRastreador.push(v);
      continue;
    }
    const pd = pesoPlacaDia.get(`${v.placa}|${v.dia}`)!;
    const parte = pd.peso > 0 ? v.peso / pd.peso : 1 / pd.n;
    const km = kmJanela(v.placa, v.dia) * parte;
    for (const p of v.partes) base.get(p.regiao)!.kmMedido += km * p.fracao;
  }

  // Média de km por viagem medida em cada região → estimativa dos sem rastreador.
  const medidas = new Map<RegiaoCusto, number>();
  for (const v of viagens) {
    if (!v.placa || !comRastreador.has(v.placa)) continue;
    for (const p of v.partes) medidas.set(p.regiao, (medidas.get(p.regiao) ?? 0) + p.fracao);
  }
  const kmTot = [...base.values()].reduce((s, b) => s + b.kmMedido, 0);
  const vTot = [...medidas.values()].reduce((s, n) => s + n, 0);
  const mediaGeral = vTot > 0 ? kmTot / vTot : 0;
  for (const v of semRastreador) {
    for (const p of v.partes) {
      const b = base.get(p.regiao)!;
      const n = medidas.get(p.regiao) ?? 0;
      const media = n > 0 ? b.kmMedido / n : mediaGeral;
      b.kmEstimado += media * p.fracao;
    }
  }

  return ORDEM_REGIOES.map((r) => base.get(r)!).filter((b) => b.notas > 0 || b.kmMedido + b.kmEstimado > 0);
}

export interface CustoRegiao extends BaseRegiao {
  km: number;
  custoEntrega: number;
  custoGalpao: number; // galpão + galpão administrativo
  custo: number;
}

/** Divide o custo: entrega pelo km, galpão (+ administrativo) pelas notas. A soma bate com o total. */
export function ratearPorRegiao(base: BaseRegiao[], custoEntrega: number, custoGalpao: number): CustoRegiao[] {
  const km = base.reduce((s, b) => s + b.kmMedido + b.kmEstimado, 0);
  const notas = base.reduce((s, b) => s + b.notas, 0);
  return base.map((b) => {
    const kmR = b.kmMedido + b.kmEstimado;
    const e = km > 0 ? (custoEntrega * kmR) / km : 0;
    const g = notas > 0 ? (custoGalpao * b.notas) / notas : 0;
    return { ...b, km: kmR, custoEntrega: e, custoGalpao: g, custo: e + g };
  });
}

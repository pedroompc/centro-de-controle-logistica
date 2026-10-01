/**
 * Projeções do Recebimento — simulação de cenários, NÃO previsão estatística.
 *
 * O histórico é curto (desde julho/2026), então nada aqui ajusta tendência: a
 * base é o RITMO MÉDIO dos últimos meses fechados e cada cenário muda uma
 * alavanca (pessoas, carros por dia, crescimento) e recalcula receita, custo e
 * produtividade com as mesmas razões observadas (receita por carro, kg por
 * carro, dias de descarrego por mês).
 *
 * "Dar conta" compara DEMANDA com CAPACIDADE DEMONSTRADA:
 *  - demanda = o dia forte típico (percentil 90 dos dias com descarrego), que
 *    cresce com o cenário;
 *  - capacidade = o MAIOR dia que a equipe de hoje já fez ÷ pessoas = carros que
 *    cada uma já provou aguentar (pode ter sido com hora extra). Não é a
 *    capacidade máxima teórica.
 */
import type { TotalDiarioDescarregamento } from "./types";
import { TIPOS_CARRO } from "./descarregamento";
import type { IndicadoresRecebimento } from "./recebimento";

// --- Dia a dia ---------------------------------------------------------------

/** Carros por data (soma total do dia + lançamentos), mesma regra do agregado mensal. */
export function carrosPorDia(diarios: TotalDiarioDescarregamento[]): { data: string; carros: number }[] {
  const porData = new Map<string, number>();
  for (const d of diarios) {
    const carros = d.porTipo ? TIPOS_CARRO.reduce((s, t) => s + d.porTipo![t], 0) : d.descarregos;
    porData.set(d.data, (porData.get(d.data) ?? 0) + carros);
  }
  return [...porData.entries()]
    .map(([data, carros]) => ({ data, carros }))
    .filter((d) => d.carros > 0)
    .sort((a, b) => a.data.localeCompare(b.data));
}

/** Percentil (0..1) por interpolação linear; 0 para lista vazia. */
export function percentil(valores: number[], p: number): number {
  if (valores.length === 0) return 0;
  const v = [...valores].sort((a, b) => a - b);
  const pos = (v.length - 1) * p;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export interface PerfilDiario {
  dias: number;
  media: number; // carros por dia de descarrego
  p90: number; // dia forte típico
  pico: number; // maior dia
  diaPico: string | null;
}

export function perfilDiario(dias: { data: string; carros: number }[]): PerfilDiario {
  const v = dias.map((d) => d.carros);
  const pico = v.length ? Math.max(...v) : 0;
  return {
    dias: v.length,
    media: v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0,
    p90: percentil(v, 0.9),
    pico,
    diaPico: dias.find((d) => d.carros === pico)?.data ?? null,
  };
}

// --- Base: o ritmo atual -----------------------------------------------------

export interface BaseRitmo {
  meses: string[]; // meses fechados usados na média
  carrosMes: number;
  diasMes: number;
  pesoMes: number;
  receitaMes: number; // só descarrego
  faturamentoMes: number | null;
  receitaPorCarro: number;
  kgPorCarro: number;
  ajudantes: number;
  conferentes: number;
  custoMes: number; // custo total da equipe (folha + empilhador + empilhadeira)
  custoAjudante: number; // custo médio de 1 ajudante (para contratar/demitir)
  custoConferente: number;
}

const media = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

/**
 * Média dos últimos `n` meses FECHADOS com descarrego. A equipe e o custo vêm
 * do mês mais recente (é a estrutura que você tem hoje).
 */
export function baseDoRitmo(
  serie: IndicadoresRecebimento[],
  custoMedio: { ajudante: number; conferente: number },
  n = 3,
): BaseRitmo | null {
  const fechados = serie.filter((r) => r.fracaoMes >= 1 && r.carros > 0).slice(-n);
  if (fechados.length === 0) return null;
  const ultimo = serie[serie.length - 1];
  const carrosMes = media(fechados.map((r) => r.carros));
  const pesoMes = media(fechados.map((r) => r.pesoKg));
  const receitaMes = media(fechados.map((r) => r.receitaDescarrego));
  const fats = fechados.map((r) => r.faturamentoLiquido).filter((v): v is number => v !== null && v > 0);
  return {
    meses: fechados.map((r) => r.mes),
    carrosMes,
    diasMes: media(fechados.map((r) => r.diasDescarrego)),
    pesoMes,
    receitaMes,
    faturamentoMes: fats.length ? media(fats) : null,
    receitaPorCarro: carrosMes > 0 ? receitaMes / carrosMes : 0,
    kgPorCarro: carrosMes > 0 ? pesoMes / carrosMes : 0,
    ajudantes: ultimo.equipe.ajudantes,
    conferentes: ultimo.equipe.conferentes,
    custoMes: ultimo.equipe.custo,
    custoAjudante: custoMedio.ajudante,
    custoConferente: custoMedio.conferente,
  };
}

// --- Cenário -----------------------------------------------------------------

export interface Cenario {
  deltaAjudantes: number; // +1 contrata, −1 demite
  deltaConferentes: number;
  carrosExtrasDia: number; // carros a mais por dia de descarrego
  crescimentoMensal: number; // 0.01 = +1% de carros ao mês
  meses: number; // horizonte
}

export const CENARIO_ATUAL: Cenario = { deltaAjudantes: 0, deltaConferentes: 0, carrosExtrasDia: 0, crescimentoMensal: 0, meses: 12 };

export type Folga = "folga" | "no limite" | "não dá conta";

export interface Capacidade {
  porPessoaDia: number; // carros que 1 pessoa já provou aguentar num dia forte
  capacidadeDia: number; // com a equipe do cenário
  demandaDia: number; // dia forte projetado (p90 + extras + crescimento)
  uso: number; // demanda ÷ capacidade
  situacao: Folga;
  necessarios: number; // pessoas para o dia forte projetado
}

export interface MesProjetado {
  m: number; // 1..meses
  carros: number;
  pesoKg: number;
  receita: number;
  custo: number;
  resultado: number;
}

export interface Projecao {
  meses: MesProjetado[];
  mensal: {
    carros: number;
    carrosDia: number;
    pesoKg: number;
    receita: number;
    custo: number;
    resultado: number;
    custoSobreDescarrego: number | null;
    custoSobreFaturamento: number | null;
    kgPorAjudanteDia: number | null;
    carrosPorConferente: number | null;
  }; // o mês típico no FIM do horizonte
  anual: { receita: number; custo: number; resultado: number; carros: number; pesoKg: number };
  ajudantes: number;
  conferentes: number;
  ajudante: Capacidade;
  conferente: Capacidade;
}

function capacidade(pessoasHoje: number, pessoasCenario: number, picoHoje: number, demandaDia: number): Capacidade {
  const porPessoaDia = pessoasHoje > 0 ? picoHoje / pessoasHoje : 0;
  const capacidadeDia = porPessoaDia * pessoasCenario;
  const uso = capacidadeDia > 0 ? demandaDia / capacidadeDia : Infinity;
  return {
    porPessoaDia,
    capacidadeDia,
    demandaDia,
    uso,
    situacao: uso <= 0.85 ? "folga" : uso <= 1 ? "no limite" : "não dá conta",
    necessarios: porPessoaDia > 0 ? Math.ceil(demandaDia / porPessoaDia - 1e-9) : 0,
  };
}

/** Projeta o cenário mês a mês a partir do ritmo atual. */
export function projetar(base: BaseRitmo, perfil: PerfilDiario, c: Cenario): Projecao {
  const ajudantes = Math.max(0, base.ajudantes + c.deltaAjudantes);
  const conferentes = Math.max(0, base.conferentes + c.deltaConferentes);
  const custo = Math.max(0, base.custoMes + c.deltaAjudantes * base.custoAjudante + c.deltaConferentes * base.custoConferente);
  const fator = (m: number) => Math.pow(1 + c.crescimentoMensal, m);

  const meses: MesProjetado[] = [];
  for (let m = 1; m <= c.meses; m++) {
    const carros = base.carrosMes * fator(m) + c.carrosExtrasDia * base.diasMes;
    const receita = carros * base.receitaPorCarro;
    meses.push({ m, carros, pesoKg: carros * base.kgPorCarro, receita, custo, resultado: receita - custo });
  }
  const fim = meses[meses.length - 1];
  const soma = (k: keyof MesProjetado) => meses.reduce((t, x) => t + x[k], 0);

  // Dia forte projetado: o p90 de hoje crescendo no mesmo ritmo, + os extras.
  const demandaDia = perfil.p90 * fator(c.meses) + c.carrosExtrasDia;
  const fatFim = base.faturamentoMes === null ? null : base.faturamentoMes * fator(c.meses);

  return {
    meses,
    mensal: {
      carros: fim.carros,
      carrosDia: base.diasMes > 0 ? fim.carros / base.diasMes : 0,
      pesoKg: fim.pesoKg,
      receita: fim.receita,
      custo,
      resultado: fim.resultado,
      custoSobreDescarrego: fim.receita > 0 ? custo / fim.receita : null,
      custoSobreFaturamento: fatFim ? custo / fatFim : null,
      kgPorAjudanteDia: ajudantes > 0 && base.diasMes > 0 ? fim.pesoKg / ajudantes / base.diasMes : null,
      carrosPorConferente: conferentes > 0 ? fim.carros / conferentes : null,
    },
    anual: { receita: soma("receita"), custo: soma("custo"), resultado: soma("resultado"), carros: soma("carros"), pesoKg: soma("pesoKg") },
    ajudantes,
    conferentes,
    ajudante: capacidade(base.ajudantes, ajudantes, perfil.pico, demandaDia),
    conferente: capacidade(base.conferentes, conferentes, perfil.pico, demandaDia),
  };
}

/** Cenários prontos para a tabela "e se…". */
export const CENARIOS_RAPIDOS: { nome: string; cenario: Partial<Cenario> }[] = [
  { nome: "Contratar 1 ajudante", cenario: { deltaAjudantes: 1 } },
  { nome: "Demitir 1 ajudante", cenario: { deltaAjudantes: -1 } },
  { nome: "Contratar 1 conferente", cenario: { deltaConferentes: 1 } },
  { nome: "+1 carro por dia", cenario: { carrosExtrasDia: 1 } },
  { nome: "+2 carros por dia", cenario: { carrosExtrasDia: 2 } },
  { nome: "+2 carros/dia e +1 ajudante", cenario: { carrosExtrasDia: 2, deltaAjudantes: 1 } },
];

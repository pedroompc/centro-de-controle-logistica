import { porUnidade } from "./wms";
import { variacaoPercentual } from "./tendencias";

/*
 * Turnos do CD (definidos com o Pedro — docs/BACKLOG.md):
 *   Manhã 07:00–17:00 · Tarde 13:00–22:00 · Noite 22:00–07:00
 * Manhã e Tarde se SOBREPÕEM das 13h às 17h. Pelo horário do movimento não dá
 * para saber de qual turno foi quem fez, então essa janela vira uma faixa própria
 * em vez de ser atribuída (errado) a um dos dois.
 */
export interface FaixaTurno {
  id: "manha" | "sobreposicao" | "tarde" | "noite";
  rotulo: string;
  horas: number[]; // horas cheias (0–23) que caem na faixa
}

const intervalo = (de: number, ate: number) => Array.from({ length: ate - de }, (_, i) => de + i);

export const FAIXAS_TURNO: FaixaTurno[] = [
  { id: "manha", rotulo: "Manhã (07h–13h)", horas: intervalo(7, 13) },
  { id: "sobreposicao", rotulo: "Manhã + Tarde (13h–17h)", horas: intervalo(13, 17) },
  { id: "tarde", rotulo: "Tarde (17h–22h)", horas: intervalo(17, 22) },
  { id: "noite", rotulo: "Noite (22h–07h)", horas: [22, 23, ...intervalo(0, 7)] },
];

export interface ResumoFaixa {
  faixa: FaixaTurno;
  movimentos: number;
  participacao: number; // 0..1 do total com hora
  porHora: number; // média de movimentos por hora de relógio da faixa, por dia
}

/** Soma os movimentos por faixa de turno. `porHora` normaliza pelo tamanho da faixa e pelos dias. */
export function resumirTurnos(porHoraDoDia: number[], dias: number): ResumoFaixa[] {
  const total = porHoraDoDia.reduce((s, v) => s + v, 0);
  return FAIXAS_TURNO.map((faixa) => {
    const movimentos = faixa.horas.reduce((s, h) => s + (porHoraDoDia[h] ?? 0), 0);
    return {
      faixa,
      movimentos,
      participacao: porUnidade(movimentos, total),
      porHora: porUnidade(movimentos, faixa.horas.length * dias),
    };
  });
}

/** Hora cheia (0–23) com mais movimentos; `null` se não houve nenhum. */
export function horaDePico(porHoraDoDia: number[]): number | null {
  let pico: number | null = null;
  porHoraDoDia.forEach((v, h) => {
    if (v > 0 && (pico === null || v > porHoraDoDia[pico])) pico = h;
  });
  return pico;
}

/** Linha crua de produtividade de um operador num mês (vinda do SQL). */
export interface OperadorMes {
  usuario: number;
  nome: string;
  movimentos: number;
  verticais: number;
  horizontais: number;
  abastecimentos: number;
  armazenagens: number;
  dias: number; // dias distintos com pelo menos um movimento efetivado
}

export interface LinhaRanking extends OperadorMes {
  porDia: number; // movimentos por dia trabalhado — a métrica que ranqueia
  porDiaAnterior: number | null; // mesmo operador no mês anterior (null = não trabalhou)
  variacao: number | null; // fração vs mês anterior
  participacao: number; // 0..1 do total do mês
}

/**
 * Ranking por movimentos/dia trabalhado (não por total — quem trabalhou 10 dias
 * não pode perder para quem trabalhou 25 só por ter ficado menos tempo).
 * Operadores com menos de `minDias` dias vão para o fim: amostra pequena demais
 * para comparar ritmo.
 */
export function rankingOperadores(
  atual: OperadorMes[],
  anterior: OperadorMes[],
  minDias = 3,
): LinhaRanking[] {
  const total = atual.reduce((s, o) => s + o.movimentos, 0);
  const ant = new Map(anterior.map((o) => [o.usuario, o]));
  const linhas = atual.map((o) => {
    const porDia = porUnidade(o.movimentos, o.dias);
    const a = ant.get(o.usuario);
    const porDiaAnterior = a && a.dias > 0 ? a.movimentos / a.dias : null;
    return {
      ...o,
      porDia,
      porDiaAnterior,
      variacao: porDiaAnterior ? variacaoPercentual(porDia, porDiaAnterior) : null,
      participacao: porUnidade(o.movimentos, total),
    };
  });
  const amostraOk = (l: LinhaRanking) => l.dias >= minDias;
  return linhas.sort((a, b) =>
    Number(amostraOk(b)) - Number(amostraOk(a)) || b.porDia - a.porDia);
}

/** Mediana de movimentos/dia entre operadores com amostra suficiente — a régua da equipe. */
export function medianaEquipe(ranking: LinhaRanking[], minDias = 3): number {
  const v = ranking.filter((l) => l.dias >= minDias).map((l) => l.porDia).sort((a, b) => a - b);
  if (!v.length) return 0;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

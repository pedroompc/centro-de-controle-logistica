import { primeiroDiaDoMes, mesAnterior } from "./periodo";

/** Teto padrão (em minutos) acima do qual uma separação é tratada como tarefa esquecida aberta. */
export const TETO_SEPARACAO_MIN = 8 * 60;

export interface EstatisticaDuracao {
  qtd: number; // durações consideradas
  descartadas: number; // negativas, nulas ou acima do teto
  mediaMin: number;
  medianaMin: number;
  p90Min: number;
}

/** Percentil (0..1) por interpolação linear numa lista JÁ ORDENADA. 0 se vazia. */
export function percentil(ordenados: number[], p: number): number {
  if (!ordenados.length) return 0;
  const pos = (ordenados.length - 1) * p;
  const base = Math.floor(pos);
  const frac = pos - base;
  const prox = ordenados[base + 1] ?? ordenados[base];
  return ordenados[base] + (prox - ordenados[base]) * frac;
}

/**
 * Estatísticas do tempo de separação (minutos). Descarta durações negativas
 * (relógio/cadastro errado) e acima de `tetoMin` (tarefa esquecida em aberto),
 * informando quantas foram descartadas para o descarte nunca ficar invisível.
 */
export function estatisticaSeparacao(
  duracoesMin: number[],
  tetoMin: number = TETO_SEPARACAO_MIN,
): EstatisticaDuracao {
  const validas = duracoesMin.filter((d) => Number.isFinite(d) && d >= 0 && d <= tetoMin);
  const ordenados = [...validas].sort((a, b) => a - b);
  const soma = ordenados.reduce((s, d) => s + d, 0);
  return {
    qtd: ordenados.length,
    descartadas: duracoesMin.length - validas.length,
    mediaMin: ordenados.length ? soma / ordenados.length : 0,
    medianaMin: percentil(ordenados, 0.5),
    p90Min: percentil(ordenados, 0.9),
  };
}

/** Razão segura: numerador ÷ denominador, 0 se o denominador não for positivo. */
export function porUnidade(numerador: number, denominador: number): number {
  return denominador > 0 ? numerador / denominador : 0;
}

/**
 * Janela de `qtd` meses terminando no mês corrente (incluso), do mais antigo ao
 * mais novo. O último é o mês em andamento (parcial).
 */
export function janelaMeses(hoje: Date, qtd: number): string[] {
  let m = primeiroDiaDoMes(hoje);
  const lista: string[] = [];
  for (let i = 0; i < qtd; i++) {
    lista.push(m);
    m = mesAnterior(m);
  }
  return lista.reverse();
}

/** Movimentação de endereço do mês (HARPIAW2.MOVIMENT_END_502, só efetivadas). */
export interface MovimentoMes {
  verticais: number; // origem ou destino acima do nível 01 (exige empilhadeira)
  horizontais: number; // origem e destino no nível 01 (chão)
  abastecimentos: number; // TIPO S: pulmão → picking
  armazenagens: number; // TIPO E: recepção → posição
  internas: number; // TIPO I
  devolucoes: number; // TIPO D
  pesoKg: number; // Σ PESO_502
  skusMovimentados: number;
}

/** Cargas expedidas no mês (HARPIAW2.CARREG_VEIC_38). */
export interface CargasMes {
  cargas: number; // uma carga = unidade de separação; um caminhão pode levar várias
  viagens: number; // saídas de caminhão = placas distintas por dia (0 se a placa não vier preenchida)
  pesoKg: number;
  separacao: EstatisticaDuracao; // início da separação → início da conferência
  ciclo: EstatisticaDuracao; // início da separação → fechamento da carga
}

/** Separação por coletor no mês (HARPIAW2.PLAN_SEP_COLETOR_1275/1276). */
export interface ColetorMes {
  tarefas: number;
  separadores: number;
  minutos: number; // Σ duração das tarefas válidas
  linhas: number; // itens (endereço × mercadoria) separados
}

export interface PontoWms {
  mes: string; // 1º dia do mês, ISO
  // Peso faturado líquido do WinThor (o mesmo do dashboard) — denominador de
  // eficiência. `null` = WinThor indisponível para o mês.
  pesoFaturadoKg: number | null;
  mov: MovimentoMes;
  cargas: CargasMes;
  coletor: ColetorMes;
}

export const MOV_VAZIO: MovimentoMes = {
  verticais: 0, horizontais: 0, abastecimentos: 0, armazenagens: 0,
  internas: 0, devolucoes: 0, pesoKg: 0, skusMovimentados: 0,
};
export const COLETOR_VAZIO: ColetorMes = { tarefas: 0, separadores: 0, minutos: 0, linhas: 0 };

/** Movimentos de endereço (verticais + horizontais) por tonelada faturada. Sobe = mais manuseio por kg entregue. */
export function movimentosPorTonelada(p: PontoWms): number {
  return porUnidade(p.mov.verticais + p.mov.horizontais, (p.pesoFaturadoKg ?? 0) / 1000);
}

/** Abastecimentos (pulmão → picking) por carga expedida. */
export function abastecimentosPorCarga(p: PontoWms): number {
  return porUnidade(p.mov.abastecimentos, p.cargas.cargas);
}

/** Cargas por viagem: quanto cada saída de caminhão consolida. */
export function cargasPorViagem(c: CargasMes): number {
  return porUnidade(c.cargas, c.viagens);
}

/** Linhas separadas por hora de coletor (tempo em tarefa, não hora paga). */
export function linhasPorHora(c: ColetorMes): number {
  return porUnidade(c.linhas, c.minutos / 60);
}

/** Agrupa pares (mês, duração) por mês e calcula a estatística de cada um. */
export function estatisticaPorMes(
  linhas: { mes: string; minutos: number | null }[],
  tetoMin: number,
): Map<string, EstatisticaDuracao> {
  const porMes = new Map<string, number[]>();
  for (const l of linhas) {
    const lista = porMes.get(l.mes) ?? [];
    lista.push(l.minutos ?? NaN); // nulo = etapa sem registro → conta como descartada
    porMes.set(l.mes, lista);
  }
  const saida = new Map<string, EstatisticaDuracao>();
  for (const [mes, duracoes] of porMes) saida.set(mes, estatisticaSeparacao(duracoes, tetoMin));
  return saida;
}

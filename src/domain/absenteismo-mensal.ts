/**
 * Absenteísmo mês a mês — o comparativo de faltas ao longo do tempo. Ao
 * contrário do headcount, isto É reconstruível: cada falta tem data e tipo.
 * Meses sem falta entram como zero (dentro da janela rastreada, zero é zero de
 * verdade, não "não medido").
 */
import type { Falta, TipoFalta } from "./types";
import { TIPOS_AUSENCIA_REAL } from "./faltas-analise";
import { primeiroDiaDoMes } from "./periodo";

export interface PontoAbsenteismoMensal {
  mes: string; // "yyyy-mm-01"
  total: number; // ausências reais (injustificada + justificada + atestado)
  porTipo: Record<TipoFalta, number>; // todos os tipos, para o detalhamento
}

const zeroPorTipo = (): Record<TipoFalta, number> => ({
  justificada: 0,
  injustificada: 0,
  atestado: 0,
  folga: 0,
  ferias: 0,
});

/**
 * Agrega as faltas nos meses pedidos (lista de "yyyy-mm-01", já na ordem de
 * exibição). Faltas fora da janela são ignoradas; cada mês pedido aparece no
 * resultado, com zero se não houve falta.
 */
export function absenteismoPorMes(
  faltas: Falta[],
  meses: string[],
): PontoAbsenteismoMensal[] {
  const porMes = new Map<string, PontoAbsenteismoMensal>();
  for (const mes of meses) {
    porMes.set(mes, { mes, total: 0, porTipo: zeroPorTipo() });
  }
  for (const falta of faltas) {
    const mes = primeiroDiaDoMes(falta.data);
    const ponto = porMes.get(mes);
    if (!ponto) continue; // fora da janela pedida
    ponto.porTipo[falta.tipo] += 1;
    if (TIPOS_AUSENCIA_REAL.includes(falta.tipo)) ponto.total += 1;
  }
  return meses.map((mes) => porMes.get(mes)!);
}

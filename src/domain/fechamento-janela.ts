/**
 * Regra do "dia operacional" do faturamento (etapa 2 do card de fechamento).
 *
 * O faturamento não fecha à meia-noite: sobre a hora de autorização SEFAZ da
 * nota (PCNFSAID.DTHORAAUTORIZACAOSEFAZ) e o motorista da carga:
 *   • < 07h (madrugada)  → mesmo dia
 *   • 07–12h             → Eugênio (10059) mesmo dia; os outros no dia seguinte
 *   • ≥ 13h              → dia seguinte
 *
 * Espelha o CASE aplicado no SQL de `getFaturamentoOperacional`.
 */
export const EUGENIO = 10059;

/** Soma `dias` a uma data ISO (YYYY-MM-DD), em UTC para não escorregar por fuso. */
function somaDia(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Dia operacional (YYYY-MM-DD) de uma nota, dada a data-calendário da
 * autorização, a hora (0..23) e o motorista da carga (null se sem carga).
 */
export function diaOperacional(
  dataISO: string,
  hora: number,
  codMotorista: number | null,
  eugenio: number = EUGENIO,
): string {
  if (hora < 7) return dataISO;
  if (hora < 13) return codMotorista === eugenio ? dataISO : somaDia(dataISO, 1);
  return somaDia(dataISO, 1);
}

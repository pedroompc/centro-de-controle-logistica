import type { Turno } from "./types";

/**
 * Configuração dos turnos da Separação — o ÚNICO lugar para ajustar horários.
 *
 * Dia operacional: o trabalho entre 07:00 de D e 06:59 de D+1 é do dia D
 * (a noite que passa da meia-noite fica no dia em que começou).
 *
 * As janelas abaixo saíram do banco (horas de separação/conferência no Harpia,
 * ago–out/2026) e são REFERÊNCIA, não a regra oficial do RH. Quando o RH
 * confirmar, ajuste aqui e troque `TURNOS_VALIDADOS_RH` para true — o BI deixa
 * de mostrar o aviso "horários de referência".
 *
 * `inicio`/`fim` = janela usada para atribuir ao turno o trabalho SEM operador
 * registrado (hora cheia, fim exclusivo; noite atravessa a meia-noite). Elas
 * precisam cobrir as 24h sem sobrepor. `jornadaHoras` = horas de trabalho por
 * pessoa por dia, base das "horas disponíveis" (não há ponto no banco).
 */
export const CORTE_DIA_OPERACIONAL = 7;

export const TURNOS_VALIDADOS_RH = false;

export interface ConfigTurno {
  id: Turno;
  rotulo: string;
  inicio: number;
  fim: number;
  jornadaHoras: number;
  horarioObservado: string; // como o banco mostra o turno trabalhando (só informativo)
}

export const TURNOS_SEPARACAO: ConfigTurno[] = [
  { id: "manha", rotulo: "Manhã", inicio: 7, fim: 13, jornadaHoras: 8, horarioObservado: "07h–17h" },
  { id: "tarde", rotulo: "Tarde", inicio: 13, fim: 22, jornadaHoras: 8, horarioObservado: "13h–21h" },
  { id: "noite", rotulo: "Noite", inicio: 22, fim: 7, jornadaHoras: 8, horarioObservado: "22h–06h" },
];

const dentro = (h: number, t: ConfigTurno) => (t.inicio < t.fim ? h >= t.inicio && h < t.fim : h >= t.inicio || h < t.fim);

/** Turno da janela de horário que contém a hora (0–23). */
export function turnoDaHora(hora: number, turnos: ConfigTurno[] = TURNOS_SEPARACAO): Turno {
  const t = turnos.find((x) => dentro(hora, x));
  if (!t) throw new Error(`Hora ${hora} fora de todas as janelas de turno — revise TURNOS_SEPARACAO.`);
  return t.id;
}

/** Dia operacional ("yyyy-mm-dd") de um instante local: antes das 07h conta no dia anterior. */
export function diaOperacional(d: Date, corte = CORTE_DIA_OPERACIONAL): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours() - corte, d.getMinutes());
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** Fragmento Oracle: dia operacional de uma coluna DATE (constante do sistema, sem bind). */
export const sqlDiaOperacional = (col: string) => `TRUNC(${col} - ${CORTE_DIA_OPERACIONAL}/24)`;

/** Fragmento Oracle: col cai nos dias operacionais [:ini, :fim] (inclusive). */
export const sqlJanelaOperacional = (col: string) =>
  `${col} >= TO_DATE(:ini, 'YYYY-MM-DD') + ${CORTE_DIA_OPERACIONAL}/24 AND ${col} < TO_DATE(:fim, 'YYYY-MM-DD') + 1 + ${CORTE_DIA_OPERACIONAL}/24`;

export const configTurno = (id: Turno): ConfigTurno => TURNOS_SEPARACAO.find((t) => t.id === id)!;

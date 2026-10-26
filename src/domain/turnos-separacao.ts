import type { Turno } from "./types";

/**
 * Configuração dos turnos da Separação — o ÚNICO lugar para ajustar horários.
 *
 * Dia operacional: o trabalho entre 07:00 de D e 06:59 de D+1 é do dia D
 * (a noite que passa da meia-noite fica no dia em que começou).
 *
 * As janelas abaixo saíram do banco (horas de separação/conferência no Harpia,
 * ago–out/2026) e são REFERÊNCIA, não a regra oficial do RH. Quando o RH
 * confirmar, ajuste aqui.
 *
 * Na separação são DOIS turnos (decisão do Pedro, 26/10/2026): a separação de
 * dia só começa às 13h — antes disso a equipe da manhã faz abastecimento e
 * inventário. Manhã e tarde do cadastro formam o "Dia"; a noite segue igual.
 * O cadastro do RH não muda: só o BI agrupa.
 *
 * `inicio`/`fim` = janela usada para atribuir ao turno o trabalho SEM operador
 * registrado (hora cheia, fim exclusivo; noite atravessa a meia-noite). Elas
 * precisam cobrir as 24h sem sobrepor. O pouco conferido antes das 13h (~3%)
 * fica no Dia.
 *
 * `HORAS_NA_SEPARACAO` = horas por pessoa por dia EM SEPARAÇÃO, pelo turno do
 * cadastro — base das "horas disponíveis" (não há ponto no banco). Manhã conta
 * só das 13h ao fim do turno (07h–17h → 4h); o resto é abastecimento/inventário.
 * O custo NÃO segue essa regra: a folha inteira do cadastro fica na separação.
 */
export const CORTE_DIA_OPERACIONAL = 7;

/** Turno da separação no BI (o cadastro tem manhã/tarde/noite). */
export type TurnoSep = "dia" | "noite";

export interface ConfigTurno {
  id: TurnoSep;
  rotulo: string;
  inicio: number;
  fim: number;
  horarioObservado: string; // como o banco mostra o turno trabalhando (só informativo)
}

export const TURNOS_SEPARACAO: ConfigTurno[] = [
  { id: "dia", rotulo: "Dia", inicio: 7, fim: 22, horarioObservado: "13h–21h" },
  { id: "noite", rotulo: "Noite", inicio: 22, fim: 7, horarioObservado: "22h–06h" },
];

export const HORAS_NA_SEPARACAO: Record<Turno, number> = { manha: 4, tarde: 8, noite: 8 };

/** Turno da separação de quem tem esse turno no cadastro. */
export const turnoSepDoCadastro = (t: Turno): TurnoSep => (t === "noite" ? "noite" : "dia");

const dentro = (h: number, t: ConfigTurno) => (t.inicio < t.fim ? h >= t.inicio && h < t.fim : h >= t.inicio || h < t.fim);

/** Turno da janela de horário que contém a hora (0–23). */
export function turnoDaHora(hora: number, turnos: ConfigTurno[] = TURNOS_SEPARACAO): TurnoSep {
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

/** Fragmento Oracle: id do turno pela janela de horário da config (mesma regra de `turnoDaHora`). */
export const sqlTurnoDaHora = (colHora: string) =>
  `CASE ${TURNOS_SEPARACAO.map((t) => `WHEN ${t.inicio < t.fim ? `${colHora} >= ${t.inicio} AND ${colHora} < ${t.fim}` : `(${colHora} >= ${t.inicio} OR ${colHora} < ${t.fim})`} THEN '${t.id}'`).join(" ")} END`;

export const configTurno = (id: TurnoSep): ConfigTurno => TURNOS_SEPARACAO.find((t) => t.id === id)!;

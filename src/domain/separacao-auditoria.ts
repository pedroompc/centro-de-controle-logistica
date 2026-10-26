/**
 * Checagem de dado do BI da Separação: separador com horário no Harpia fora do
 * turno do cadastro (alerta da aba Turnos).
 */
import { turnoDaHora, type TurnoSep } from "./turnos-separacao";
import type { LinhaSep } from "./separacao";

export interface DivergenciaTurno {
  usuario: number;
  cadastro: TurnoSep;
  horario: TurnoSep; // turno da janela que contém a hora mediana de início das páginas
  horaMediana: number;
  linhas: number;
}

/**
 * Separadores cujo horário registrado no Harpia não cai no turno do cadastro
 * (ex.: separa de madrugada e está cadastrado no dia). Sinal de cadastro de
 * turno desatualizado — distorce o comparativo entre turnos.
 */
export function turnosDivergentes(linhas: LinhaSep[], turnoDoUsuario: Map<number, TurnoSep>): DivergenciaTurno[] {
  const horas = new Map<number, { hora: number; peso: number }[]>();
  for (const l of linhas) {
    if (l.usuario === null) continue;
    horas.set(l.usuario, [...(horas.get(l.usuario) ?? []), { hora: l.hora, peso: l.linhas }]);
  }
  const out: DivergenciaTurno[] = [];
  for (const [usuario, hs] of horas) {
    const cadastro = turnoDoUsuario.get(usuario);
    if (!cadastro) continue;
    const ord = [...hs].sort((a, b) => a.hora - b.hora);
    const total = ord.reduce((t, x) => t + x.peso, 0);
    let acc = 0;
    const mediana = ord.find((x) => (acc += x.peso) >= total / 2)!.hora;
    const horario = turnoDaHora(mediana);
    if (horario !== cadastro) out.push({ usuario, cadastro, horario, horaMediana: mediana, linhas: total });
  }
  return out.sort((a, b) => b.linhas - a.linhas);
}

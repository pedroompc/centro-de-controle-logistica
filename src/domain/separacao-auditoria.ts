/**
 * Auditoria do BI da Separação: o que confere, o que diverge e o que falta.
 * Cada item diz o FATO (número do banco) — hipótese de causa só quando o
 * próprio dado mostra (ex.: venda balcão sem carga no Winthor).
 */
import { turnoDaHora } from "./turnos-separacao";
import type { DiaSep, LinhaSep, MapaSep } from "./separacao";
import type { Turno } from "./types";

export interface DivergenciaTurno {
  usuario: number;
  cadastro: Turno;
  horario: Turno; // turno da janela que contém a hora mediana de início das páginas
  horaMediana: number;
  linhas: number;
}

/**
 * Separadores cujo horário registrado no Harpia não cai no turno do cadastro
 * (ex.: separa 13h–21h e está cadastrado como manhã). Sinal de cadastro de
 * turno desatualizado — distorce o comparativo entre turnos.
 */
export function turnosDivergentes(linhas: LinhaSep[], turnoDoUsuario: Map<number, Turno>): DivergenciaTurno[] {
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

export interface ConfrontoDia {
  dia: string;
  pedidosHarpia: number;
  pedidosWinthor: number;
  kgHarpia: number;
  kgWinthor: number;
}

/** Pedidos e kg por dia operacional: Harpia (guias, peso do cadastro) × Winthor (DTFINALSEP, TOTPESO) na filial 1. */
export function confrontoDiario(dias: DiaSep[], kgPorDia: Map<string, number>, winthor: { dia: string; filial: string; pedidos: number; kg: number }[]): ConfrontoDia[] {
  const w = new Map<string, { pedidos: number; kg: number }>();
  for (const x of winthor) {
    if (x.filial !== "1") continue;
    const a = w.get(x.dia) ?? { pedidos: 0, kg: 0 };
    a.pedidos += x.pedidos;
    a.kg += x.kg;
    w.set(x.dia, a);
  }
  const todos = [...new Set([...dias.map((d) => d.dia), ...w.keys()])].sort();
  const porDia = new Map(dias.map((d) => [d.dia, d]));
  return todos.map((dia) => ({
    dia,
    pedidosHarpia: porDia.get(dia)?.pedidos ?? 0,
    pedidosWinthor: w.get(dia)?.pedidos ?? 0,
    kgHarpia: kgPorDia.get(dia) ?? 0,
    kgWinthor: w.get(dia)?.kg ?? 0,
  }));
}

/** Diferença relativa (a − b) ÷ b; null se b = 0. */
export const diferenca = (a: number, b: number): number | null => (b > 0 ? (a - b) / b : null);

/** Dias úteis (seg–sex) do mês até `ate` (inclusive) sem nenhum mapa — sem produção OU sem dado. */
export function diasUteisSemProducao(mes: string, dias: DiaSep[], ate: string): string[] {
  const com = new Set(dias.filter((d) => d.mapas > 0).map((d) => d.dia));
  const [a, m] = mes.split("-").map(Number);
  const n = new Date(a, m, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= n; d++) {
    const iso = `${mes.slice(0, 8)}${String(d).padStart(2, "0")}`;
    if (iso > ate) break;
    const dow = new Date(a, m - 1, d).getDay();
    if (dow !== 0 && dow !== 6 && !com.has(iso)) out.push(iso);
  }
  return out;
}

export interface LinhasPorTipo {
  tipo: number;
  rotulo: string;
  mapas: number;
  linhas: number;
  comSeparador: number;
}

const ROTULO_TIPO: Record<number, string> = { 0: "Consolidado por carga (0)", 8: "Consolidado por carga (8)", 3: "Venda balcão (3)", 4: "Por cliente (4)" };

/** Linhas e cobertura do registro de separador por tipo de mapa. */
export function linhasPorTipo(linhas: LinhaSep[], mapas: MapaSep[]): LinhasPorTipo[] {
  const tipo = new Map(mapas.map((m) => [m.mapa, m.tipo]));
  const acc = new Map<number, { mapas: Set<number>; linhas: number; comSeparador: number }>();
  for (const l of linhas) {
    const t = tipo.get(l.mapa) ?? -1;
    const a = acc.get(t) ?? { mapas: new Set<number>(), linhas: 0, comSeparador: 0 };
    a.mapas.add(l.mapa);
    a.linhas += l.linhas;
    if (l.usuario !== null) a.comSeparador += l.linhas;
    acc.set(t, a);
  }
  return [...acc.entries()]
    .map(([t, a]) => ({ tipo: t, rotulo: ROTULO_TIPO[t] ?? `Tipo ${t}`, mapas: a.mapas.size, linhas: a.linhas, comSeparador: a.comSeparador }))
    .sort((a, b) => b.linhas - a.linhas);
}

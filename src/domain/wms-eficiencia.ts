import { porUnidade, estatisticaSeparacao, type EstatisticaDuracao } from "./wms";
import { FAIXAS_TURNO, type FaixaTurno } from "./wms-operacao";

/*
 * Painel de eficiência do galpão (/galpao): um mês, recortado por turno e
 * aprofundado por clique (turno → dia → operador). Cada clique vira um filtro
 * e TODOS os blocos da tela são recalculados com ele, como num BI.
 *
 * Turno pelo horário (FAIXAS_TURNO): Manhã 07–13, Manhã+Tarde 13–17, Tarde 17–22,
 * Noite 22–07. A Noite atravessa a meia-noite: o que acontece entre 00h e 06h59
 * pertence ao turno que COMEÇOU no dia anterior.
 */

export type IdFaixa = FaixaTurno["id"];

const FAIXA_DA_HORA: IdFaixa[] = Array.from({ length: 24 }, (_, h) =>
  FAIXAS_TURNO.find((f) => f.horas.includes(h))!.id);

export function faixaDaHora(hora: number): IdFaixa {
  return FAIXA_DA_HORA[hora];
}

/** Dia a que o turno pertence: madrugada (00h–06h) conta para a Noite do dia anterior. */
export function diaDoTurno(dia: string, hora: number): string {
  if (hora >= 7) return dia;
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Movimentos de endereço agregados por dia × hora × operador (vindos do SQL). */
export interface MovHoraOperador {
  dia: string; // dia do calendário (YYYY-MM-DD)
  hora: number | null; // null = movimento sem hora de efetivação
  usuario: number | null;
  nome: string;
  verticais: number;
  horizontais: number;
}

/** Uma carga separada: início da separação e o que ela levou. */
export interface CargaSeparada {
  carga: string;
  dia: string; // dia do início da separação
  hora: number | null; // null = início sem hora registrada
  minutos: number | null; // início da separação → início da conferência
  skus: number; // produtos distintos na carga
  pesoKg: number;
}

/** Filtros do drill-down. Ausente = sem filtro naquela dimensão. */
export interface FiltroEficiencia {
  faixa?: IdFaixa;
  dia?: string; // dia do TURNO
  usuario?: number;
}

interface Chaveado {
  faixa: IdFaixa;
  diaTurno: string;
}

const chavear = <T extends { dia: string; hora: number | null }>(l: T): (T & Chaveado) | null =>
  l.hora === null ? null : { ...l, faixa: faixaDaHora(l.hora), diaTurno: diaDoTurno(l.dia, l.hora) };

export interface ResumoMovimento {
  verticais: number;
  horizontais: number;
  turnos: number; // turnos com movimento (faixa × dia) — denominador do "por turno"
  verticaisPorTurno: number;
  horizontaisPorTurno: number;
}

export interface ResumoSeparacao {
  cargas: number;
  tempo: EstatisticaDuracao;
  mediaSkus: number;
  mediaPesoKg: number;
  turnos: number;
  cargasPorTurno: number;
}

export interface Fatia {
  movimento: ResumoMovimento;
  separacao: ResumoSeparacao;
}

export interface LinhaOperador {
  usuario: number | null;
  nome: string;
  verticais: number;
  horizontais: number;
  turnos: number;
  porTurno: number; // (verticais + horizontais) ÷ turnos trabalhados
}

export interface PainelEficiencia {
  geral: Fatia; // com todos os filtros aplicados
  porFaixa: { faixa: FaixaTurno; fatia: Fatia }[]; // ignora o filtro de faixa, respeita os demais
  porDia: { dia: string; fatia: Fatia }[]; // ignora o filtro de dia
  operadores: LinhaOperador[]; // ignora o filtro de operador
  cargas: CargaSeparada[]; // cargas do recorte, mais lentas primeiro
  movSemHora: number; // fora do painel por não ter hora (não dá para saber o turno)
  cargasSemHora: number;
}

function resumoMovimento(linhas: (MovHoraOperador & Chaveado)[]): ResumoMovimento {
  const turnos = new Set(linhas.map((l) => `${l.faixa}|${l.diaTurno}`)).size;
  const verticais = linhas.reduce((s, l) => s + l.verticais, 0);
  const horizontais = linhas.reduce((s, l) => s + l.horizontais, 0);
  return {
    verticais,
    horizontais,
    turnos,
    verticaisPorTurno: porUnidade(verticais, turnos),
    horizontaisPorTurno: porUnidade(horizontais, turnos),
  };
}

export function resumoSeparacao(cargas: (CargaSeparada & Chaveado)[], tetoMin: number): ResumoSeparacao {
  const turnos = new Set(cargas.map((c) => `${c.faixa}|${c.diaTurno}`)).size;
  return {
    cargas: cargas.length,
    tempo: estatisticaSeparacao(cargas.map((c) => c.minutos ?? NaN), tetoMin),
    mediaSkus: porUnidade(cargas.reduce((s, c) => s + c.skus, 0), cargas.length),
    mediaPesoKg: porUnidade(cargas.reduce((s, c) => s + c.pesoKg, 0), cargas.length),
    turnos,
    cargasPorTurno: porUnidade(cargas.length, turnos),
  };
}

/**
 * Monta o painel de um mês (`mes` = 'YYYY-MM-01'). As linhas podem vir de uma
 * janela maior (a madrugada do dia 1º do mês seguinte fecha a última Noite);
 * aqui fica só o que pertence a turnos do mês.
 *
 * O filtro de operador não se aplica à separação: a carga não registra quem separou.
 */
export function montarPainel(
  mes: string,
  movs: MovHoraOperador[],
  cargasBrutas: CargaSeparada[],
  filtro: FiltroEficiencia,
  tetoMin: number,
): PainelEficiencia {
  const doMes = (d: string) => d.slice(0, 7) === mes.slice(0, 7);
  const semHora = movs.filter((m) => m.hora === null && doMes(m.dia));
  const mov = movs.map(chavear).filter((m): m is MovHoraOperador & Chaveado => !!m && doMes(m.diaTurno));
  const car = cargasBrutas.map(chavear).filter((c): c is CargaSeparada & Chaveado => !!c && doMes(c.diaTurno));

  const passa = (l: Chaveado & { usuario?: number | null }, ignorar: keyof FiltroEficiencia | null) =>
    (ignorar === "faixa" || !filtro.faixa || l.faixa === filtro.faixa) &&
    (ignorar === "dia" || !filtro.dia || l.diaTurno === filtro.dia) &&
    (ignorar === "usuario" || filtro.usuario === undefined || !("usuario" in l) || l.usuario === filtro.usuario);

  const fatia = (ignorar: keyof FiltroEficiencia | null, extra: (l: Chaveado) => boolean = () => true): Fatia => ({
    movimento: resumoMovimento(mov.filter((l) => passa(l, ignorar) && extra(l))),
    separacao: resumoSeparacao(car.filter((c) => passa(c, ignorar) && extra(c)), tetoMin),
  });

  const dias = [...new Set([...mov, ...car].map((l) => l.diaTurno))].sort();

  const porOperador = new Map<string, (MovHoraOperador & Chaveado)[]>();
  for (const l of mov.filter((x) => passa(x, "usuario"))) {
    const k = String(l.usuario);
    porOperador.set(k, [...(porOperador.get(k) ?? []), l]);
  }
  const operadores: LinhaOperador[] = [...porOperador.values()].map((ls) => {
    const r = resumoMovimento(ls);
    return {
      usuario: ls[0].usuario,
      nome: ls[0].nome,
      verticais: r.verticais,
      horizontais: r.horizontais,
      turnos: r.turnos,
      porTurno: porUnidade(r.verticais + r.horizontais, r.turnos),
    };
  }).sort((a, b) => b.verticais + b.horizontais - (a.verticais + a.horizontais));

  const cargas = car
    .filter((c) => passa(c, null))
    .sort((a, b) => (b.minutos ?? -1) - (a.minutos ?? -1));

  return {
    geral: fatia(null),
    porFaixa: FAIXAS_TURNO.map((f) => ({ faixa: f, fatia: fatia("faixa", (l) => l.faixa === f.id) })),
    porDia: dias.map((d) => ({ dia: d, fatia: fatia("dia", (l) => l.diaTurno === d) })),
    operadores,
    cargas,
    movSemHora: semHora.reduce((s, m) => s + m.verticais + m.horizontais, 0),
    cargasSemHora: cargasBrutas.filter((c) => c.hora === null && doMes(c.dia)).length,
  };
}

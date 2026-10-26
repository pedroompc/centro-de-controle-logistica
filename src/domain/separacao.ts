/**
 * Separação — regras do BI do setor. Fórmulas documentadas em
 * docs/bi-separacao/indicadores.md (cada número da tela tem lá a sua consulta
 * de validação). Tudo aqui é puro: recebe linhas já lidas do Harpia/cadastro.
 *
 * Vocabulário (não são sinônimos):
 * - LINHA de separação = linha do mapa no Harpia (PLAN_SEP_MAPA_MERC_1196):
 *   um produto a apanhar. Em mapa por cliente é produto × cliente; em mapa
 *   consolidado por carga é produto × carga (apanha uma vez para a carga toda).
 * - CAIXA = caixa fechada; UNIDADE = caixas × un/caixa do cadastro + avulsas.
 * - PEDIDO = guia do mapa (PLAN_SEP_MAPA_GUIAS_1198); CARGA = carregamento.
 * - SKU = produto distinto.
 */
import { normalizarTexto, ehCargoEmpilhador } from "./recebimento";
import { configTurno, turnoDaHora, TURNOS_SEPARACAO, type ConfigTurno } from "./turnos-separacao";
import type { Turno } from "./types";

export type PapelSeparacao = "separador" | "conferente" | "maquina" | "lider" | "outros";

export function ehSetorSeparacao(nome: string): boolean {
  return normalizarTexto(nome).includes("separa");
}

/** Mesmo setor, ignorando acento/caixa ("SEPARAÇÃO" = "Separacao"). */
export function mesmoSetor(a: string, b: string): boolean {
  return normalizarTexto(a) === normalizarTexto(b);
}

export function papelSeparacao(cargo: string): PapelSeparacao {
  const c = normalizarTexto(cargo);
  if (c.includes("confer")) return "conferente";
  if (ehCargoEmpilhador(cargo) || c.includes("operador")) return "maquina";
  if (c.includes("lider") || c.includes("encarreg") || c.includes("supervis") || c.includes("coorden")) return "lider";
  if (c.includes("separ") || c.includes("ajudante") || c.includes("auxiliar")) return "separador";
  return "outros";
}

export interface PontoCustoSetor {
  mes: string; // "yyyy-mm-01"
  pessoas: number | null; // null = mês sem foto
  folha: number | null;
}

/**
 * Custo do setor mês a mês: a foto mensal do efetivo (folha dos ativos) e, no
 * mês corrente, o cadastro vivo. Mês sem foto fica sem valor (não inventa).
 */
export function serieCustoSetor(
  meses: string[],
  fotos: { mes: string; ativos: number; custoAtivos: number }[],
  atual: string,
  hoje: { pessoas: number; folha: number },
): PontoCustoSetor[] {
  const porMes = new Map(fotos.map((f) => [f.mes, f]));
  return meses.map((mes) => {
    if (mes === atual) return { mes, pessoas: hoje.pessoas, folha: hoje.folha };
    const f = porMes.get(mes);
    return { mes, pessoas: f ? f.ativos : null, folha: f ? f.custoAtivos : null };
  });
}

// --- Fatos lidos do Harpia ----------------------------------------------------

/** Linhas do mapa agrupadas por (mapa, separador, hora). `usuario` null = página sem separador registrado. */
export interface LinhaSep {
  mapa: number;
  dia: string; // dia operacional do mapa (1ª conferência − 7h)
  usuario: number | null;
  hora: number; // hora do início da página (com separador) ou da 1ª conferência do mapa (sem)
  linhas: number;
  caixas: number;
  unidades: number;
  kg: number; // unidades × peso bruto do cadastro (estimado, não é balança)
}

/** Pedidos e clientes de cada mapa (guias). */
export interface MapaSep {
  mapa: number;
  dia: string;
  tipo: number; // TIPO_SEPARACAO_1195: 0/8 consolidado por carga, 3 balcão, 4 por cliente
  pedidos: number;
  clientes: number;
}

/** Distintos no dia operacional (pedido/cliente/carga contam 1 vez no dia). */
export interface DiaSep {
  dia: string;
  pedidos: number;
  clientes: number;
  cargas: number;
  mapas: number;
}

export type OrigemErro = "separador" | "conferente" | "sem_origem";

/** Bloqueios da conferência (PLAN_SEP_MAPA_MERC_ERRO_1199) agrupados. */
export interface ErroSep {
  mapa: number;
  dia: string;
  usuario: number | null; // separador da linha — só quando a atribuição é inequívoca
  hora: number;
  origem: OrigemErro;
  ocorrencias: number; // bloqueios
  itens: number; // itens (mapa × produto × pedido) distintos afetados — 1 item conta 1 vez
  unidades: number; // |carga − bipado|
  falta: number; // ocorrências com bipado < carga
  sobra: number; // ocorrências com bipado > carga
}

/** Página separada por alguém (início/fim em ms). */
export interface PaginaSep {
  usuario: number;
  dia: string;
  ini: number;
  fim: number;
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

// --- Totais e custo -----------------------------------------------------------

export interface TotaisProducao {
  linhas: number;
  caixas: number;
  unidades: number;
  kg: number;
  pedidos: number;
  clientesDia: number; // soma dos clientes distintos de cada dia (PDV atendido por dia)
  cargas: number;
  mapas: number;
  dias: number; // dias operacionais com separação
  linhasComSeparador: number;
}

/** Totais do recorte (dia = null → mês todo). */
export function totaisProducao(linhas: LinhaTurno[], dias: DiaSep[], dia: string | null = null): TotaisProducao {
  const t: TotaisProducao = { linhas: 0, caixas: 0, unidades: 0, kg: 0, pedidos: 0, clientesDia: 0, cargas: 0, mapas: 0, dias: 0, linhasComSeparador: 0 };
  for (const l of linhas) {
    if (dia && l.dia !== dia) continue;
    t.linhas += l.linhas;
    t.caixas += l.caixas;
    t.unidades += l.unidades;
    t.kg += l.kg;
    if (l.comSeparador) t.linhasComSeparador += l.linhas;
  }
  for (const d of dias) {
    if (dia && d.dia !== dia) continue;
    t.pedidos += d.pedidos;
    t.clientesDia += d.clientes;
    t.cargas += d.cargas;
    t.mapas += d.mapas;
    if (d.mapas > 0) t.dias += 1;
  }
  return t;
}

/**
 * Custo do período. Mesma regra do BI do Abastecimento: no mês corrente o
 * custo mensal entra proporcional aos dias corridos (`fracao` = dia de hoje ÷
 * dias do mês); mês fechado, fração 1. Recorte de 1 dia = custo do período ÷
 * dias operacionais com separação.
 */
export function custoDoPeriodo(custoMes: number | null, fracao: number, diasComSeparacao: number, diaFiltrado: boolean): number | null {
  if (custoMes === null) return null;
  const periodo = custoMes * fracao;
  if (!diaFiltrado) return periodo;
  return diasComSeparacao > 0 ? periodo / diasComSeparacao : null;
}

export function custosUnitarios(custo: number | null, t: Pick<TotaisProducao, "pedidos" | "linhas" | "kg" | "caixas">) {
  if (custo === null) return { porPedido: null, porLinha: null, porTonelada: null, porCaixa: null };
  return { porPedido: div(custo, t.pedidos), porLinha: div(custo, t.linhas), porTonelada: div(custo, t.kg / 1000), porCaixa: div(custo, t.caixas) };
}

/** Custo ÷ faturamento líquido (custo já proporcional ao período). */
export function custoSobreFaturamento(custoPeriodo: number | null, faturamentoLiquido: number | null): number | null {
  return custoPeriodo === null || !faturamentoLiquido || faturamentoLiquido <= 0 ? null : custoPeriodo / faturamentoLiquido;
}

// --- Qualidade ----------------------------------------------------------------

export interface ResumoErros {
  ocorrencias: number;
  itens: number;
  unidades: number;
  falta: number; // ocorrências
  sobra: number;
}

const vazioErros = (): ResumoErros => ({ ocorrencias: 0, itens: 0, unidades: 0, falta: 0, sobra: 0 });

/** Erros por origem gravada no Harpia (S = separador, C = conferente). */
export function resumoErros(erros: Pick<ErroSep, "dia" | "origem" | "ocorrencias" | "itens" | "unidades" | "falta" | "sobra">[], dia: string | null = null): Record<OrigemErro, ResumoErros> {
  const r: Record<OrigemErro, ResumoErros> = { separador: vazioErros(), conferente: vazioErros(), sem_origem: vazioErros() };
  for (const e of erros) {
    if (dia && e.dia !== dia) continue;
    const x = r[e.origem];
    x.ocorrencias += e.ocorrencias;
    x.itens += e.itens;
    x.unidades += e.unidades;
    x.falta += e.falta;
    x.sobra += e.sobra;
  }
  return r;
}

/** Itens com erro a cada 1.000 linhas separadas. */
export function porMilLinhas(itens: number, linhas: number): number | null {
  return linhas > 0 ? (itens / linhas) * 1000 : null;
}

// --- Turno --------------------------------------------------------------------

export type RegraTurno = "operador" | "horario";

const CONSOLIDADO = new Set([0, 8]);

/**
 * Turno de um trabalho: com separador registrado e ligado a um funcionário,
 * vale o turno do CADASTRO dele (hora extra conta pro turno da pessoa); sem
 * separador (ou sem ligação), vale a janela de horário da config.
 */
export function atribuirTurno(usuario: number | null, hora: number, turnoDoUsuario: Map<number, Turno>): { turno: Turno; regra: RegraTurno } {
  const t = usuario !== null ? turnoDoUsuario.get(usuario) : undefined;
  return t ? { turno: t, regra: "operador" } : { turno: turnoDaHora(hora), regra: "horario" };
}

/**
 * Produção já com turno resolvido, agregada por (dia, turno, origem do dado) e
 * SEM o separador — é o que vai para a tela. Pedidos e clientes de cada mapa
 * entram rateados pelas linhas de cada parte (a soma fecha o total do mapa).
 */
export interface LinhaTurno {
  dia: string;
  turno: Turno;
  regra: RegraTurno;
  comSeparador: boolean;
  consolidado: boolean; // mapa consolidado por carga (tipo 0/8)
  linhas: number;
  caixas: number;
  unidades: number;
  kg: number;
  pedidos: number; // rateio
  clientes: number; // rateio
}

export interface ErroTurno {
  dia: string;
  turno: Turno;
  atribuido: boolean; // erro ligado a um separador registrado sem ambiguidade
  origem: OrigemErro;
  ocorrencias: number;
  itens: number;
  unidades: number;
  falta: number;
  sobra: number;
}

/**
 * Resolve o turno no SERVIDOR e descarta o id do separador e o mapa: quem não
 * é admin recebe só o agregado por (dia, turno), nunca o trabalho de uma pessoa.
 */
export function resolverTurnos(linhas: LinhaSep[], erros: ErroSep[], mapas: MapaSep[], turnoDoUsuario: Map<number, Turno>): { linhas: LinhaTurno[]; erros: ErroTurno[] } {
  const totalMapa = new Map<number, number>();
  for (const l of linhas) totalMapa.set(l.mapa, (totalMapa.get(l.mapa) ?? 0) + l.linhas);
  const infoMapa = new Map(mapas.map((m) => [m.mapa, m]));
  const lm = new Map<string, LinhaTurno>();
  for (const l of linhas) {
    const { turno, regra } = atribuirTurno(l.usuario, l.hora, turnoDoUsuario);
    const comSeparador = l.usuario !== null;
    const m = infoMapa.get(l.mapa);
    const consolidado = m ? CONSOLIDADO.has(m.tipo) : false;
    const k = `${l.dia}|${turno}|${regra}|${comSeparador}|${consolidado}`;
    const a = lm.get(k) ?? { dia: l.dia, turno, regra, comSeparador, consolidado, linhas: 0, caixas: 0, unidades: 0, kg: 0, pedidos: 0, clientes: 0 };
    const share = l.linhas / (totalMapa.get(l.mapa) || 1);
    a.linhas += l.linhas;
    a.caixas += l.caixas;
    a.unidades += l.unidades;
    a.kg += l.kg;
    a.pedidos += (m?.pedidos ?? 0) * share;
    a.clientes += (m?.clientes ?? 0) * share;
    lm.set(k, a);
  }
  const em = new Map<string, ErroTurno>();
  for (const e of erros) {
    const { turno } = atribuirTurno(e.usuario, e.hora, turnoDoUsuario);
    const atribuido = e.usuario !== null;
    const k = `${e.dia}|${turno}|${atribuido}|${e.origem}`;
    const a = em.get(k) ?? { dia: e.dia, turno, atribuido, origem: e.origem, ocorrencias: 0, itens: 0, unidades: 0, falta: 0, sobra: 0 };
    a.ocorrencias += e.ocorrencias;
    a.itens += e.itens;
    a.unidades += e.unidades;
    a.falta += e.falta;
    a.sobra += e.sobra;
    em.set(k, a);
  }
  return { linhas: [...lm.values()], erros: [...em.values()] };
}

export interface EquipeTurno {
  pessoas: number;
  separadores: number;
  conferentes: number;
  custoMes: number; // folha do cadastro do turno (sem equipamentos)
}

export interface ResumoTurno {
  turno: Turno;
  rotulo: string;
  config: ConfigTurno;
  equipe: EquipeTurno;
  linhas: number;
  caixas: number;
  unidades: number;
  kg: number;
  pedidos: number; // rateio: pedidos do mapa × (linhas do turno no mapa ÷ linhas do mapa)
  clientes: number; // mesmo rateio
  dias: number; // dias operacionais com linha do turno
  linhasComSeparador: number; // linhas com separador registrado no Harpia (cobertura)
  linhasPorOperador: number; // linhas atribuídas pelo separador do cadastro
  linhasPorHorario: number; // linhas atribuídas pela janela de horário
  horasDisponiveis: number | null; // separadores × jornada × dias (estimativa — sem ponto)
  linhasPorHora: number | null;
  kgPorHora: number | null;
  pedidosPorHora: number | null;
  linhasPorSeparadorDia: number | null;
  custo: number | null; // custo do período rateado pela folha do turno
  custoPorPedido: number | null;
  custoPorLinha: number | null;
  custoPorTonelada: number | null;
  participacaoLinhas: number | null;
  participacaoCusto: number | null;
  errosSeparador: number; // itens com erro de origem S
  errosPorMil: number | null;
  kgPorLinha: number | null; // perfil do trabalho: linhas mais pesadas/leves
  unidadesPorLinha: number | null;
  mapasConsolidados: number | null; // % das linhas em mapa consolidado por carga (0/8)
}

/**
 * Comparativo entre turnos. Custo do turno = custo do período × (folha do
 * turno ÷ folha do setor) — rateio pela folha do cadastro; equipamentos ficam
 * fora (não têm turno) e aparecem separados na tela.
 */
export function resumoPorTurno(args: {
  linhas: LinhaTurno[];
  erros: ErroTurno[];
  equipe: Record<Turno, EquipeTurno>;
  custoFolhaPeriodo: number | null; // folha do setor × fração (sem equipamentos)
  dia?: string | null;
}): ResumoTurno[] {
  const { linhas, erros, equipe, custoFolhaPeriodo, dia = null } = args;
  const sel = linhas.filter((l) => !dia || l.dia === dia);
  const base = () => ({ linhas: 0, caixas: 0, unidades: 0, kg: 0, pedidos: 0, clientes: 0, comSeparador: 0, porOperador: 0, porHorario: 0, consolidadas: 0, dias: new Set<string>(), erros: 0 });
  const acc = new Map<Turno, ReturnType<typeof base>>(TURNOS_SEPARACAO.map((t) => [t.id, base()]));
  for (const l of sel) {
    const a = acc.get(l.turno)!;
    a.linhas += l.linhas;
    a.caixas += l.caixas;
    a.unidades += l.unidades;
    a.kg += l.kg;
    a.dias.add(l.dia);
    if (l.comSeparador) a.comSeparador += l.linhas;
    if (l.regra === "operador") a.porOperador += l.linhas;
    else a.porHorario += l.linhas;
    a.pedidos += l.pedidos;
    a.clientes += l.clientes;
    if (l.consolidado) a.consolidadas += l.linhas;
  }
  for (const e of erros) {
    if (e.origem !== "separador" || (dia && e.dia !== dia)) continue;
    acc.get(e.turno)!.erros += e.itens;
  }
  const totLinhas = [...acc.values()].reduce((t, a) => t + a.linhas, 0);
  const folhaTotal = TURNOS_SEPARACAO.reduce((t, x) => t + equipe[x.id].custoMes, 0);
  return TURNOS_SEPARACAO.map((cfg) => {
    const a = acc.get(cfg.id)!;
    const eq = equipe[cfg.id];
    const dias = a.dias.size;
    const horas = eq.separadores > 0 && dias > 0 ? eq.separadores * cfg.jornadaHoras * dias : null;
    const custo = custoFolhaPeriodo !== null && folhaTotal > 0 ? custoFolhaPeriodo * (eq.custoMes / folhaTotal) : null;
    return {
      turno: cfg.id,
      rotulo: cfg.rotulo,
      config: cfg,
      equipe: eq,
      linhas: a.linhas,
      caixas: a.caixas,
      unidades: a.unidades,
      kg: a.kg,
      pedidos: a.pedidos,
      clientes: a.clientes,
      dias,
      linhasComSeparador: a.comSeparador,
      linhasPorOperador: a.porOperador,
      linhasPorHorario: a.porHorario,
      horasDisponiveis: horas,
      linhasPorHora: horas ? a.linhas / horas : null,
      kgPorHora: horas ? a.kg / horas : null,
      pedidosPorHora: horas ? a.pedidos / horas : null,
      linhasPorSeparadorDia: eq.separadores > 0 && dias > 0 ? a.linhas / eq.separadores / dias : null,
      custo,
      custoPorPedido: custo !== null ? div(custo, a.pedidos) : null,
      custoPorLinha: custo !== null ? div(custo, a.linhas) : null,
      custoPorTonelada: custo !== null ? div(custo, a.kg / 1000) : null,
      participacaoLinhas: div(a.linhas, totLinhas),
      participacaoCusto: custo !== null && custoFolhaPeriodo ? custo / custoFolhaPeriodo : null,
      errosSeparador: a.erros,
      errosPorMil: porMilLinhas(a.erros, a.linhas),
      kgPorLinha: div(a.kg, a.linhas),
      unidadesPorLinha: div(a.unidades, a.linhas),
      mapasConsolidados: div(a.consolidadas, a.linhas),
    };
  });
}

export type CriterioTurno = "producao" | "linhasPorHora" | "linhasPorSeparadorDia" | "custoPorPedido" | "custoPorTonelada" | "qualidade" | "equilibrio";

/**
 * Melhor turno em cada critério (só turnos com produção e equipe). Equilíbrio
 * = menor soma das posições em linhas/hora, custo/linha e erros/mil — critério
 * transparente, sem pesos inventados. Empate ou só 1 turno válido → null.
 */
export function rankingTurnos(r: ResumoTurno[]): Record<CriterioTurno, Turno | null> {
  const validos = r.filter((x) => x.linhas > 0 && x.equipe.separadores > 0);
  const melhor = (v: (x: ResumoTurno) => number | null, maior: boolean): Turno | null => {
    const c = validos.map((x) => ({ t: x.turno, v: v(x) })).filter((x): x is { t: Turno; v: number } => x.v !== null);
    if (c.length < 2) return null;
    const alvo = maior ? Math.max(...c.map((x) => x.v)) : Math.min(...c.map((x) => x.v));
    const vencedores = c.filter((x) => x.v === alvo);
    return vencedores.length === 1 ? vencedores[0].t : null;
  };
  const posicao = (v: (x: ResumoTurno) => number | null, maior: boolean) => {
    const ord = validos.filter((x) => v(x) !== null).sort((a, b) => (maior ? v(b)! - v(a)! : v(a)! - v(b)!));
    return new Map(ord.map((x, i) => [x.turno, i + 1]));
  };
  const p1 = posicao((x) => x.linhasPorHora, true);
  const p2 = posicao((x) => x.custoPorLinha, false);
  const p3 = posicao((x) => x.errosPorMil, false);
  const soma = (x: ResumoTurno) => (p1.has(x.turno) && p2.has(x.turno) && p3.has(x.turno) ? p1.get(x.turno)! + p2.get(x.turno)! + p3.get(x.turno)! : null);
  return {
    producao: melhor((x) => x.linhas, true),
    linhasPorHora: melhor((x) => x.linhasPorHora, true),
    linhasPorSeparadorDia: melhor((x) => x.linhasPorSeparadorDia, true),
    custoPorPedido: melhor((x) => x.custoPorPedido, false),
    custoPorTonelada: melhor((x) => x.custoPorTonelada, false),
    qualidade: melhor((x) => x.errosPorMil, false),
    equilibrio: melhor(soma, false),
  };
}

// --- Operadores ---------------------------------------------------------------

/** Horas cobertas pela união dos intervalos (páginas abertas em paralelo não somam 2x). */
export function horasUniao(intervalos: { ini: number; fim: number }[]): number {
  const v = intervalos.filter((i) => i.fim > i.ini).sort((a, b) => a.ini - b.ini);
  let total = 0;
  let ini = -Infinity;
  let fim = -Infinity;
  for (const i of v) {
    if (i.ini > fim) {
      if (fim > ini) total += fim - ini;
      ini = i.ini;
      fim = i.fim;
    } else if (i.fim > fim) fim = i.fim;
  }
  if (fim > ini) total += fim - ini;
  return total / 3_600_000;
}

export interface ResumoSeparador {
  usuario: number;
  turno: Turno | null; // do cadastro; null = sem funcionário ligado
  dias: number;
  horasAtivas: number; // união das páginas registradas (tempo com página aberta)
  linhas: number;
  caixas: number;
  unidades: number;
  kg: number;
  linhasPorHora: number | null;
  kgPorHora: number | null;
  linhasPorDia: number | null;
  kgPorLinha: number | null; // perfil (complexidade): linha pesada rende menos linha/hora
  erros: number; // itens com erro de origem S atribuídos sem ambiguidade
  errosPorMil: number | null;
  amostraSuficiente: boolean;
}

/** Mínimo para entrar em ranking: dias e horas com página registrada. */
export const AMOSTRA_MINIMA = { dias: 3, horas: 10 };

/** Por separador registrado no Harpia (só quem tem página com nome). */
export function porSeparador(linhas: LinhaSep[], paginas: PaginaSep[], erros: ErroSep[], turnoDoUsuario: Map<number, Turno>): ResumoSeparador[] {
  const m = new Map<number, { linhas: number; caixas: number; unidades: number; kg: number; erros: number }>();
  for (const l of linhas) {
    if (l.usuario === null) continue;
    const r = m.get(l.usuario) ?? { linhas: 0, caixas: 0, unidades: 0, kg: 0, erros: 0 };
    r.linhas += l.linhas;
    r.caixas += l.caixas;
    r.unidades += l.unidades;
    r.kg += l.kg;
    m.set(l.usuario, r);
  }
  for (const e of erros) {
    if (e.origem !== "separador" || e.usuario === null) continue;
    const r = m.get(e.usuario);
    if (r) r.erros += e.itens;
  }
  const porDia = new Map<number, Map<string, { ini: number; fim: number }[]>>();
  for (const p of paginas) {
    const d = porDia.get(p.usuario) ?? new Map();
    d.set(p.dia, [...(d.get(p.dia) ?? []), p]);
    porDia.set(p.usuario, d);
  }
  return [...m.entries()]
    .map(([usuario, r]) => {
      const d = porDia.get(usuario) ?? new Map<string, { ini: number; fim: number }[]>();
      const horas = [...d.values()].reduce((t, iv) => t + horasUniao(iv), 0);
      const dias = d.size;
      return {
        usuario,
        turno: turnoDoUsuario.get(usuario) ?? null,
        dias,
        horasAtivas: horas,
        ...r,
        linhasPorHora: div(r.linhas, horas),
        kgPorHora: div(r.kg, horas),
        linhasPorDia: div(r.linhas, dias),
        kgPorLinha: div(r.kg, r.linhas),
        errosPorMil: porMilLinhas(r.erros, r.linhas),
        amostraSuficiente: dias >= AMOSTRA_MINIMA.dias && horas >= AMOSTRA_MINIMA.horas,
      };
    })
    .sort((a, b) => b.linhas - a.linhas);
}

/** Média ponderada de linhas/hora de um grupo (Σ linhas ÷ Σ horas), só de quem tem amostra. */
export function linhasPorHoraDoGrupo(s: ResumoSeparador[]): number | null {
  const ok = s.filter((x) => x.amostraSuficiente);
  return div(
    ok.reduce((t, x) => t + x.linhas, 0),
    ok.reduce((t, x) => t + x.horasAtivas, 0),
  );
}

export type SinalOperador = "evolucao" | "queda" | "atencao" | null;

/**
 * Sinal para o gestor olhar (não é conclusão): ±10% de linhas/hora contra o
 * próprio mês anterior, ou abaixo de 80% da média do turno COM perfil de
 * linha parecido (kg/linha até 25% acima da média — linha mais pesada justifica
 * ritmo menor). Sem amostra mínima, sem sinal.
 */
export function sinalOperador(atual: ResumoSeparador, anterior: ResumoSeparador | null, mediaTurno: number | null, kgPorLinhaTurno: number | null): SinalOperador {
  if (!atual.amostraSuficiente || atual.linhasPorHora === null) return null;
  if (anterior?.amostraSuficiente && anterior.linhasPorHora) {
    const v = atual.linhasPorHora / anterior.linhasPorHora - 1;
    if (v >= 0.1) return "evolucao";
    if (v <= -0.1) return "queda";
  }
  const perfilParecido = atual.kgPorLinha === null || kgPorLinhaTurno === null || atual.kgPorLinha <= kgPorLinhaTurno * 1.25;
  if (mediaTurno && perfilParecido && atual.linhasPorHora < mediaTurno * 0.8) return "atencao";
  return null;
}

export const rotuloTurno = (t: Turno) => configTurno(t).rotulo;

// --- Conferência --------------------------------------------------------------

export interface ConferenciaDia {
  dia: string;
  usuario: number;
  bipagens: number;
  unidades: number;
  mapas: number;
  horas: number; // 1ª à última bipagem do dia operacional (inclui pausas)
}

export interface ResumoConferente {
  usuario: number;
  dias: number;
  bipagens: number;
  unidades: number;
  mapas: number;
  horas: number;
  unidadesPorHora: number | null; // só dos dias com 1h+ na doca (dia curto distorce a taxa)
}

export function porConferente(linhas: ConferenciaDia[]): ResumoConferente[] {
  const m = new Map<number, ResumoConferente & { un1h: number; h1h: number }>();
  for (const l of linhas) {
    const r = m.get(l.usuario) ?? { usuario: l.usuario, dias: 0, bipagens: 0, unidades: 0, mapas: 0, horas: 0, unidadesPorHora: null, un1h: 0, h1h: 0 };
    r.dias += 1;
    r.bipagens += l.bipagens;
    r.unidades += l.unidades;
    r.mapas += l.mapas;
    r.horas += l.horas;
    if (l.horas >= 1) {
      r.un1h += l.unidades;
      r.h1h += l.horas;
    }
    m.set(l.usuario, r);
  }
  return [...m.values()]
    .map(({ un1h, h1h, ...r }) => ({ ...r, unidadesPorHora: div(un1h, h1h) }))
    .sort((a, b) => b.unidades - a.unidades);
}

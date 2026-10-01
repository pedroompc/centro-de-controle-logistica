/**
 * Recebimento — produtividade e custo da equipe que descarrega e confere.
 *
 * As médias são DA EQUIPE (peso do mês ÷ pessoas), não por pessoa: o lançamento
 * de descarrego não registra quem descarregou ou conferiu cada carro.
 *
 * A equipe sai do setor "Recebimento" e o papel sai do CARGO (texto livre no
 * cadastro): "ajudante" e "conferente" são casados por trecho, sem acento e sem
 * diferenciar maiúsculas ("Aj." não casa — o cadastro tem que dizer "Ajudante").
 */
import type { Funcionario } from "./types";

export type GrupoCargo = "ajudante" | "conferente" | "outros";

export const GRUPOS_CARGO: readonly GrupoCargo[] = ["ajudante", "conferente", "outros"];

/** minúsculo, sem acento, sem espaço nas pontas. */
export function normalizarTexto(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export function grupoDoCargo(cargo: string): GrupoCargo {
  const c = normalizarTexto(cargo);
  if (c.includes("ajudante")) return "ajudante";
  if (c.includes("conferente")) return "conferente";
  return "outros";
}

/** O setor do recebimento no cadastro (nome contendo "recebimento"). */
export function ehSetorRecebimento(nome: string): boolean {
  return normalizarTexto(nome).includes("recebimento");
}

export interface LinhaEquipeCargo {
  grupo: GrupoCargo;
  ativos: number;
  custoAtivos: number;
}

export interface EquipeRecebimento {
  setor: string | null; // nome do setor no cadastro (null = não achou)
  total: number; // ativos
  ajudantes: number;
  conferentes: number;
  custo: number; // custo mensal TOTAL (folha + empilhador + empilhadeira) — base de todas as razões
  empilhadores?: number; // operador de empilhadeira somado à equipe (0 ou 1)
  custoEmpilhador?: number; // folha do operador somado (0 se já estava no setor)
  custoEmpilhadeira?: number; // a máquina
}

export const EQUIPE_VAZIA: EquipeRecebimento = { setor: null, total: 0, ajudantes: 0, conferentes: 0, custo: 0 };

/** Ativos do setor Recebimento agrupados por cargo, a partir do cadastro vivo. */
export function linhasEquipePorCargo(
  funcionarios: Funcionario[],
  setores: { id: string; nome: string }[],
): { setor: string | null; linhas: LinhaEquipeCargo[] } {
  const setor = setores.find((s) => ehSetorRecebimento(s.nome));
  if (!setor) return { setor: null, linhas: [] };
  const linhas = GRUPOS_CARGO.map((grupo) => ({ grupo, ativos: 0, custoAtivos: 0 }));
  for (const f of funcionarios) {
    if (f.setorId !== setor.id || f.status !== "ativo") continue;
    const l = linhas.find((x) => x.grupo === grupoDoCargo(f.cargo))!;
    l.ativos += 1;
    l.custoAtivos += f.custoMensal;
  }
  return { setor: setor.nome, linhas };
}

// --- Empilhador + empilhadeira ----------------------------------------------

/** Custo mensal de 1 empilhadeira (informado pelo gestor em out/2026). */
export const CUSTO_EMPILHADEIRA_MENSAL = 6000;

/** Operador de empilhadeira: cargo com "máquina" ou "empilhad" (sem acento/caixa). */
export function ehCargoEmpilhador(cargo: string): boolean {
  const c = normalizarTexto(cargo);
  return c.includes("maquina") || c.includes("empilhad");
}

export interface EmpilhadorCadastro {
  candidatos: number; // ativos com cargo de operador, em qualquer setor
  custo: number; // custo de UM operador (média dos candidatos)
  jaNoSetor: boolean; // algum já está no setor Recebimento (já somado na folha)
}

/**
 * O recebimento usa 1 empilhador e 1 empilhadeira. O operador pode estar
 * cadastrado em outro setor; se houver vários com o cargo, entra o custo de UM
 * (a média). Se já estiver no setor Recebimento, a folha do setor já o tem.
 */
export function empilhadorDoCadastro(
  funcionarios: Funcionario[],
  setores: { id: string; nome: string }[],
): EmpilhadorCadastro {
  const idsRecebimento = new Set(setores.filter((s) => ehSetorRecebimento(s.nome)).map((s) => s.id));
  const ops = funcionarios.filter((f) => f.status === "ativo" && ehCargoEmpilhador(f.cargo));
  return {
    candidatos: ops.length,
    custo: ops.length > 0 ? ops.reduce((t, f) => t + f.custoMensal, 0) / ops.length : 0,
    jaNoSetor: ops.some((f) => idsRecebimento.has(f.setorId)),
  };
}

/** Soma à equipe o empilhador (se ainda não está nela) e a empilhadeira. */
export function comEmpilhador(e: EquipeRecebimento, op: EmpilhadorCadastro): EquipeRecebimento {
  if (e.total === 0) return e; // sem setor Recebimento: não inventa equipe
  const somaOperador = op.candidatos > 0 && !op.jaNoSetor;
  const custoEmpilhador = somaOperador ? op.custo : 0;
  return {
    ...e,
    total: e.total + (somaOperador ? 1 : 0),
    empilhadores: op.candidatos > 0 ? 1 : 0,
    custoEmpilhador,
    custoEmpilhadeira: CUSTO_EMPILHADEIRA_MENSAL,
    custo: e.custo + custoEmpilhador + CUSTO_EMPILHADEIRA_MENSAL,
  };
}

/**
 * Equipe de um mês: a foto por cargo, se o mês fechado tiver; senão a equipe de
 * HOJE inteira (estimativa). Nunca mistura fontes — total, cargos e folha vêm
 * da mesma foto, senão a soma dos cargos não bate com o total.
 */
export function equipeDoMes(
  mes: string,
  mesAtual: string,
  fotoCargo: { setor: string; linhas: LinhaEquipeCargo[] } | undefined,
  equipeHoje: EquipeRecebimento,
): { equipe: EquipeRecebimento; estimada: boolean } {
  if (mes === mesAtual) return { equipe: equipeHoje, estimada: false };
  if (fotoCargo) return { equipe: equipeDasLinhas(fotoCargo.setor, fotoCargo.linhas), estimada: false };
  return { equipe: equipeHoje, estimada: true };
}

/** Soma as linhas por cargo na equipe do mês. */
export function equipeDasLinhas(setor: string | null, linhas: LinhaEquipeCargo[]): EquipeRecebimento {
  const de = (g: GrupoCargo) => linhas.filter((l) => l.grupo === g).reduce((t, l) => t + l.ativos, 0);
  return {
    setor,
    total: linhas.reduce((t, l) => t + l.ativos, 0),
    ajudantes: de("ajudante"),
    conferentes: de("conferente"),
    custo: linhas.reduce((t, l) => t + l.custoAtivos, 0),
  };
}

/**
 * Quanto do mês já correu (0..1): 1 para mês fechado; no mês corrente, dia de
 * hoje ÷ dias do mês. Serve para comparar a folha (que é do mês cheio) com
 * receita e faturamento, que no mês corrente ainda são parciais.
 */
export function fracaoDoMes(mesISO: string, hoje = new Date()): number {
  const [ano, mes] = mesISO.split("-").map(Number);
  const atual = hoje.getFullYear() * 12 + hoje.getMonth();
  const alvo = ano * 12 + (mes - 1);
  if (alvo < atual) return 1;
  if (alvo > atual) return 0;
  const diasNoMes = new Date(ano, mes, 0).getDate();
  return hoje.getDate() / diasNoMes;
}

export interface IndicadoresRecebimento {
  mes: string;
  equipe: EquipeRecebimento;
  equipeEstimada: boolean; // true = mês passado sem foto por cargo (usa a equipe de hoje)
  diasDescarrego: number;
  carros: number;
  pesoKg: number;
  receitaDescarrego: number; // só descarrego (fornecedor + total do dia), sem diversas
  faturamentoLiquido: number | null; // null = Winthor/foto indisponível
  fracaoMes: number;
  custoPeriodo: number; // folha proporcional ao que já correu do mês
  kgPorAjudante: number | null;
  kgPorAjudanteDia: number | null;
  carrosPorConferente: number | null;
  kgPorConferente: number | null;
  custoSobreFaturamento: number | null; // 0..1
  custoSobreDescarrego: number | null; // 0..1
  custoPorTonelada: number | null; // R$/t
  kgPorCarro: number | null;
  carrosPorDia: number | null;
  receitaPorTonelada: number | null; // R$/t só de descarrego
  resultado: number; // receita de descarrego − custo do período
  margem: number | null; // resultado ÷ receita de descarrego (0..1)
}

const div = (a: number, b: number): number | null => (b > 0 ? a / b : null);

export function calcularIndicadores(p: {
  mes: string;
  equipe: EquipeRecebimento;
  equipeEstimada: boolean;
  diasDescarrego: number;
  carros: number;
  pesoKg: number;
  receitaDescarrego: number;
  faturamentoLiquido: number | null;
  fracaoMes: number;
}): IndicadoresRecebimento {
  const custoPeriodo = p.equipe.custo * p.fracaoMes;
  const kgPorAjudante = div(p.pesoKg, p.equipe.ajudantes);
  return {
    ...p,
    custoPeriodo,
    kgPorAjudante,
    kgPorAjudanteDia: kgPorAjudante === null ? null : div(kgPorAjudante, p.diasDescarrego),
    carrosPorConferente: div(p.carros, p.equipe.conferentes),
    kgPorConferente: div(p.pesoKg, p.equipe.conferentes),
    custoSobreFaturamento: p.faturamentoLiquido === null ? null : div(custoPeriodo, p.faturamentoLiquido),
    custoSobreDescarrego: div(custoPeriodo, p.receitaDescarrego),
    custoPorTonelada: div(custoPeriodo, p.pesoKg / 1000),
    kgPorCarro: div(p.pesoKg, p.carros),
    carrosPorDia: div(p.carros, p.diasDescarrego),
    receitaPorTonelada: div(p.receitaDescarrego, p.pesoKg / 1000),
    resultado: p.receitaDescarrego - custoPeriodo,
    margem: div(p.receitaDescarrego - custoPeriodo, p.receitaDescarrego),
  };
}

// --- Melhor do trimestre ------------------------------------------------------

/**
 * Compara valores de meses e diz quais são o MELHOR da janela (para pintar de
 * verde). `maiorEhBom` decide a direção (custo % baixo é bom). Só entra mês
 * FECHADO — o corrente é parcial e ganharia ou perderia por falta de dias — e
 * só há destaque com pelo menos 2 meses comparáveis. Empate destaca todos.
 */
export function indicesMelhores(
  itens: { valor: number | null; fechado: boolean }[],
  maiorEhBom: boolean,
): Set<number> {
  const validos = itens
    .map((it, i) => ({ ...it, i }))
    .filter((it): it is { valor: number; fechado: boolean; i: number } => it.fechado && it.valor !== null);
  if (validos.length < 2) return new Set();
  const alvo = maiorEhBom ? Math.max(...validos.map((v) => v.valor)) : Math.min(...validos.map((v) => v.valor));
  return new Set(validos.filter((v) => v.valor === alvo).map((v) => v.i));
}

/** Os indicadores que têm "melhor" (dias de descarrego não: mais dias não é melhor nem pior). */
export const DIRECAO_INDICADOR = {
  kgPorAjudante: true,
  kgPorAjudanteDia: true,
  carrosPorConferente: true,
  kgPorConferente: true,
  custoSobreFaturamento: false,
  custoSobreDescarrego: false,
  custoPorTonelada: false,
  carrosPorDia: true,
  receitaPorTonelada: true,
  resultado: true,
  margem: true,
} as const satisfies Partial<Record<keyof IndicadoresRecebimento, boolean>>;

export type IndicadorComparavel = keyof typeof DIRECAO_INDICADOR;

/** O mês `mes` é o melhor da janela `serie` neste indicador? */
export function ehMelhorDaJanela(serie: IndicadoresRecebimento[], mes: string, chave: IndicadorComparavel): boolean {
  const i = serie.findIndex((r) => r.mes === mes);
  if (i < 0) return false;
  return indicesMelhores(
    serie.map((r) => ({ valor: r[chave], fechado: r.fracaoMes >= 1 })),
    DIRECAO_INDICADOR[chave],
  ).has(i);
}

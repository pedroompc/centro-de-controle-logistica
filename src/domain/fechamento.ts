import type { ResumoFaturamento } from "./faturamento";
import { taxaDevolucao } from "./faturamento";
import { INICIO_HISTORICO } from "./periodo";

/** Resumo consolidado do dia/período para a arte de fechamento. */
export interface ResumoFechamento {
  isPeriodo: boolean;
  // Vindos do Winthor — null quando indisponível (fora da rede).
  faturamentoBruto: number | null;
  pdvsAtendidos: number | null;
  notasEmitidas: number | null;
  pesoFaturadoKg: number | null;
  taxaDevolucaoMes: number | null; // 0..1
  devolucaoMesValor: number | null; // R$ devolvido no mês (mesma base da taxa)
  devolucaoMesPesoKg: number | null; // kg devolvido no mês
  // Vindos do Supabase — sempre disponíveis.
  receitasLogisticas: number;
  faltas: number;
  faltasSetores: string[]; // setores com falta no período, do mais para o menos
}

/**
 * Faturamento do período já pela JANELA OPERACIONAL (etapa 2). É uma visão
 * enxuta — o operacional não produz um `ResumoFaturamento` completo.
 */
export interface FaturamentoPeriodoView {
  vendaFaturada: number;
  atendimentos: number;
  emitidas: number;
  pesoFaturadoKg: number;
}

export function montarResumoFechamento(input: {
  ini: string;
  fim: string;
  faturamentoPeriodo: FaturamentoPeriodoView | null;
  faturamentoMes: ResumoFaturamento | null;
  receitasLogisticas: number;
  faltas: number;
  faltasSetores: string[];
}): ResumoFechamento {
  const f = input.faturamentoPeriodo;
  const mes = input.faturamentoMes;
  return {
    isPeriodo: input.ini !== input.fim,
    faturamentoBruto: f ? f.vendaFaturada : null,
    pdvsAtendidos: f ? f.atendimentos : null,
    notasEmitidas: f ? f.emitidas : null,
    pesoFaturadoKg: f ? f.pesoFaturadoKg : null,
    taxaDevolucaoMes: mes ? taxaDevolucao(mes) : null,
    devolucaoMesValor: mes ? mes.valorDevolucao : null,
    devolucaoMesPesoKg: mes ? mes.pesoDevolucao : null,
    receitasLogisticas: input.receitasLogisticas,
    faltas: input.faltas,
    faltasSetores: input.faltasSetores,
  };
}

/**
 * Nomes dos setores que tiveram falta no período [ini, fim], ordenados do maior
 * número de faltas para o menor. Alimenta a linha "Faltas por setor" da arte.
 */
export function setoresComFaltas(
  faltas: { funcionarioId: string; data: string }[],
  setorPorFuncionario: Map<string, string>,
  nomeSetor: Map<string, string>,
  ini: string,
  fim: string,
): string[] {
  const cont = new Map<string, number>();
  for (const f of faltas) {
    if (f.data < ini || f.data > fim) continue;
    const setorId = setorPorFuncionario.get(f.funcionarioId);
    if (!setorId) continue;
    cont.set(setorId, (cont.get(setorId) ?? 0) + 1);
  }
  return [...cont.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([setorId]) => nomeSetor.get(setorId) ?? "—");
}

// Datas em UTC para o texto não "escorregar" um dia por fuso.
function d(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const diaNum = (iso: string) => new Intl.DateTimeFormat("pt-BR", { day: "numeric", timeZone: "UTC" }).format(d(iso));
const mesLongo = (iso: string) => new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" }).format(d(iso));
const diaMes = (iso: string) => `${diaNum(iso)} de ${mesLongo(iso)}`;
const semanaExtenso = (iso: string) =>
  cap(new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "UTC" }).format(d(iso)));

export function rotuloPeriodo(ini: string, fim: string): { eyebrow: string; titulo: string } {
  if (ini === fim) {
    return {
      eyebrow: "Centro de Controle · Fechamento do dia",
      titulo: `${semanaExtenso(ini)}, ${diaMes(ini)}`,
    };
  }
  const mesmoMes = ini.slice(0, 7) === fim.slice(0, 7);
  const titulo = mesmoMes
    ? `${diaNum(ini)} a ${diaNum(fim)} de ${mesLongo(fim)}`
    : `${diaMes(ini)} a ${diaMes(fim)}`;
  return { eyebrow: "Centro de Controle · Período", titulo };
}

export function intervaloDias(a: string, b: string): { ini: string; fim: string } {
  return a <= b ? { ini: a, fim: b } : { ini: b, fim: a };
}

export function hojeISO(hoje: Date = new Date()): string {
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function clampDia(iso: string, hoje: Date = new Date()): string {
  const hj = hojeISO(hoje);
  if (iso < INICIO_HISTORICO) return INICIO_HISTORICO;
  if (iso > hj) return hj;
  return iso;
}

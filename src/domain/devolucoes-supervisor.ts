import type { SetorDevolucao } from "./devolucoes";

/**
 * Devolução por SUPERVISOR, agrupada em PASTAS (unidade de negócio: DIA FOOD,
 * DIA WINE, ATACADIA, regiões…). O supervisor é o do cadastro atual do RCA da
 * nota de venda (PCUSUARI.CODSUPERVISOR).
 *
 * Faturamento líquido = venda faturada (VIEW_BI_FATURAMENTO.VENDAS, já sem ST,
 * IPI e bonificação) − devolução do período. Todas as taxas são sobre o líquido;
 * as taxas por setor somam a taxa total.
 */
export type ValoresPorSetor = Record<SetorDevolucao, number>;

/** Linha crua por supervisor, como vem do Winthor. */
export interface LinhaSupervisor {
  cod: number; // 0 = RCA sem supervisor
  nome: string;
  faturado: number; // venda faturada no período
  devolvidoTodos: number; // devolução sem filtro de motivo/setor (entra no líquido)
  setores: ValoresPorSetor; // devolução (com os filtros da página) por setor
}

export interface SupervisorDevolucao {
  cod: number;
  nome: string;
  liquido: number;
  devolucao: number;
  setores: ValoresPorSetor;
}

export interface PastaDevolucao {
  pasta: string;
  liquido: number;
  devolucao: number;
  setores: ValoresPorSetor;
  supervisores: SupervisorDevolucao[];
}

export const SETORES: SetorDevolucao[] = ["Comercial", "Logística", "Faturamento", "Não classificado"];

export const setoresZerados = (): ValoresPorSetor => ({
  Comercial: 0, Logística: 0, Faturamento: 0, "Não classificado": 0,
});

const normalizar = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").trim();

/**
 * Pasta do supervisor pelo NOME do cadastro (decisão do Pedro, 17/11/2026):
 * DIA FOOD e DIA WINE juntam todos os seus; ATACADIA junta ATACADIA* e ATACADO;
 * regionais = uma pasta por região (AGRESTE, RMR/ZM, SERTÃO); o resto (DIA PET,
 * FARMADIA, GERENTE, FORNECEDORES, WEB B2B, TI…) é pasta própria.
 */
export function pastaDoSupervisor(cod: number, nome: string): string {
  if (cod === 0) return "SEM SUPERVISOR";
  const n = normalizar(nome);
  if (n.startsWith("DIA FOOD")) return "DIA FOOD";
  if (n.startsWith("DIA WINE")) return "DIA WINE";
  if (n.startsWith("ATACADIA") || n === "ATACADO") return "ATACADIA";
  if (n.startsWith("AGRESTE")) return "AGRESTE";
  if (n.startsWith("RMR/ZM")) return "RMR/ZM";
  if (n.startsWith("SERTAO")) return "SERTÃO";
  return n || `SUPERVISOR ${cod}`;
}

/** Taxa (fração) da devolução sobre o faturamento líquido; 0 se não há líquido positivo. */
export const taxaSobreLiquido = (devolucao: number, liquido: number): number =>
  liquido > 0 ? devolucao / liquido : 0;

const somaSetores = (s: ValoresPorSetor) => SETORES.reduce((t, k) => t + s[k], 0);

/** Agrupa os supervisores em pastas, ordenando pastas e supervisores pelo líquido (maior primeiro). */
export function agruparPorPasta(linhas: LinhaSupervisor[]): PastaDevolucao[] {
  const pastas = new Map<string, PastaDevolucao>();
  for (const l of linhas) {
    const sup: SupervisorDevolucao = {
      cod: l.cod,
      nome: l.nome.replace(/\s+/g, " ").trim(),
      liquido: l.faturado - l.devolvidoTodos,
      devolucao: somaSetores(l.setores),
      setores: { ...l.setores },
    };
    const chave = pastaDoSupervisor(l.cod, l.nome);
    const p = pastas.get(chave) ?? { pasta: chave, liquido: 0, devolucao: 0, setores: setoresZerados(), supervisores: [] };
    p.liquido += sup.liquido;
    p.devolucao += sup.devolucao;
    for (const k of SETORES) p.setores[k] += sup.setores[k];
    p.supervisores.push(sup);
    pastas.set(chave, p);
  }
  const lista = [...pastas.values()];
  for (const p of lista) p.supervisores.sort((a, b) => b.liquido - a.liquido);
  return lista.sort((a, b) => b.liquido - a.liquido);
}

/** Total geral (soma das pastas). */
export function totalPastas(pastas: PastaDevolucao[]): Omit<PastaDevolucao, "pasta" | "supervisores"> {
  const setores = setoresZerados();
  let liquido = 0;
  let devolucao = 0;
  for (const p of pastas) {
    liquido += p.liquido;
    devolucao += p.devolucao;
    for (const k of SETORES) setores[k] += p.setores[k];
  }
  return { liquido, devolucao, setores };
}

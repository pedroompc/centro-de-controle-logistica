/**
 * Separação — regras do BI do setor. Por enquanto só a parte de equipe e
 * custo; a produção (Harpia) entra depois.
 */
import { normalizarTexto, ehCargoEmpilhador } from "./recebimento";

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

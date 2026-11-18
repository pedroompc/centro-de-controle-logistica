// Aba Geral interativa: o que cada clique abre (ver
// docs/superpowers/specs/2026-11-16-bi-geral-interativo-design.md).
import type { SetorGeral } from "./bi-geral";
import type { CustoMensal, CustoTipo, Funcionario, Setor } from "./types";

export const VISOES_GERAL = ["efetivo", "faturamento", "custo", "custoSobreFat"] as const;
export type VisaoGeral = (typeof VISOES_GERAL)[number];

export function lerVisao<T extends string>(v: string | null | undefined, validas: readonly T[]): T | null {
  return (validas as readonly string[]).includes(v ?? "") ? (v as T) : null;
}

export const lerVisaoGeral = (v: string | null | undefined): VisaoGeral | null => lerVisao(v, VISOES_GERAL);

/** Quadro do BI do setor que mostra o número daquela linha da Geral. */
const QUADRO: Record<SetorGeral, Record<string, string>> = {
  separacao: { pedidos: "producao", peso: "producao", custoPorCaixa: "custo" },
  recebimento: { peso: "descarrego", carros: "descarrego", receita: "receita" },
  abastecimento: { movimentacoes: "movimento", reabastecimentos: "volume", rupturas: "rupturas" },
  motoristas: { entregas: "entregas", peso: "entregas", clientes: "entregas", devolucao: "devolucao", kmPorVeiculoDia: "km" },
};

export function visaoDoIndicador(setor: SetorGeral, chave: string): string | null {
  return QUADRO[setor][chave] ?? null;
}

export interface GrupoEfetivo {
  setor: string;
  pessoas: Funcionario[];
  custo: number;
}

/** Ativos por setor (maior equipe primeiro), pessoas em ordem alfabética. */
export function efetivoPorSetor(funcionarios: Funcionario[], setores: Setor[]): GrupoEfetivo[] {
  const nome = new Map(setores.map((s) => [s.id, s.nome]));
  const grupos = new Map<string, GrupoEfetivo>();
  for (const f of funcionarios) {
    if (f.status !== "ativo") continue;
    const s = nome.get(f.setorId) ?? "Sem setor";
    const g = grupos.get(s) ?? { setor: s, pessoas: [], custo: 0 };
    g.pessoas.push(f);
    g.custo += f.custoMensal;
    grupos.set(s, g);
  }
  for (const g of grupos.values()) g.pessoas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return [...grupos.values()].sort((a, b) => b.pessoas.length - a.pessoas.length || a.setor.localeCompare(b.setor, "pt-BR"));
}

export interface ComposicaoCusto {
  folha: number;
  fixos: number;
  variaveis: number;
  total: number;
  maiores: { nome: string; tipo: CustoTipo; valor: number }[];
}

/** Folha + lançamentos do período; o mesmo lançamento em meses diferentes vira uma linha. */
export function composicaoCusto(p: { folha: number; lancamentos: CustoMensal[]; top: number }): ComposicaoCusto {
  let fixos = 0, variaveis = 0;
  const porNome = new Map<string, { nome: string; tipo: CustoTipo; valor: number }>();
  for (const l of p.lancamentos) {
    if (l.tipo === "fixo") fixos += l.valor;
    else variaveis += l.valor;
    const k = `${l.tipo}|${l.nome}`;
    const x = porNome.get(k) ?? { nome: l.nome, tipo: l.tipo, valor: 0 };
    x.valor += l.valor;
    porNome.set(k, x);
  }
  const maiores = [...porNome.values()].sort((a, b) => b.valor - a.valor).slice(0, p.top);
  return { folha: p.folha, fixos, variaveis, total: p.folha + fixos + variaveis, maiores };
}

export interface FaturamentoDia {
  dia: string;
  venda: number;
  devolucao: number;
  avulsa: number;
}

export function totalFaturamentoDias(linhas: FaturamentoDia[]) {
  const dias = linhas.map((l) => ({ ...l, liquido: l.venda - l.devolucao - l.avulsa }));
  const total = dias.reduce(
    (t, d) => ({ venda: t.venda + d.venda, devolucao: t.devolucao + d.devolucao, avulsa: t.avulsa + d.avulsa, liquido: t.liquido + d.liquido }),
    { venda: 0, devolucao: 0, avulsa: 0, liquido: 0 },
  );
  return { dias, total };
}

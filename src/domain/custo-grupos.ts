// Relatório geral de custos: o custo logístico (folha + fixos + variáveis)
// dividido em três grupos que somam 100%, e o peso de cada um sobre o
// faturamento (venda líquida, a mesma do Início).
//
//   Galpão         — quem trabalha dentro do galpão + equipamentos + casa
//   Entrega        — motoristas, ajudantes de entrega e toda a frota
//   Administrativo — monitoramento (roteiristas) e ADM (gerência/escritório)

export type GrupoCusto = "galpao" | "entrega" | "administrativo";

export const GRUPOS: { chave: GrupoCusto; label: string }[] = [
  { chave: "galpao", label: "Galpão" },
  { chave: "entrega", label: "Entrega" },
  { chave: "administrativo", label: "Administrativo" },
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

// Nomes antigos (Transporte, Sistema, Logística Geral) só existem nas fotos de jul/2026.
const SETORES_ENTREGA = new Set(["motoristas", "ajudantes de entrega", "transporte"]);
const SETORES_ADMINISTRATIVO = new Set(["monitoramento", "adm", "sistema", "logistica geral"]);

/** Grupo do setor; `null` = fora do custo (setor de teste "ZZ …"). */
export function grupoDoSetor(nome: string): GrupoCusto | null {
  const n = norm(nome);
  if (n.startsWith("zz ")) return null;
  if (SETORES_ENTREGA.has(n)) return "entrega";
  if (SETORES_ADMINISTRATIVO.has(n)) return "administrativo";
  return "galpao";
}

/** Grupo de um lançamento de custos_mensais: frota/agregado/combustível = entrega; o resto é do galpão. */
export function grupoDoLancamento(nome: string): GrupoCusto {
  const n = norm(nome);
  if (/^frota\b|agregad|combust|diesel/.test(n)) return "entrega";
  return "galpao";
}

export interface ParteGrupo {
  folha: number;
  fixos: number;
  variaveis: number;
  total: number;
  pessoas: number; // ativos na folha do grupo
}

export interface CustoGruposMes {
  mes: string; // "yyyy-mm-01"
  grupos: Record<GrupoCusto, ParteGrupo>;
  total: number;
  /** Folha por setor (só os que contam), para o detalhamento. */
  setores: { setor: string; grupo: GrupoCusto; folha: number; pessoas: number }[];
}

const vazio = (): ParteGrupo => ({ folha: 0, fixos: 0, variaveis: 0, total: 0, pessoas: 0 });

/** Monta o custo de um mês por grupo a partir da folha por setor e dos lançamentos. */
export function custoGruposDoMes(
  mes: string,
  folhaPorSetor: { setor: string; custo: number; ativos?: number }[],
  lancamentos: { nome: string; tipo: "fixo" | "variavel"; valor: number }[],
): CustoGruposMes {
  const grupos: Record<GrupoCusto, ParteGrupo> = { galpao: vazio(), entrega: vazio(), administrativo: vazio() };
  const setores: CustoGruposMes["setores"] = [];
  for (const s of folhaPorSetor) {
    const g = grupoDoSetor(s.setor);
    if (!g || s.custo <= 0) continue;
    grupos[g].folha += s.custo;
    grupos[g].pessoas += s.ativos ?? 0;
    setores.push({ setor: s.setor, grupo: g, folha: s.custo, pessoas: s.ativos ?? 0 });
  }
  for (const l of lancamentos) {
    const g = grupoDoLancamento(l.nome);
    if (l.tipo === "fixo") grupos[g].fixos += l.valor;
    else grupos[g].variaveis += l.valor;
  }
  let total = 0;
  for (const { chave } of GRUPOS) {
    const p = grupos[chave];
    p.total = p.folha + p.fixos + p.variaveis;
    total += p.total;
  }
  setores.sort((a, b) => b.folha - a.folha);
  return { mes, grupos, total, setores };
}

/** Fração 0..1; `null` quando o denominador não existe ou é zero. */
export function fracao(parte: number | null, todo: number | null): number | null {
  if (parte === null || todo === null || todo <= 0) return null;
  return parte / todo;
}

/** Soma vários meses num só (para o acumulado). */
export function somarMeses(meses: CustoGruposMes[]): Omit<CustoGruposMes, "mes" | "setores"> {
  const grupos: Record<GrupoCusto, ParteGrupo> = { galpao: vazio(), entrega: vazio(), administrativo: vazio() };
  let total = 0;
  for (const m of meses) {
    for (const { chave } of GRUPOS) {
      const p = m.grupos[chave];
      grupos[chave].folha += p.folha;
      grupos[chave].fixos += p.fixos;
      grupos[chave].variaveis += p.variaveis;
      grupos[chave].total += p.total;
      grupos[chave].pessoas += p.pessoas;
    }
    total += m.total;
  }
  return { grupos, total };
}

/**
 * Faturamento do mês corrente levado ao mês inteiro, pelo ritmo dos dias já
 * decorridos (dias corridos). Só uma referência: o custo é mensal e cheio, e o
 * faturamento até hoje é parcial — sem a projeção o % do mês nasce inflado.
 */
export function projetarMes(valorAteHoje: number, hoje: Date = new Date()): number {
  const dia = hoje.getDate();
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  if (dia <= 0) return valorAteHoje;
  return (valorAteHoje / dia) * diasNoMes;
}

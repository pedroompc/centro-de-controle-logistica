// Relatório geral de custos: o custo logístico (folha + fixos + variáveis)
// dividido em três grupos que somam 100%, e o peso de cada um sobre o
// faturamento (venda líquida, a mesma do Início).
//
//   Logística Depósito       — quem trabalha dentro do galpão + equipamentos + casa
//   Logística Entrega        — motoristas, ajudantes de entrega e toda a frota
//   Logística Administrativo — monitoramento (roteiristas) e ADM (gerência/escritório)
//
// O aluguel do galpão (lançamento "Galpão") fica FORA dos três grupos: é a
// estrutura, mostrado à parte no topo. Ele entra no custo logístico total (e no
// custo ÷ faturamento), mas não pesa na equipe do galpão nem na entrega.

export type GrupoCusto = "galpao" | "entrega" | "administrativo";

export const GRUPOS: { chave: GrupoCusto; label: string }[] = [
  { chave: "galpao", label: "Logística Depósito" },
  { chave: "entrega", label: "Logística Entrega" },
  { chave: "administrativo", label: "Logística Administrativo" },
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

/** Lançamento do aluguel do galpão (nome "Galpão" ou "Aluguel …"). */
export function ehAluguelGalpao(nome: string): boolean {
  const n = norm(nome);
  return n === "galpao" || n.startsWith("aluguel");
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

export interface LancamentoGrupo {
  nome: string;
  tipo: "fixo" | "variavel";
  valor: number;
  grupo: GrupoCusto;
}

export interface CustoGruposMes {
  mes: string; // "yyyy-mm-01"
  grupos: Record<GrupoCusto, ParteGrupo>;
  /** Soma dos três grupos (sem o aluguel do galpão). */
  total: number;
  /** Aluguel do galpão, à parte dos grupos. */
  aluguel: number;
  /** Custo logístico total = grupos + aluguel. */
  totalComAluguel: number;
  /** Lançamentos fixos/variáveis de cada grupo (sem o aluguel), maior primeiro. */
  lancamentos: LancamentoGrupo[];
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
  const itens: LancamentoGrupo[] = [];
  let aluguel = 0;
  for (const s of folhaPorSetor) {
    const g = grupoDoSetor(s.setor);
    if (!g || s.custo <= 0) continue;
    grupos[g].folha += s.custo;
    grupos[g].pessoas += s.ativos ?? 0;
    setores.push({ setor: s.setor, grupo: g, folha: s.custo, pessoas: s.ativos ?? 0 });
  }
  for (const l of lancamentos) {
    if (ehAluguelGalpao(l.nome)) {
      aluguel += l.valor;
      continue;
    }
    const g = grupoDoLancamento(l.nome);
    itens.push({ nome: l.nome, tipo: l.tipo, valor: l.valor, grupo: g });
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
  itens.sort((a, b) => b.valor - a.valor);
  return { mes, grupos, total, aluguel, totalComAluguel: total + aluguel, lancamentos: itens, setores };
}

/** Fração 0..1; `null` quando o denominador não existe ou é zero. */
export function fracao(parte: number | null, todo: number | null): number | null {
  if (parte === null || todo === null || todo <= 0) return null;
  return parte / todo;
}

/** Soma vários meses num só (para o acumulado). */
export function somarMeses(meses: CustoGruposMes[]): Pick<CustoGruposMes, "grupos" | "total" | "aluguel" | "totalComAluguel"> {
  const grupos: Record<GrupoCusto, ParteGrupo> = { galpao: vazio(), entrega: vazio(), administrativo: vazio() };
  let total = 0;
  let aluguel = 0;
  for (const m of meses) {
    aluguel += m.aluguel;
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
  return { grupos, total, aluguel, totalComAluguel: total + aluguel };
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

/**
 * Junta vários meses num período só (relatório com período escolhido): R$ somam,
 * pessoas NÃO somam (headcount) — vale a foto do último mês. Lançamentos e setores
 * de mesmo nome viram uma linha.
 */
export function juntarMeses(meses: CustoGruposMes[]): CustoGruposMes {
  if (meses.length === 1) return meses[0];
  const ordem = [...meses].sort((a, b) => a.mes.localeCompare(b.mes));
  const ultimo = ordem[ordem.length - 1];
  const soma = somarMeses(ordem);
  for (const { chave } of GRUPOS) soma.grupos[chave].pessoas = ultimo?.grupos[chave].pessoas ?? 0;
  const setores = new Map<string, CustoGruposMes["setores"][number]>();
  const lancs = new Map<string, LancamentoGrupo>();
  for (const m of ordem) {
    for (const s of m.setores) {
      const k = `${s.grupo}|${s.setor}`;
      const atual = setores.get(k);
      setores.set(k, { ...s, folha: (atual?.folha ?? 0) + s.folha, pessoas: s.pessoas });
    }
    for (const l of m.lancamentos) {
      const k = `${l.grupo}|${l.tipo}|${l.nome}`;
      lancs.set(k, { ...l, valor: (lancs.get(k)?.valor ?? 0) + l.valor });
    }
  }
  return {
    mes: ordem[0]?.mes ?? "",
    ...soma,
    setores: [...setores.values()].sort((a, b) => b.folha - a.folha),
    lancamentos: [...lancs.values()].sort((a, b) => b.valor - a.valor),
  };
}

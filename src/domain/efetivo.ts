/**
 * Efetivo (headcount + folha) — parte pura do "método de gestão" aplicado às
 * pessoas. A foto do AGORA vem do cadastro vivo (`funcionarios`); o histórico
 * mês a mês é reconstruído pelas datas de admissão/desligamento do mesmo
 * cadastro (`efetivoSetorNoMes`). As fotos congeladas (`efetivo_mensal_setor`)
 * ficaram só de arquivo: congelavam o cadastro atrasado de cada mês.
 */
import type { Funcionario } from "./types";

export interface FotoEfetivo {
  ativos: number;
  afastados: number;
  desligados: number;
  folhaTotal: number; // soma do custo mensal só dos ATIVOS
}

/** Conta o efetivo por status e soma a folha dos ativos. */
export function fotoAtual(funcionarios: Funcionario[]): FotoEfetivo {
  const foto: FotoEfetivo = { ativos: 0, afastados: 0, desligados: 0, folhaTotal: 0 };
  for (const f of funcionarios) {
    if (f.status === "ativo") {
      foto.ativos += 1;
      foto.folhaTotal += f.custoMensal;
    } else if (f.status === "afastado") {
      foto.afastados += 1;
    } else {
      foto.desligados += 1;
    }
  }
  return foto;
}

/** Rubricas da folha, em ordem de exibição. */
export const RUBRICAS_FOLHA = [
  ["salarioBase", "Salário base"],
  ["passagem", "Vale-transporte"],
  ["alimentacao", "Alimentação"],
  ["planoSaude", "Plano de saúde"],
  ["ajudaCusto", "Ajuda de custo"],
  ["premiacao", "Premiação"],
  ["adicionalNoturno", "Adicional noturno"],
] as const;

type RubricaChave = (typeof RUBRICAS_FOLHA)[number][0];

/**
 * Quanto o salário base custa para a empresa: salário × 1,85 (encargos sobre a
 * folha). Só o salário leva o fator; benefícios e adicionais entram pelo valor.
 */
export const FATOR_ENCARGOS_SALARIO = 1.85;

export type ComposicaoCusto = Pick<Funcionario, RubricaChave>;

/**
 * Custo mensal a partir das rubricas: salário base × 1,85 + as demais pelo
 * valor. `null` quando nenhuma rubrica foi informada — aí o custo é o digitado
 * à mão (funcionário sem composição cadastrada).
 */
export function custoMensalDaComposicao(c: ComposicaoCusto): number | null {
  if (RUBRICAS_FOLHA.every(([chave]) => c[chave] === null)) return null;
  const outras = RUBRICAS_FOLHA.filter(([chave]) => chave !== "salarioBase").reduce(
    (total, [chave]) => total + (c[chave] ?? 0),
    0,
  );
  const total = (c.salarioBase ?? 0) * FATOR_ENCARGOS_SALARIO + outras;
  return Math.round((total + Number.EPSILON) * 100) / 100;
}

export interface ItemComposicao {
  chave: RubricaChave;
  label: string;
  valor: number;
}

/**
 * Soma cada rubrica da folha entre os ATIVOS (ignorando os `null` — rubrica não
 * importada). Só retorna as rubricas com algum valor; a soma delas pode não bater
 * com a folha total (parte do efetivo não tem o detalhamento gravado).
 */
export function composicaoFolha(funcionarios: Funcionario[]): ItemComposicao[] {
  const ativos = funcionarios.filter((f) => f.status === "ativo");
  return RUBRICAS_FOLHA.map(([chave, label]) => ({
    chave,
    label,
    valor: ativos.reduce((total, f) => total + (f[chave] ?? 0), 0),
  })).filter((item) => item.valor > 0);
}

// --- Foto por setor (headcount + folha) --------------------------------------

export interface LinhaEfetivoSetor {
  setor: string; // NOME do setor (chave da foto mensal — bate com _baseline/_snapshot)
  ativos: number;
  afastados: number;
  desligados: number;
  custoAtivos: number; // folha dos ativos do setor
}

/**
 * Foto do efetivo por setor no AGORA, a partir do cadastro vivo. Guarda o nome
 * do setor (não o id) para a foto mensal casar com as fotos históricas
 * (_baseline_efetivo/_snapshot_efetivo), que só têm o nome.
 */
export function fotoSetorAtual(
  funcionarios: Funcionario[],
  setores: { id: string; nome: string }[],
): LinhaEfetivoSetor[] {
  return setores
    .map((s) => {
      const doSetor = funcionarios.filter((f) => f.setorId === s.id);
      const ativos = doSetor.filter((f) => f.status === "ativo");
      return {
        setor: s.nome,
        ativos: ativos.length,
        afastados: doSetor.filter((f) => f.status === "afastado").length,
        desligados: doSetor.filter((f) => f.status === "desligado").length,
        custoAtivos: ativos.reduce((total, f) => total + f.custoMensal, 0),
      };
    })
    .filter((l) => l.ativos > 0 || l.afastados > 0 || l.custoAtivos > 0);
}

const diaUTC = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
const diasEntre = (de: string, ate: string) => Math.round((diaUTC(ate) - diaUTC(de)) / 86_400_000) + 1;
function ultimoDiaDoMes(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${mes.slice(0, 7)}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
}

/**
 * Efetivo por setor num mês, RECONSTRUÍDO pelas datas do cadastro — não por foto
 * congelada: lançamento atrasado (admissão/desligamento) corrige o passado sozinho.
 *
 *  - Pessoas = quem estava na empresa no último dia do mês (mês aberto: hoje).
 *    Admitido até esse dia e, se desligado, com o último dia ≥ ele.
 *  - Desligado SEM data de desligamento nunca conta (ex.: faturistas, que não
 *    são do efetivo).
 *  - Custo = custo mensal ATUAL de cada um × dias na empresa no mês ÷ dias do mês
 *    (quem entrou/saiu no meio paga a fração). Mês aberto: quem está hoje paga o
 *    mês cheio (regra do custo fixo do mês).
 *  - Afastado conta como afastado desde a admissão (não há histórico do afastamento).
 *  - Setor é o de HOJE (o cadastro não guarda transferências).
 */
export function efetivoSetorNoMes(
  funcionarios: Funcionario[],
  setores: { id: string; nome: string }[],
  mes: string,
  hoje: string,
): LinhaEfetivoSetor[] {
  const ini = mes.slice(0, 7) + "-01";
  const fim = ultimoDiaDoMes(ini);
  if (ini > hoje) return [];
  const ref = hoje < fim ? hoje : fim;
  const totalDias = diasEntre(ini, fim);
  const porSetor = new Map<string, LinhaEfetivoSetor>();
  const nome = new Map(setores.map((s) => [s.id, s.nome]));
  for (const f of funcionarios) {
    const setor = nome.get(f.setorId);
    if (!setor) continue;
    const saida = f.status === "desligado" ? (f.dataDesligamento ?? null) : null;
    if (f.status === "desligado" && !saida) continue;
    const l = porSetor.get(setor) ?? { setor, ativos: 0, afastados: 0, desligados: 0, custoAtivos: 0 };
    porSetor.set(setor, l);
    if (saida && saida >= ini && saida <= fim) l.desligados += 1;
    if (f.dataAdmissao > ref) continue;
    const presente = !saida || saida >= ref;
    if (f.status === "afastado") {
      if (presente) l.afastados += 1;
      continue;
    }
    if (presente) l.ativos += 1;
    const de = f.dataAdmissao > ini ? f.dataAdmissao : ini;
    const ate = saida && saida < fim ? saida : fim;
    if (ate >= de) l.custoAtivos += (f.custoMensal * diasEntre(de, ate)) / totalDias;
  }
  return [...porSetor.values()].filter((l) => l.ativos > 0 || l.afastados > 0 || l.custoAtivos > 0);
}

export interface TotalEfetivoMes {
  mes: string;
  ativos: number;
  afastados: number;
  folhaTotal: number;
}

/** Agrega linhas por setor em totais por mês (ordena mais antigo → mais novo). */
export function totaisEfetivoPorMes(
  linhas: { mes: string; ativos: number; afastados: number; custoAtivos: number }[],
): TotalEfetivoMes[] {
  const porMes = new Map<string, TotalEfetivoMes>();
  for (const l of linhas) {
    const t = porMes.get(l.mes) ?? { mes: l.mes, ativos: 0, afastados: 0, folhaTotal: 0 };
    t.ativos += l.ativos;
    t.afastados += l.afastados;
    t.folhaTotal += l.custoAtivos;
    porMes.set(l.mes, t);
  }
  return [...porMes.values()].sort((a, b) => a.mes.localeCompare(b.mes));
}

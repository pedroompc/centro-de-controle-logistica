/**
 * Efetivo (headcount + folha) — parte pura do "método de gestão" aplicado às
 * pessoas. A foto do AGORA vem do cadastro vivo (`funcionarios`); o histórico
 * mês a mês vem da tabela `efetivo_mensal` (fotos congeladas), porque o cadastro
 * não guarda data de desligamento e o passado não é reconstruível.
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

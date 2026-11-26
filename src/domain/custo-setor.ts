import type { Equipamento, Funcionario } from "./types";
import { comEmpilhador, custoDosEquipamentos, empilhadorDoCadastro, ehSetorRecebimento } from "./recebimento";
import { mesmoSetor } from "./separacao";
import { formatBRL } from "./format";

export interface CustoMensalSetor {
  folha: number; // ativos do setor
  equipamentos: number; // cadastro de equipamentos do setor
  empilhador: number; // só Recebimento: operador emprestado de outro setor
  total: number;
}

/**
 * Custo mensal de hoje de um setor, na mesma regra dos BIs: folha dos ativos +
 * equipamentos do setor. O Recebimento soma também o empilhador (quando ele
 * está cadastrado em outro setor) e, sem a tabela de equipamentos, a
 * empilhadeira padrão — igual a `comEmpilhador`.
 */
export function custoMensalDoSetor(
  setor: { id: string; nome: string },
  funcionarios: Funcionario[],
  setores: { id: string; nome: string }[],
  equipamentos: Equipamento[] | null,
): CustoMensalSetor {
  const ativos = funcionarios.filter((f) => f.setorId === setor.id && f.status === "ativo");
  const folha = ativos.reduce((t, f) => t + f.custoMensal, 0);

  if (ehSetorRecebimento(setor.nome)) {
    const equip = custoDosEquipamentos(equipamentos === null ? null : equipamentos.filter((e) => ehSetorRecebimento(e.setor)));
    const e = comEmpilhador({ setor: setor.nome, total: ativos.length, ajudantes: 0, conferentes: 0, custo: folha }, empilhadorDoCadastro(funcionarios, setores), equip);
    return { folha, equipamentos: e.custoEquipamentos ?? 0, empilhador: e.custoEmpilhador ?? 0, total: e.custo };
  }

  const equip = (equipamentos ?? []).filter((e) => mesmoSetor(e.setor, setor.nome)).reduce((t, e) => t + e.quantidade * e.custoUnitario, 0);
  return { folha, equipamentos: equip, empilhador: 0, total: folha + equip };
}

/** "folha R$ X + equip. R$ Y + empilhador R$ Z" — de onde sai o custo; só a folha = "folha dos ativos". */
export function composicaoDoCusto(c: CustoMensalSetor): string {
  if (c.total === c.folha) return "folha dos ativos";
  const partes = [`folha ${formatBRL(c.folha)}`];
  if (c.equipamentos > 0) partes.push(`equip. ${formatBRL(c.equipamentos)}`);
  if (c.empilhador > 0) partes.push(`empilhador ${formatBRL(c.empilhador)}`);
  return partes.join(" + ");
}

/** Setor num período passado (ou de vários meses): pessoas no fim e custo somado. */
export interface SetorNoPeriodo {
  custo: CustoMensalSetor;
  ativos: number;
  afastados: number;
}

/**
 * Custo e pessoas de um setor num período, a partir do efetivo reconstruído mês
 * a mês (`efetivoSetorNoMes`, uma lista por mês do período, em ordem).
 *  - Folha = soma da folha (pró-rata) de cada mês.
 *  - Equipamentos/empilhador não têm histórico: o valor mensal de HOJE (`atual`)
 *    vezes o nº de meses.
 *  - Pessoas = o último mês do período (quem estava no fim dele).
 */
export function setorNoPeriodo(
  setor: string,
  linhasPorMes: { setor: string; ativos: number; afastados: number; custoAtivos: number }[][],
  atual: CustoMensalSetor,
): SetorNoPeriodo {
  const meses = linhasPorMes.length;
  const folha = linhasPorMes.reduce((t, ls) => t + (ls.find((l) => l.setor === setor)?.custoAtivos ?? 0), 0);
  const equipamentos = atual.equipamentos * meses;
  const empilhador = atual.empilhador * meses;
  const ultimo = linhasPorMes.at(-1)?.find((l) => l.setor === setor);
  return {
    custo: { folha, equipamentos, empilhador, total: folha + equipamentos + empilhador },
    ativos: ultimo?.ativos ?? 0,
    afastados: ultimo?.afastados ?? 0,
  };
}

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

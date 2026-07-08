import type { Setor, Funcionario, Falta, StatusFuncionario, TipoFalta, CustoFixo, CustoMensal, CustoTipo } from "@/domain/types";

export function mapSetor(row: { id: string; nome: string }): Setor {
  return { id: row.id, nome: row.nome };
}

export function mapFuncionario(row: {
  id: string;
  nome: string;
  cargo: string;
  setor_id: string;
  custo_mensal: string | number;
  data_admissao: string;
  status: string;
}): Funcionario {
  return {
    id: row.id,
    nome: row.nome,
    cargo: row.cargo,
    setorId: row.setor_id,
    custoMensal: Number(row.custo_mensal),
    dataAdmissao: row.data_admissao,
    status: row.status as StatusFuncionario,
  };
}

export function mapFalta(row: {
  id: string;
  funcionario_id: string;
  data: string;
  tipo: string;
  observacao: string | null;
}): Falta {
  return {
    id: row.id,
    funcionarioId: row.funcionario_id,
    data: row.data,
    tipo: row.tipo as TipoFalta,
    observacao: row.observacao,
  };
}

export function mapCustoFixo(row: {
  id: string; nome: string; valor: string | number; ativo: boolean;
}): CustoFixo {
  return { id: row.id, nome: row.nome, valor: Number(row.valor), ativo: row.ativo };
}

export function mapCustoMensal(row: {
  id: string; mes: string; nome: string; tipo: string; valor: string | number;
}): CustoMensal {
  return {
    id: row.id,
    mes: row.mes,
    nome: row.nome,
    tipo: row.tipo as CustoTipo,
    valor: Number(row.valor),
  };
}

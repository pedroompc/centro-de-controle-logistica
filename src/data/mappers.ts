import type { Setor, Funcionario, Falta, StatusFuncionario, TipoFalta, CustoFixo, CustoMensal, CustoTipo, Fornecedor, PrecoDescarregamento, Receita, DescarregamentoTipo, ConfigDescarregamento, ReceitaDiversa, ReceitaCategoria } from "@/domain/types";

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
  id: string; mes: string; nome: string; tipo: string; valor: string | number; data?: string | null;
}): CustoMensal {
  return {
    id: row.id,
    mes: row.mes,
    nome: row.nome,
    tipo: row.tipo as CustoTipo,
    valor: Number(row.valor),
    data: row.data ?? null,
  };
}

export function mapFornecedor(row: { id: string; nome: string; ativo: boolean }): Fornecedor {
  return { id: row.id, nome: row.nome, ativo: row.ativo };
}

export function mapPreco(row: { tipo: string; preco_por_tonelada: string | number }): PrecoDescarregamento {
  return { tipo: row.tipo as DescarregamentoTipo, precoPorTonelada: Number(row.preco_por_tonelada) };
}

export function mapReceita(row: {
  id: string; data: string; fornecedor_id: string;
  fornecedores?: { nome: string } | { nome: string }[] | null;
  peso_kg: string | number; tipo: string;
  preco_por_tonelada: string | number; receita: string | number;
  minimo_aplicado: string | number; observacao: string | null;
}): Receita {
  const forn = Array.isArray(row.fornecedores) ? row.fornecedores[0] : row.fornecedores;
  return {
    id: row.id,
    data: row.data,
    fornecedorId: row.fornecedor_id,
    fornecedorNome: forn?.nome ?? "—",
    pesoKg: Number(row.peso_kg),
    tipo: row.tipo as DescarregamentoTipo,
    precoPorTonelada: Number(row.preco_por_tonelada),
    receita: Number(row.receita),
    minimoAplicado: Number(row.minimo_aplicado),
    observacao: row.observacao,
  };
}

export function mapConfig(row: { valor_minimo: string | number }): ConfigDescarregamento {
  return { valorMinimo: Number(row.valor_minimo) };
}

export function mapReceitaDiversa(row: {
  id: string; data: string; categoria: string;
  material: string | null; quantidade: string | number | null;
  unidade: string; preco_unitario: string | number | null;
  valor: string | number; observacao: string | null;
}): ReceitaDiversa {
  return {
    id: row.id,
    data: row.data,
    categoria: row.categoria as ReceitaCategoria,
    material: row.material,
    // null é significativo (receita sem quantidade), então não vira 0.
    quantidade: row.quantidade === null ? null : Number(row.quantidade),
    unidade: row.unidade,
    precoUnitario: row.preco_unitario === null ? null : Number(row.preco_unitario),
    valor: Number(row.valor),
    observacao: row.observacao,
  };
}

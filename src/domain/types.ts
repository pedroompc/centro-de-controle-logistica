export type UserRole = "admin" | "viewer";

export type StatusFuncionario = "ativo" | "afastado" | "desligado";

export type TipoFalta =
  | "justificada"
  | "injustificada"
  | "atestado"
  | "folga"
  | "ferias";

export interface Setor {
  id: string;
  nome: string;
}

export interface Funcionario {
  id: string;
  nome: string;
  cargo: string;
  setorId: string;
  custoMensal: number;
  dataAdmissao: string; // ISO date "yyyy-mm-dd"
  status: StatusFuncionario;
}

export interface Falta {
  id: string;
  funcionarioId: string;
  data: string; // ISO date "yyyy-mm-dd"
  tipo: TipoFalta;
  observacao: string | null;
}

export type CustoTipo = "fixo" | "variavel";

export interface CustoFixo {
  id: string;
  nome: string;
  valor: number;
  ativo: boolean;
}

export interface CustoMensal {
  id: string;
  mes: string; // ISO "yyyy-mm-01"
  nome: string;
  tipo: CustoTipo;
  valor: number;
}

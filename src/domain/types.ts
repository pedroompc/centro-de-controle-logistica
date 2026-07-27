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
  data: string | null; // ISO "yyyy-mm-dd" — dia do lançamento (variáveis); null p/ fixos
}

export type DescarregamentoTipo = "batido" | "paletizado" | "pal_rem";

export interface Fornecedor {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface PrecoDescarregamento {
  tipo: DescarregamentoTipo;
  precoPorTonelada: number;
}

export interface ConfigDescarregamento {
  /** Valor mínimo cobrado por descarregamento, em reais. */
  valorMinimo: number;
}

export interface Receita {
  id: string;
  data: string; // ISO "yyyy-mm-dd"
  fornecedorId: string;
  fornecedorNome: string;
  pesoKg: number;
  tipo: DescarregamentoTipo;
  precoPorTonelada: number;
  receita: number;
  minimoAplicado: number; // SNAPSHOT do mínimo vigente no lançamento
  observacao: string | null;
}

/**
 * Resultado agregado de um dia de descarregamento, lançado direto (sem detalhar
 * fornecedor). `receita` é o valor final digitado — não passa por cálculo de
 * mínimo, que é regra do lançamento por fornecedor.
 */
export interface TotalDiarioDescarregamento {
  id: string;
  data: string; // ISO "yyyy-mm-dd"
  descarregos: number;
  pesoKg: number;
  receita: number;
  observacao: string | null;
}

export type ReceitaCategoria = "reciclagem";

/**
 * Receita que não vem de descarregamento. `valor` é a fonte da verdade — o
 * dinheiro que entrou. `quantidade` e `precoUnitario` são o memorial de como se
 * chegou nele e podem divergir do produto exato.
 */
export interface ReceitaDiversa {
  id: string;
  data: string; // ISO "yyyy-mm-dd"
  categoria: ReceitaCategoria;
  material: string | null;
  quantidade: number | null;
  unidade: string;
  precoUnitario: number | null;
  valor: number;
  observacao: string | null;
}

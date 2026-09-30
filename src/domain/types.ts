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
  // Composição do custo (rubricas da folha). null = não veio na importação
  // — só parte do efetivo tem o detalhamento gravado.
  salarioBase: number | null;
  passagem: number | null;
  alimentacao: number | null;
  planoSaude: number | null;
  ajudaCusto: number | null;
  premiacao: number | null;
  adicionalNoturno: number | null;
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

export type DescarregamentoTipo = "batido" | "paletizado" | "pal_rem" | "volume";

export interface Fornecedor {
  id: string;
  nome: string;
  ativo: boolean;
}

export interface PrecoDescarregamento {
  tipo: DescarregamentoTipo;
  precoPorTonelada: number;
  precoPorUnidade: number | null; // preço/caixa; só o Volume usa
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
  precoPorTonelada: number;     // 0 no Volume (n/a)
  quantidade: number | null;    // só Volume: nº de caixas
  precoPorUnidade: number | null; // só Volume: R$/caixa
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
  descarregos: number; // total de carros do dia = soma de porTipo
  // Quantos carros de cada tipo. null = registro antigo, sem detalhamento.
  // Quando presente, tem os 4 tipos (0 onde não houve).
  porTipo: Record<DescarregamentoTipo, number> | null;
  pesoKg: number;
  // Peso de cada tipo. O total do dia digitado não tem essa quebra (só o peso do
  // dia); só existe quando o dia vem dos lançamentos por fornecedor.
  pesoPorTipo?: Record<DescarregamentoTipo, number> | null;
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

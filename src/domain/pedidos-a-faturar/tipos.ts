export type Prioridade = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA" | "AJUSTAR_CALENDARIO";

export type SituacaoRota =
  | "ATRASADO_PARA_FATURAMENTO"
  | "SAIDA_HOJE"
  | "AGUARDANDO_DIA_DE_FATURAMENTO"
  | "SEM_CALENDARIO_USANDO_72H";

export type DiaSemana =
  | "SEGUNDA" | "TERCA" | "QUARTA" | "QUINTA" | "SEXTA" | "SABADO" | "DOMINGO";

/** Pedido cru vindo do Winthor (já mapeado do Oracle). `dataLiberacao` é YYYY-MM-DD. */
export interface PedidoPendente {
  numeroPedido: number;
  codigoCliente: number;
  nomeCliente: string;
  cidadeCliente: string | null;
  bairroCliente: string | null;
  ufCliente: string | null;
  codigoRca: number;
  nomeRca: string;
  codigoSupervisor: number | null;
  nomeSupervisor: string | null;
  dataPedido: string;      // YYYY-MM-DD
  dataLiberacao: string;   // YYYY-MM-DD (data de referência p/ prazo)
  statusWinthor: string;
  valorPedido: number;
  pesoPedido: number;
  horasParado: number;
  codigoEmitente: number | null;
  nomeEmitente: string | null;
  reentrega: boolean;
}

/** Uma linha do calendário de rotas (tabela Supabase). */
export interface Rota {
  cidade: string;
  uf: string | null;
  regiaoOperacional: string | null;
  rota: string | null;
  grupoRota: string | null;
  diaSaidaRota: string[];
  diaLimitePedido: string | null;
  janelaEntrega: string[];
  aliases: string[];
  observacao: string | null;
}

export interface PedidoClassificado extends PedidoPendente {
  rota: string | null;
  grupoRota: string | null;
  regiaoOperacional: string | null;
  diaSaidaRota: string[] | null;
  diaLimitePedido: string | null;
  janelaEntrega: string[] | null;
  dataPrevistaFaturamento: string | null; // YYYY-MM-DD
  situacaoRota: SituacaoRota;
  observacaoRota: string | null;
  prioridade: Prioridade;
  motivoPrioridade: string;
}

export interface Resumo {
  total: number;
  criticos: number;
  alta: number;
  media: number;
  baixa: number;
  ajustarCalendario: number;
  valorTotal: number;
}

export interface RankingRca {
  codigoRca: number;
  nomeRca: string;
  totalPedidos: number;
  criticos: number;
  alta: number;
  valorTotal: number;
}

export interface RankingCidade {
  cidade: string;
  rota: string | null;
  totalPedidos: number;
  criticos: number;
  alta: number;
  valorTotal: number;
}

export interface CidadeSemCalendario {
  cidade: string;
  uf: string | null;
  totalPedidos: number;
  valorTotal: number;
  maxHorasParado: number;
  exemplosNumped: number[];
}

export interface Relatorio {
  resumo: Resumo;
  pedidos: PedidoClassificado[];
  rankingRca: RankingRca[];
  rankingCidade: RankingCidade[];
  diagnostico: CidadeSemCalendario[];
}

export interface IndiceCalendario {
  buscar(cidade: string | null): Rota | null;
}

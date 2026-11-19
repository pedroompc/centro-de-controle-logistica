// Consulta de pedidos (rotina 335 do Winthor, turbinada). Tipos + rótulos de
// estado compartilhados pela página e pela tabela.

/** Estados de pedido que a tela cobre (PCPEDC.POSICAO). */
export const ESTADOS_PEDIDO = ["L", "M", "F", "B", "C"] as const;
/** Marcados por padrão no filtro (como no app Flask). */
export const ESTADOS_PADRAO: EstadoPedido[] = ["L", "M", "F"];
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export interface PedidoConsulta {
  numped: number;
  data: string; // emissão (ISO YYYY-MM-DD)
  horaPedido: string | null; // hora da digitação (HH:MM, PCPEDC.HORA/MINUTO)
  diasNoSistema: number;
  codcli: number;
  cliente: string;
  fantasia: string | null; // nome fantasia (PCCLIENT.FANTASIA)
  condVenda: number | null; // tipo de venda (PCPEDC.CONDVENDA)
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  codRca: number | null;
  rca: string | null; // vendedor (PCUSUARI.NOME)
  posicao: string; // PCPEDC.POSICAO cru
  codMotorista: number | null;
  numcar: number | null; // nº do carregamento (PCPEDC.NUMCAR); null antes da montagem
  motorista: string | null;
  dataFaturamento: string | null; // quando foi faturado (ISO) ou null
  notaFiscal: number | null; // nº da NF (PCNFSAID.NUMNOTA) quando faturado
  valor: number;
  peso: number;
  qtdItens: number;
  temDevolucao: boolean;
  // Motivo(s) da devolução (PCTABDEV.MOTIVO), já concatenados quando há mais de
  // um. `null` quando o pedido não teve devolução.
  motivoDevolucao: string | null;
  // Cabeçalho do pedido (janela de detalhes, duplo clique na linha).
  emitente: string | null; // PCPEDC.CODEMITENTE → PCEMPR.NOME (8888 = "FORCA DE VENDAS")
  emitidoPelaForcaDeVendas: boolean; // CODEMITENTE 8888: quem lançou foi o RCA
  emissao: string | null; // data + hora da emissão "YYYY-MM-DD HH:MI"
  liberadoPor: string | null; // PCPEDC.CODFUNCLIBERA → PCEMPR.NOME
  liberadoEm: string | null; // PCPEDC.DTLIBERA "YYYY-MM-DD HH:MI:SS"
  faturadoEm: string | null; // PCPEDC.DTFAT + HORAFAT/MINUTOFAT "YYYY-MM-DD HH:MI"; null se não faturado
  // Com devolução: NF(s) de venda que voltaram (nota de origem) e NF(s) de
  // entrada da devolução, separadas por vírgula. `null` sem devolução.
  nfOrigemDevolucao: string | null;
  nfDevolucao: string | null;
  // Telefone do RCA (PCUSUARI.TELEFONE1, senão TELEFONE2) só com dígitos e DDD,
  // pronto para o WhatsApp; `null` sem número válido no cadastro.
  foneRca: string | null;
  // Observações digitadas no pedido (OBS + OBS1 + OBS2) e de entrega (OBSENTREGA1–4).
  obsPedido: string | null;
  obsEntrega: string | null;
}

export interface ItemPedido {
  codprod: number;
  descricao: string;
  quantidade: number;
  valor: number;
}

/** Rótulo, código e classes do selo de estado. Paleta do site (sem verde). */
export function estadoPedidoInfo(posicao: string): { label: string; badge: string } {
  switch (posicao) {
    case "L": return { label: "Liberado", badge: "bg-[#eef0fb] text-[#1b2168] border border-[#d6dbf5]" };
    case "B": return { label: "Bloqueado", badge: "bg-rose-50 text-rose-700 border border-rose-200" };
    case "M": return { label: "Montado", badge: "bg-amber-50 text-amber-700 border border-amber-200" };
    case "F": return { label: "Faturado", badge: "bg-slate-100 text-slate-600 border border-slate-200" };
    case "C": return { label: "Cancelado", badge: "bg-slate-100 text-slate-400 border border-slate-200" };
    default: return { label: posicao || "—", badge: "bg-slate-100 text-slate-500 border border-slate-200" };
  }
}

/**
 * Tipo de venda do pedido (PCPEDC.CONDVENDA). Só os tipos que as filiais 1 e 11
 * usam, conferidos no banco pelo CFOP da nota: 1 = venda (5.12), 5 = bonificação
 * (5.99), 10 = transferência (o cliente é a outra filial). Outro código aparece
 * como "Tipo N".
 */
export function tipoVendaInfo(cond: number | null): { label: string; badge: string } {
  switch (cond) {
    case 1: return { label: "Venda normal", badge: "bg-slate-100 text-slate-600" };
    case 5: return { label: "Bonificação", badge: "bg-amber-100 text-amber-800" };
    case 10: return { label: "Transferência", badge: "bg-[#eef0fb] text-[#1b2168]" };
    case null: return { label: "—", badge: "bg-slate-100 text-slate-400" };
    default: return { label: `Tipo ${cond}`, badge: "bg-slate-100 text-slate-600" };
  }
}

/** Rótulo curto do estado (para o filtro). */
export const ROTULO_ESTADO: Record<EstadoPedido, string> = {
  L: "Liberado",
  B: "Bloqueado",
  M: "Montado",
  F: "Faturado",
  C: "Cancelado",
};

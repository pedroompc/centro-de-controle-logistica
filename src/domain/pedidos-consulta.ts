// Consulta de pedidos (rotina 335 do Winthor, turbinada). Tipos + rótulos de
// estado compartilhados pela página e pela tabela.

/** Estados de pedido que a tela cobre (PCPEDC.POSICAO). */
export const ESTADOS_PEDIDO = ["L", "B", "M", "F", "C"] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];

export interface PedidoConsulta {
  numped: number;
  data: string; // emissão (ISO YYYY-MM-DD)
  diasNoSistema: number;
  codcli: number;
  cliente: string;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  codRca: number | null;
  rca: string | null; // vendedor (PCUSUARI.NOME)
  posicao: string; // PCPEDC.POSICAO cru
  codMotorista: number | null;
  motorista: string | null;
  dataFaturamento: string | null; // quando foi faturado (ISO) ou null
  notaFiscal: number | null; // nº da NF (PCNFSAID.NUMNOTA) quando faturado
  valor: number;
  peso: number;
  qtdItens: number;
  temDevolucao: boolean;
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

/** Rótulo curto do estado (para o filtro). */
export const ROTULO_ESTADO: Record<EstadoPedido, string> = {
  L: "Liberado",
  B: "Bloqueado",
  M: "Montado",
  F: "Faturado",
  C: "Cancelado",
};

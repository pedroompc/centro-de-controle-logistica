/**
 * Devoluções de cliente por setor/motivo/cliente/motorista — MESMA regra do card
 * oficial (rotina 111, valor líquido, por data da devolução). A quebra considera
 * só a devolução vinculada a uma NF de venda (a avulsa é isolada, como no 111),
 * então a soma das partes bate com o total oficial de devolução do faturamento.
 */
export type SetorDevolucao = "Logística" | "Comercial" | "Faturamento" | "Não classificado";

export interface DevolucaoPorMotivo {
  motivo: string;
  setor: SetorDevolucao;
  notas: number;
  valor: number;
}

export interface DevolucaoPorSetor {
  setor: SetorDevolucao;
  notas: number;
  valor: number;
}

export interface DevolucaoPorCliente {
  codcli: number;
  nome: string;
  notas: number;
  valor: number;
}

export interface DevolucaoPorMotorista {
  codMotorista: number;
  nome: string;
  expedidas: number; // notas entregues via carga
  devolvidas: number;
  taxa: number; // % = devolvidas / expedidas
  valorDevolvido: number;
}

export interface ResumoDevolucoes {
  total: number;
  porSetor: DevolucaoPorSetor[];
  porMotivo: DevolucaoPorMotivo[];
  topClientes: DevolucaoPorCliente[];
  porMotorista: DevolucaoPorMotorista[];
}

/**
 * Motorista com a maior taxa de devolução, considerando só quem tem volume
 * relevante (>= `minExpedidas`) — evita eleger alguém com 1 entrega e 1 devolução.
 * Retorna null se ninguém atinge o volume mínimo.
 */
export function piorMotorista(
  lista: DevolucaoPorMotorista[],
  minExpedidas = 50,
): DevolucaoPorMotorista | null {
  return lista
    .filter((m) => m.expedidas >= minExpedidas)
    .reduce<DevolucaoPorMotorista | null>(
      (pior, m) => (pior === null || m.taxa > pior.taxa ? m : pior),
      null,
    );
}

const ORDEM_SETOR: SetorDevolucao[] = ["Logística", "Comercial", "Faturamento", "Não classificado"];

/**
 * Agrega os motivos por setor responsável, somando valor e notas. Ordena por
 * uma ordem fixa (Logística primeiro) e descarta setores sem devolução.
 */
export function agregarPorSetor(motivos: DevolucaoPorMotivo[]): DevolucaoPorSetor[] {
  const mapa = new Map<SetorDevolucao, DevolucaoPorSetor>();
  for (const m of motivos) {
    const atual = mapa.get(m.setor) ?? { setor: m.setor, notas: 0, valor: 0 };
    atual.notas += m.notas;
    atual.valor += m.valor;
    mapa.set(m.setor, atual);
  }
  return ORDEM_SETOR.filter((s) => mapa.has(s)).map((s) => mapa.get(s)!);
}

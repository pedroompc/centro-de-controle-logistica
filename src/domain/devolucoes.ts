/**
 * Devoluções de cliente por motivo/setor/cliente — regra da rotina 1311 do
 * Winthor (valor BRUTO da nota de entrada de devolução). É uma métrica distinta
 * da devolução do faturamento (rotina 111, valor líquido) — os totais não batem
 * de propósito.
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

export interface ResumoDevolucoes {
  total: number;
  porSetor: DevolucaoPorSetor[];
  porMotivo: DevolucaoPorMotivo[];
  topClientes: DevolucaoPorCliente[];
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

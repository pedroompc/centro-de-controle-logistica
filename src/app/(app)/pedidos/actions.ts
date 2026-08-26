"use server";

import { getItensPedido, getTelefoneRca } from "@/data/pedidos-consulta";
import type { ItemPedido } from "@/domain/pedidos-consulta";

/**
 * Detalhe do pedido carregado sob demanda: itens + telefone do RCA. O telefone é
 * tolerante a falha (não quebra nada se a coluna variar na base).
 */
export async function carregarDetalhePedido(
  numped: number,
  codRca?: number | null,
): Promise<{ itens: ItemPedido[]; telefoneRca: string | null }> {
  const [itens, telefoneRca] = await Promise.all([
    Number.isFinite(numped) && numped > 0 ? getItensPedido(numped) : Promise.resolve<ItemPedido[]>([]),
    codRca != null && Number.isFinite(codRca) && codRca > 0 ? getTelefoneRca(codRca) : Promise.resolve<string | null>(null),
  ]);
  return { itens, telefoneRca };
}

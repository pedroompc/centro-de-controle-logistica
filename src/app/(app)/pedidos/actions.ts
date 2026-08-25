"use server";

import { getItensPedido } from "@/data/pedidos-consulta";
import type { ItemPedido } from "@/domain/pedidos-consulta";

/** Itens de um pedido, carregados sob demanda ao abrir o detalhe na tabela. */
export async function carregarItensPedido(numped: number): Promise<ItemPedido[]> {
  if (!Number.isFinite(numped) || numped <= 0) return [];
  return getItensPedido(numped);
}

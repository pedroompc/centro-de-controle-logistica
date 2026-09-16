"use server";

import {
  getClientesDevolucao,
  getVendedoresDevolucao,
  getMotoristasDevolucao,
  getDevolucaoPorCidade,
  getDevolucaoPorBairroRMR,
} from "@/data/devolucoes";
import { comTaxa, comTaxaBairro } from "@/domain/devolucoes-mapa";
import { inicioFimDoMes, limitarAoHistorico, primeiroDiaDoMes } from "@/domain/periodo";
import type {
  SecaoRanking,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  DevolucaoPorMotorista,
} from "@/domain/devolucoes";
import type { CidadeDevolucao, BairroDevolucao } from "@/domain/devolucoes-mapa";

// Recalcula o período no servidor a partir do mês (ISO), sem confiar em datas
// vindas do cliente. `mes` é o mesSel já usado na página; limita ao histórico.
function periodo(mes: string) {
  return inicioFimDoMes(limitarAoHistorico(mes || primeiroDiaDoMes()));
}

export async function carregarClientes(
  mes: string, motivo?: string, setor?: string,
): Promise<SecaoRanking<DevolucaoPorCliente>> {
  const { inicio, fim } = periodo(mes);
  return getClientesDevolucao(inicio, fim, motivo, setor);
}

export async function carregarVendedores(
  mes: string, motivo?: string, setor?: string,
): Promise<SecaoRanking<DevolucaoPorVendedor>> {
  const { inicio, fim } = periodo(mes);
  return getVendedoresDevolucao(inicio, fim, motivo, setor);
}

export async function carregarMotoristas(
  mes: string, motivo?: string, setor?: string,
): Promise<SecaoRanking<DevolucaoPorMotorista>> {
  const { inicio, fim } = periodo(mes);
  return getMotoristasDevolucao(inicio, fim, motivo, setor);
}

export async function carregarMapa(mes: string): Promise<CidadeDevolucao[]> {
  const { inicio, fim } = periodo(mes);
  return comTaxa(await getDevolucaoPorCidade(inicio, fim));
}

/** Devolução por bairro na RMR (cidade + bairro), ordenada por R$ devolvido. */
export async function carregarBairrosRMR(mes: string): Promise<BairroDevolucao[]> {
  const { inicio, fim } = periodo(mes);
  return comTaxaBairro(await getDevolucaoPorBairroRMR(inicio, fim)).sort((a, b) => b.devolvido - a.devolvido);
}

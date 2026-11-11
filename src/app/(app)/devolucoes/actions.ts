"use server";

import {
  getClientesDevolucao,
  getVendedoresDevolucao,
  getMotoristasDevolucao,
  getDevolucaoPorCidade,
  getDevolucaoPorBairro,
  getDevolucaoPorDiaSemana,
} from "@/data/devolucoes";
import { getProtocolosDevolucao } from "@/data/devolucoes-protocolos";
import { montarRelatorio, type RelatorioProtocolos } from "@/domain/devolucoes-protocolos";
import { comTaxa } from "@/domain/devolucoes-mapa";
import { baseDevolucao } from "@/domain/devolucoes-dia-semana";
import { lerPeriodo, PISO_WINTHOR } from "@/domain/periodo";
import type {
  SecaoRanking,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  DevolucaoPorMotorista,
} from "@/domain/devolucoes";
import type { CidadeDevolucao, BairroDevolucao } from "@/domain/devolucoes-mapa";
import type { DevolucaoDiaSemana } from "@/domain/devolucoes-dia-semana";

/** Contexto comum das abas: filtros da página, saneados no servidor. */
export interface ContextoDevolucao {
  de: string;
  ate: string;
  motivo?: string;
  setor?: string;
  ibge?: string;
  base?: string;
}

function contexto(c: ContextoDevolucao) {
  // Revalida o período no servidor (mesmo saneamento da página).
  const { de: inicio, ate: fim } = lerPeriodo({ de: c.de, ate: c.ate }, { piso: PISO_WINTHOR });
  return {
    inicio,
    fim,
    motivo: c.motivo || undefined,
    setor: c.setor || undefined,
    ibge: c.ibge && /^\d{7}$/.test(c.ibge) ? c.ibge : undefined,
    base: baseDevolucao(c.base),
  };
}

export async function carregarClientes(c: ContextoDevolucao): Promise<SecaoRanking<DevolucaoPorCliente>> {
  const x = contexto(c);
  return getClientesDevolucao(x.inicio, x.fim, x.motivo, x.setor, x.ibge, x.base);
}

export async function carregarVendedores(c: ContextoDevolucao): Promise<SecaoRanking<DevolucaoPorVendedor>> {
  const x = contexto(c);
  return getVendedoresDevolucao(x.inicio, x.fim, x.motivo, x.setor, x.ibge, x.base);
}

export async function carregarMotoristas(c: ContextoDevolucao): Promise<SecaoRanking<DevolucaoPorMotorista>> {
  const x = contexto(c);
  return getMotoristasDevolucao(x.inicio, x.fim, x.motivo, x.setor, x.ibge, x.base);
}

export async function carregarDiaSemana(c: ContextoDevolucao): Promise<DevolucaoDiaSemana[]> {
  const x = contexto(c);
  return getDevolucaoPorDiaSemana(x.inicio, x.fim, x.motivo, x.setor, x.ibge, x.base);
}

/** Mapa de PE: sempre todas as cidades (é onde se escolhe a cidade), na base escolhida. */
export async function carregarMapa(c: ContextoDevolucao): Promise<CidadeDevolucao[]> {
  const x = contexto(c);
  return comTaxa(await getDevolucaoPorCidade(x.inicio, x.fim, x.base));
}

/** Bairros da RMR — ou da cidade escolhida —, ordenados por R$ devolvido. */
export async function carregarBairros(c: ContextoDevolucao): Promise<BairroDevolucao[]> {
  const x = contexto(c);
  return getDevolucaoPorBairro(x.inicio, x.fim, x.base, x.ibge);
}

/** Retorno ao estoque (protocolos do Harpia): em aberto agora + criados no período. */
export async function carregarProtocolos(c: Pick<ContextoDevolucao, "de" | "ate">): Promise<RelatorioProtocolos> {
  const { de: inicio, ate: fim } = lerPeriodo({ de: c.de, ate: c.ate }, { piso: PISO_WINTHOR });
  const { protocolos, planilhas } = await getProtocolosDevolucao(inicio, fim);
  return montarRelatorio(protocolos, planilhas);
}

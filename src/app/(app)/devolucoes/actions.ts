"use server";

import {
  getClientesDevolucao,
  getVendedoresDevolucao,
  getMotoristasDevolucao,
  getDevolucaoPorCidade,
  getDevolucaoPorBairro,
  getDevolucaoPorDiaSemana,
} from "@/data/devolucoes";
import { comTaxa } from "@/domain/devolucoes-mapa";
import { baseDevolucao } from "@/domain/devolucoes-dia-semana";
import { inicioFimDoMes, limitarAoHistorico, primeiroDiaDoMes } from "@/domain/periodo";
import type {
  SecaoRanking,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  DevolucaoPorMotorista,
} from "@/domain/devolucoes";
import type { CidadeDevolucao, BairroDevolucao } from "@/domain/devolucoes-mapa";
import type { DevolucaoDiaSemana } from "@/domain/devolucoes-dia-semana";

// Recalcula o período no servidor a partir do mês (ISO), sem confiar em datas
// vindas do cliente. `mes` é o mesSel já usado na página; limita ao histórico.
function periodo(mes: string) {
  return inicioFimDoMes(limitarAoHistorico(mes || primeiroDiaDoMes()));
}

/** Contexto comum das abas: filtros da página, saneados no servidor. */
export interface ContextoDevolucao {
  mes: string;
  motivo?: string;
  setor?: string;
  ibge?: string;
  base?: string;
}

function contexto(c: ContextoDevolucao) {
  const { inicio, fim } = periodo(c.mes);
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

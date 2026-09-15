"use server";

import { getNucleoDevolucao } from "@/data/devolucoes";
import { getResumoFaturamentoDashboard } from "@/data/faturamento-mensal";
import { taxaDevolucao, taxaDevolucaoNotas } from "@/domain/faturamento";
import { inicioFimDoMes, limitarAoHistorico, primeiroDiaDoMes } from "@/domain/periodo";
import type { DevolucaoPorSetor, DevolucaoPorMotivo } from "@/domain/devolucoes";

/**
 * Recalcula o período no servidor a partir do mês (ISO), sem confiar em datas
 * vindas do cliente — mesma regra das actions das abas.
 */
function periodo(mes: string) {
  return inicioFimDoMes(limitarAoHistorico(mes || primeiroDiaDoMes()));
}

/** Bloco de indicadores do topo do Modo TV — o "placar" que fica sempre visível. */
export interface ResumoTv {
  disponivel: boolean; // false = Winthor fora da rede (mostra aviso, sem números)
  total: number; // valor devolvido (oficial, rotina 111)
  vendaFaturada: number;
  vendaLiquida: number; // faturamento LÍQUIDO = faturada − devolução − avulsa
  valorDevolucaoAvulsa: number;
  devolvidasAvulsas: number;
  taxaValor: number; // 0..1
  taxaNotas: number; // 0..1
  devolvidas: number;
  emitidas: number;
  porSetor: DevolucaoPorSetor[];
  porMotivo: DevolucaoPorMotivo[]; // vem de graça com o núcleo — alimenta o slide de motivos
}

const VAZIO: ResumoTv = {
  disponivel: false,
  total: 0,
  vendaFaturada: 0,
  vendaLiquida: 0,
  valorDevolucaoAvulsa: 0,
  devolvidasAvulsas: 0,
  taxaValor: 0,
  taxaNotas: 0,
  devolvidas: 0,
  emitidas: 0,
  porSetor: [],
  porMotivo: [],
};

/**
 * Placar do Modo TV: total/por setor (núcleo) + faturamento (líquido e taxas).
 * Reusa os mesmos números oficiais dos cards da página de Devoluções. Roda no
 * refresh longo da TV (a cada poucos minutos), nunca a cada rotação de slide,
 * então não martela o Oracle.
 */
export async function carregarResumoTv(mes: string): Promise<ResumoTv> {
  const { inicio, fim } = periodo(mes);
  const [nucleo, fat] = await Promise.all([
    getNucleoDevolucao(inicio, fim),
    getResumoFaturamentoDashboard(limitarAoHistorico(mes || primeiroDiaDoMes())),
  ]);

  if (!nucleo && !fat) return VAZIO;

  return {
    disponivel: true,
    total: nucleo?.total ?? fat?.valorDevolucao ?? 0,
    vendaFaturada: fat?.vendaFaturada ?? 0,
    vendaLiquida: fat?.vendaLiquida ?? 0,
    valorDevolucaoAvulsa: fat?.valorDevolucaoAvulsa ?? 0,
    devolvidasAvulsas: fat?.devolvidasAvulsas ?? 0,
    taxaValor: fat ? taxaDevolucao(fat) : 0,
    taxaNotas: fat ? taxaDevolucaoNotas(fat) : 0,
    devolvidas: fat?.devolvidas ?? 0,
    emitidas: fat?.emitidas ?? 0,
    porSetor: nucleo?.porSetor ?? [],
    porMotivo: nucleo?.porMotivo ?? [],
  };
}

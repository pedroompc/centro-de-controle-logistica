"use server";

import { getNucleoDevolucao } from "@/data/devolucoes";
import { getResumoFaturamentoDashboard } from "@/data/faturamento-mensal";
import { getPedidosPendentes } from "@/data/pedidos-a-faturar";
import { listarReceitasDoMes, serieReceitasMensais } from "@/data/receitas";
import { listarTotaisDiariosDoMes } from "@/data/receitas-diario";
import { totalDiversasDoMes } from "@/data/receitas-diversas";
import { taxaDevolucao, taxaDevolucaoNotas } from "@/domain/faturamento";
import { inicioFimDoMes, limitarAoHistorico, primeiroDiaDoMes } from "@/domain/periodo";
import type { DevolucaoPorSetor, DevolucaoPorMotivo } from "@/domain/devolucoes";
import type { PedidoPendente } from "@/domain/pedidos-a-faturar/tipos";

/** Período no servidor a partir do mês (ISO) — nunca confia em datas do cliente. */
function periodo(mes: string) {
  return inicioFimDoMes(limitarAoHistorico(mes || primeiroDiaDoMes()));
}
function mesNorm(mes: string) {
  return limitarAoHistorico(mes || primeiroDiaDoMes());
}

// --- Devolução (placar + motivos) --------------------------------------------

export interface ResumoDevolucao {
  disponivel: boolean;
  total: number; // valor devolvido oficial (rotina 111)
  vendaFaturada: number;
  vendaLiquida: number; // faturamento LÍQUIDO
  valorDevolucaoAvulsa: number;
  devolvidasAvulsas: number;
  taxaValor: number;
  taxaNotas: number;
  devolvidas: number;
  emitidas: number;
  porSetor: DevolucaoPorSetor[];
  porMotivo: DevolucaoPorMotivo[];
}

const DEV_VAZIO: ResumoDevolucao = {
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

/** Placar de devolução do painel — os mesmos números oficiais da página. */
export async function carregarResumoDevolucao(mes: string): Promise<ResumoDevolucao> {
  const { inicio, fim } = periodo(mes);
  const [nucleo, fat] = await Promise.all([
    getNucleoDevolucao(inicio, fim),
    getResumoFaturamentoDashboard(mesNorm(mes)),
  ]);
  if (!nucleo && !fat) return DEV_VAZIO;
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

// --- A faturar (pedidos parados) ---------------------------------------------

export interface ResumoAFaturar {
  disponivel: boolean; // false = Winthor fora da rede
  totalPedidos: number;
  valorTotal: number;
  parados72h: number; // pedidos parados há 72h ou mais
  topCidades: { chave: string; nome: string; qtd: number; valor: number }[];
  topRca: { chave: string; nome: string; qtd: number; valor: number }[];
}

/** Resumo do que ainda falta faturar (pedidos liberados/montados sem NF). */
export async function carregarAFaturar(): Promise<ResumoAFaturar> {
  const pedidos = await getPedidosPendentes();
  if (pedidos === null) {
    return { disponivel: false, totalPedidos: 0, valorTotal: 0, parados72h: 0, topCidades: [], topRca: [] };
  }

  const agrupa = (chave: (p: PedidoPendente) => { id: string; nome: string }) => {
    const mapa = new Map<string, { chave: string; nome: string; qtd: number; valor: number }>();
    for (const p of pedidos) {
      const { id, nome } = chave(p);
      const atual = mapa.get(id) ?? { chave: id, nome, qtd: 0, valor: 0 };
      atual.qtd += 1;
      atual.valor += p.valorPedido;
      mapa.set(id, atual);
    }
    return [...mapa.values()].sort((a, b) => b.valor - a.valor).slice(0, 8);
  };

  return {
    disponivel: true,
    totalPedidos: pedidos.length,
    valorTotal: pedidos.reduce((t, p) => t + p.valorPedido, 0),
    parados72h: pedidos.filter((p) => p.horasParado >= 72).length,
    topCidades: agrupa((p) => ({
      id: p.cidadeCliente ?? "—",
      nome: p.cidadeCliente ? `${p.cidadeCliente}${p.ufCliente ? `/${p.ufCliente}` : ""}` : "Sem cidade",
    })),
    topRca: agrupa((p) => ({ id: String(p.codigoRca), nome: p.nomeRca || `RCA ${p.codigoRca}` })),
  };
}

// --- Receitas -----------------------------------------------------------------

export interface ResumoReceitas {
  totalMes: number;
  descarregamento: number; // origem: lançamentos por fornecedor
  diarios: number; // origem: totais diários de descarregamento
  diversas: number; // origem: reciclagem etc.
  serie: { mes: string; valor: number }[]; // últimos meses (soma das 3 origens)
}

/** Receitas do mês por origem + série mensal (mesmas fontes da página Receitas). */
export async function carregarReceitas(mes: string): Promise<ResumoReceitas> {
  const m = mesNorm(mes);
  const [descLista, diariosLista, diversas, serie] = await Promise.all([
    listarReceitasDoMes(m),
    listarTotaisDiariosDoMes(m),
    totalDiversasDoMes(m),
    serieReceitasMensais(6),
  ]);
  const descarregamento = descLista.reduce((t, r) => t + r.receita, 0);
  const diarios = diariosLista.reduce((t, r) => t + r.receita, 0);
  return {
    totalMes: descarregamento + diarios + diversas,
    descarregamento,
    diarios,
    diversas,
    serie,
  };
}

// --- Descarregamento (por dia / semana / mês) --------------------------------

export interface ResumoDescarregos {
  totalMes: number; // soma de carros descarregados no mês
  receitaMes: number; // receita dos totais diários no mês
  porDia: { data: string; descarregos: number }[]; // dias com lançamento, em ordem
  porSemana: { rotulo: string; descarregos: number }[]; // agrupado por semana do mês
}

/** Número da semana do mês (1ª..5ª) a partir do dia. */
function semanaDoMes(iso: string): number {
  const dia = Number(iso.slice(8, 10));
  return Math.floor((dia - 1) / 7) + 1;
}

/** Descarregos por dia/semana/mês a partir dos totais diários. */
export async function carregarDescarregos(mes: string): Promise<ResumoDescarregos> {
  const linhas = await listarTotaisDiariosDoMes(mesNorm(mes));
  const porDia = [...linhas]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map((l) => ({ data: l.data, descarregos: l.descarregos }));

  const semanas = new Map<number, number>();
  for (const l of linhas) {
    const s = semanaDoMes(l.data);
    semanas.set(s, (semanas.get(s) ?? 0) + l.descarregos);
  }
  const porSemana = [...semanas.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([s, descarregos]) => ({ rotulo: `${s}ª sem`, descarregos }));

  return {
    totalMes: linhas.reduce((t, l) => t + l.descarregos, 0),
    receitaMes: linhas.reduce((t, l) => t + l.receita, 0),
    porDia,
    porSemana,
  };
}

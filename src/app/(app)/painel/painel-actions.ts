"use server";

import { getNucleoDevolucao, getDevolucaoPorBairroRMR } from "@/data/devolucoes";
import type { BairroDevolucao } from "@/domain/devolucoes-mapa";
import { getResumoFaturamentoDashboard } from "@/data/faturamento-mensal";
import { getPedidosPendentes } from "@/data/pedidos-a-faturar";
import { listarReceitasDoMes, serieReceitasMensais } from "@/data/receitas";
import { listarTotaisDiariosDoMes } from "@/data/receitas-diario";
import { listarCarrosDia } from "@/data/carros-dia";
import { totalDiversasDoMes, serieDiversasPorMaterialMensal } from "@/data/receitas-diversas";
import { serieDescarregoMensal } from "@/data/descarregamento-mensal";
import { diariosDosLancamentos, type PontoDescarregoMensal } from "@/domain/descarregamento-tendencia";
import type { DescarregamentoTipo } from "@/domain/types";
import { taxaDevolucao, taxaDevolucaoNotas } from "@/domain/faturamento";
import { inicioFimDoMes, limitarAoHistorico, primeiroDiaDoMes } from "@/domain/periodo";
import { classificarRegiao, ORDEM_REGIAO, type RegiaoPE } from "@/domain/pe-regioes";
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
  pesoFaturado: number; // kg líquido (venda − devolução)
  valorDevolucaoAvulsa: number;
  devolvidasAvulsas: number;
  taxaValor: number;
  taxaNotas: number;
  devolvidas: number;
  emitidas: number;
  positivados: number; // clientes positivados no mês
  atendimentos: number; // entregas realizadas (clientes atendidos)
  porSetor: DevolucaoPorSetor[];
  porMotivo: DevolucaoPorMotivo[];
}

const DEV_VAZIO: ResumoDevolucao = {
  disponivel: false,
  total: 0,
  vendaFaturada: 0,
  vendaLiquida: 0,
  pesoFaturado: 0,
  valorDevolucaoAvulsa: 0,
  devolvidasAvulsas: 0,
  taxaValor: 0,
  taxaNotas: 0,
  devolvidas: 0,
  emitidas: 0,
  positivados: 0,
  atendimentos: 0,
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
    pesoFaturado: fat?.pesoFaturado ?? 0,
    valorDevolucaoAvulsa: fat?.valorDevolucaoAvulsa ?? 0,
    devolvidasAvulsas: fat?.devolvidasAvulsas ?? 0,
    taxaValor: fat ? taxaDevolucao(fat) : 0,
    taxaNotas: fat ? taxaDevolucaoNotas(fat) : 0,
    devolvidas: fat?.devolvidas ?? 0,
    emitidas: fat?.emitidas ?? 0,
    positivados: fat?.positivados ?? 0,
    atendimentos: fat?.atendimentos ?? 0,
    porSetor: nucleo?.porSetor ?? [],
    porMotivo: nucleo?.porMotivo ?? [],
  };
}

/** Devolução por bairro na RMR (cidade + bairro), já ordenada por R$ devolvido. */
export async function carregarDevBairrosRMR(mes: string): Promise<BairroDevolucao[]> {
  const { inicio, fim } = periodo(mes);
  return (await getDevolucaoPorBairroRMR(inicio, fim)).slice(0, 20);
}

// --- A faturar (pedidos parados) ---------------------------------------------

export interface GrupoAFaturar {
  chave: string;
  nome: string;
  qtd: number;
  valor: number;
}

export interface ResumoAFaturar {
  disponivel: boolean; // false = Winthor fora da rede
  totalPedidos: number; // pedidos a faturar (carteira)
  valorTotal: number; // R$ da carteira
  pesoTotal: number; // kg da carteira
  topCidades: GrupoAFaturar[];
  porRegiao: GrupoAFaturar[]; // RMR / Agreste / Sertão / Zona da Mata / Outras
}

/** Resumo do que ainda falta faturar — a "carteira" (liberados/montados sem NF). */
export async function carregarAFaturar(): Promise<ResumoAFaturar> {
  const pedidos = await getPedidosPendentes();
  if (pedidos === null) {
    return { disponivel: false, totalPedidos: 0, valorTotal: 0, pesoTotal: 0, topCidades: [], porRegiao: [] };
  }

  const agrupar = (
    chave: (p: PedidoPendente) => { id: string; nome: string },
    ordenar: (itens: GrupoAFaturar[]) => GrupoAFaturar[],
  ) => {
    const mapa = new Map<string, GrupoAFaturar>();
    for (const p of pedidos) {
      const { id, nome } = chave(p);
      const atual = mapa.get(id) ?? { chave: id, nome, qtd: 0, valor: 0 };
      atual.qtd += 1;
      atual.valor += p.valorPedido;
      mapa.set(id, atual);
    }
    return ordenar([...mapa.values()]);
  };

  const topCidades = agrupar(
    (p) => ({
      id: p.cidadeCliente ?? "—",
      nome: p.cidadeCliente ? `${p.cidadeCliente}${p.ufCliente ? `/${p.ufCliente}` : ""}` : "Sem cidade",
    }),
    (itens) => itens.sort((a, b) => b.valor - a.valor).slice(0, 8),
  );

  const porRegiao = agrupar(
    (p) => {
      const r = classificarRegiao(p.cidadeCliente, p.ufCliente);
      return { id: r, nome: r };
    },
    (itens) => itens.sort((a, b) => ORDEM_REGIAO.indexOf(a.chave as RegiaoPE) - ORDEM_REGIAO.indexOf(b.chave as RegiaoPE)),
  );

  return {
    disponivel: true,
    totalPedidos: pedidos.length,
    valorTotal: pedidos.reduce((t, p) => t + p.valorPedido, 0),
    pesoTotal: pedidos.reduce((t, p) => t + p.pesoPedido, 0),
    topCidades,
    porRegiao,
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

// --- Receitas · drivers por mês (o "porquê" do mês) --------------------------

export interface MesReceitaDetalhe {
  mes: string; // "yyyy-mm-01"
  receita: number; // receita total do mês (3 origens)
  carros: number; // carros descarregados no mês (batido+paletizado+pal-rem)
  caixas: number; // volume, em caixas (unidade separada de carros)
  porTipo: Record<DescarregamentoTipo, number>; // qtd por tipo (inclui volume)
  pesoPorTipo: Record<DescarregamentoTipo, number>; // kg por tipo (só lançamento por fornecedor)
  descargasVolume: number; // descargas de Volume (lançamentos), fora de `carros`
  pesoKg: number; // peso descarregado
  diversas: number; // total de receitas diversas
  materiais: { material: string; kg: number; valor: number }[]; // top materiais de diversas
}

/**
 * Detalhe por mês para explicar POR QUE um mês rendeu mais que o outro: junta a
 * receita total com os drivers do descarrego (carros por tipo + peso) e a quebra
 * de diversas por material. Alinhado aos meses da série de receita.
 */
export async function carregarReceitasDrivers(qtdMeses = 6): Promise<MesReceitaDetalhe[]> {
  const [receita, desc, diversas] = await Promise.all([
    serieReceitasMensais(qtdMeses),
    serieDescarregoMensal(qtdMeses),
    serieDiversasPorMaterialMensal(),
  ]);
  const descPorMes = new Map(desc.map((d) => [d.mes, d]));
  const divPorMes = new Map<string, { material: string; kg: number; valor: number }[]>();
  const divTotalPorMes = new Map<string, number>();
  for (const d of diversas) {
    const arr = divPorMes.get(d.mes) ?? [];
    arr.push({ material: d.material, kg: d.kg, valor: d.valor });
    divPorMes.set(d.mes, arr);
    divTotalPorMes.set(d.mes, (divTotalPorMes.get(d.mes) ?? 0) + d.valor);
  }
  return receita.map((r) => {
    const d = descPorMes.get(r.mes);
    return {
      mes: r.mes,
      receita: r.valor,
      carros: d?.carros ?? 0,
      caixas: d?.caixas ?? 0,
      porTipo: d?.porTipo ?? { batido: 0, paletizado: 0, pal_rem: 0, volume: 0 },
      pesoPorTipo: d?.pesoPorTipo ?? { batido: 0, paletizado: 0, pal_rem: 0, volume: 0 },
      descargasVolume: d?.descargasVolume ?? 0,
      pesoKg: d?.pesoKg ?? 0,
      diversas: divTotalPorMes.get(r.mes) ?? 0,
      materiais: (divPorMes.get(r.mes) ?? []).sort((a, b) => b.valor - a.valor).slice(0, 3),
    };
  });
}

// --- Descarregamento (por dia / semana / mês) --------------------------------

export interface ResumoDescarregos {
  totalMes: number; // soma de carros descarregados no mês
  receitaMes: number; // receita de descarrego no mês (total do dia + por fornecedor)
  porDia: { data: string; descarregos: number }[]; // dias com lançamento, em ordem
  porSemana: { rotulo: string; descarregos: number }[]; // agrupado por semana do mês
}

/** Número da semana do mês (1ª..5ª) a partir do dia. */
function semanaDoMes(iso: string): number {
  const dia = Number(iso.slice(8, 10));
  return Math.floor((dia - 1) / 7) + 1;
}

/** Série mensal de descarrego (carros, tipo, peso) — comparação no slide da TV. */
export async function carregarSerieDescarrego(qtdMeses = 6): Promise<PontoDescarregoMensal[]> {
  return serieDescarregoMensal(qtdMeses);
}

/**
 * Descarregos (carros) por dia/semana/mês, somando total do dia e lançamento por
 * fornecedor — o mesmo dia pode ter os dois e vira uma barra só.
 */
export async function carregarDescarregos(mes: string): Promise<ResumoDescarregos> {
  const m = mesNorm(mes);
  const { inicio, fim } = inicioFimDoMes(m);
  const [totais, lancamentos, carros] = await Promise.all([
    listarTotaisDiariosDoMes(m),
    listarReceitasDoMes(m),
    listarCarrosDia(inicio, fim),
  ]);
  const linhas = [...totais, ...diariosDosLancamentos(lancamentos, carros)];

  const dias = new Map<string, number>();
  for (const l of linhas) dias.set(l.data, (dias.get(l.data) ?? 0) + l.descarregos);
  const porDia = [...dias.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, descarregos]) => ({ data, descarregos }));

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

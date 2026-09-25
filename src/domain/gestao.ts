import { mesAnterior, primeiroDiaDoMes } from "./periodo";
import { porUnidade } from "./wms";
import { variacaoPercentual } from "./tendencias";

/** Nível de serviço: pedido liberado → nota autorizada, por mês (WinThor). */
export interface ServicoMes {
  pedidos: number;
  ateD0: number; // faturados no mesmo dia da liberação
  ateD1: number; // até o dia seguinte
  d3mais: number; // 3 dias ou mais
  medianaHoras: number | null; // só quando a liberação tem hora gravada (ver `comHora`)
  p90Horas: number | null;
  comHora: number; // pedidos cuja liberação tem hora de verdade
}

/** Tudo o que o painel mostra de um mês. `null` = fonte indisponível (≠ zero). */
export interface MesGestao {
  mes: string;
  vendaFaturada: number | null;
  vendaLiquida: number | null;
  valorDevolucao: number | null;
  pesoKg: number | null;
  entregas: number | null; // clientes distintos por dia
  notas: number | null;
  devLogistica: number | null; // R$ devolvido com motivo do setor Logística
  servico: ServicoMes | null;
  movVerticais: number | null;
  movHorizontais: number | null;
  faltas: number | null;
}

export const MES_VAZIO = (mes: string): MesGestao => ({
  mes, vendaFaturada: null, vendaLiquida: null, valorDevolucao: null, pesoKg: null,
  entregas: null, notas: null, devLogistica: null, servico: null,
  movVerticais: null, movHorizontais: null, faltas: null,
});

/**
 * Janela do painel: 13 meses terminando em `mes` (inclusive), do mais antigo ao
 * mais novo. 13 e não 12 para o mesmo mês do ano anterior estar dentro dela.
 */
export function janelaGestao(mes: string): string[] {
  const lista = [primeiroDiaDoMes(mes)];
  while (lista.length < 13) lista.unshift(mesAnterior(lista[0]));
  return lista;
}

/** Mesmo mês do ano anterior. */
export function mesAnoAnterior(mes: string): string {
  const [ano, m] = mes.split("-");
  return `${Number(ano) - 1}-${m}-01`;
}

export type Direcao = "maiorMelhor" | "menorMelhor" | "neutro";
export type Formato = "brl" | "toneladas" | "inteiro" | "percent" | "decimal" | "horas";

export interface Indicador {
  id: string;
  grupo: "Serviço" | "Volume" | "Qualidade" | "Armazém" | "Pessoas";
  nome: string;
  formato: Formato;
  direcao: Direcao;
  // Taxas comparam em pontos percentuais (p.p.); volumes, em % de variação.
  comparacao: "pct" | "pp";
  valor: (m: MesGestao) => number | null;
  ajuda: string;
}

const taxa = (num: number | null, den: number | null): number | null =>
  num === null || den === null || den <= 0 ? null : num / den;

const soma = (a: number | null, b: number | null): number | null =>
  a === null || b === null ? null : a + b;

export const INDICADORES: Indicador[] = [
  {
    id: "d1", grupo: "Serviço", nome: "Pedidos faturados até D+1", formato: "percent",
    direcao: "maiorMelhor", comparacao: "pp",
    valor: (m) => (m.servico ? taxa(m.servico.ateD1, m.servico.pedidos) : null),
    ajuda: "Da liberação do pedido à nota autorizada na SEFAZ, em até 1 dia de calendário.",
  },
  {
    id: "d0", grupo: "Serviço", nome: "Pedidos faturados no mesmo dia", formato: "percent",
    direcao: "maiorMelhor", comparacao: "pp",
    valor: (m) => (m.servico ? taxa(m.servico.ateD0, m.servico.pedidos) : null),
    ajuda: "Liberado e faturado no mesmo dia.",
  },
  {
    id: "d3", grupo: "Serviço", nome: "Pedidos com 3+ dias até faturar", formato: "percent",
    direcao: "menorMelhor", comparacao: "pp",
    valor: (m) => (m.servico ? taxa(m.servico.d3mais, m.servico.pedidos) : null),
    ajuda: "A cauda: pedidos que ficaram 3 dias ou mais entre liberação e nota.",
  },
  {
    id: "lead", grupo: "Serviço", nome: "Tempo liberação → nota (mediana)", formato: "horas",
    direcao: "menorMelhor", comparacao: "pct",
    valor: (m) => m.servico?.medianaHoras ?? null,
    ajuda: "Só aparece quando a liberação do pedido tem hora gravada no WinThor.",
  },
  {
    id: "pedidos", grupo: "Volume", nome: "Pedidos faturados", formato: "inteiro",
    direcao: "neutro", comparacao: "pct", valor: (m) => m.servico?.pedidos ?? null,
    ajuda: "Pedidos com nota autorizada no mês.",
  },
  {
    id: "venda", grupo: "Volume", nome: "Venda líquida", formato: "brl",
    direcao: "maiorMelhor", comparacao: "pct", valor: (m) => m.vendaLiquida,
    ajuda: "Rotina 111: faturado − devoluções (mesma regra do dashboard).",
  },
  {
    id: "peso", grupo: "Volume", nome: "Peso faturado", formato: "toneladas",
    direcao: "neutro", comparacao: "pct", valor: (m) => m.pesoKg,
    ajuda: "Peso líquido faturado (venda − devolução), em toneladas.",
  },
  {
    id: "entregas", grupo: "Volume", nome: "Entregas realizadas", formato: "inteiro",
    direcao: "neutro", comparacao: "pct", valor: (m) => m.entregas,
    ajuda: "Clientes distintos atendidos por dia (mesmo cliente em 2 dias = 2 entregas).",
  },
  {
    id: "kgEntrega", grupo: "Volume", nome: "Kg por entrega", formato: "decimal",
    direcao: "neutro", comparacao: "pct", valor: (m) => taxa(m.pesoKg, m.entregas),
    ajuda: "Tamanho médio da entrega. Cai = pedidos mais picados (mais custo por kg).",
  },
  {
    id: "devolucao", grupo: "Qualidade", nome: "Taxa de devolução (total)", formato: "percent",
    direcao: "menorMelhor", comparacao: "pp", valor: (m) => taxa(m.valorDevolucao, m.vendaFaturada),
    ajuda: "R$ devolvido ÷ R$ faturado.",
  },
  {
    id: "devLog", grupo: "Qualidade", nome: "Devolução por motivo logístico", formato: "percent",
    direcao: "menorMelhor", comparacao: "pp", valor: (m) => taxa(m.devLogistica, m.vendaFaturada),
    ajuda: "Só motivos do setor Logística (avaria, erro de separação, atraso...) ÷ R$ faturado. Calculado para o mês, o anterior e o do ano passado.",
  },
  {
    id: "movTon", grupo: "Armazém", nome: "Movimentos por tonelada", formato: "decimal",
    direcao: "menorMelhor", comparacao: "pct",
    valor: (m) => {
      const mov = soma(m.movVerticais, m.movHorizontais);
      return mov === null || !m.pesoKg ? null : porUnidade(mov, m.pesoKg / 1000);
    },
    ajuda: "Manuseio no galpão por tonelada faturada. Sobe = mais trabalho para o mesmo volume.",
  },
  {
    id: "vert", grupo: "Armazém", nome: "Movimentos verticais", formato: "inteiro",
    direcao: "neutro", comparacao: "pct", valor: (m) => m.movVerticais,
    ajuda: "Movimentos com empilhadeira (acima do nível 01), efetivados no Harpia.",
  },
  {
    id: "horiz", grupo: "Armazém", nome: "Movimentos horizontais", formato: "inteiro",
    direcao: "neutro", comparacao: "pct", valor: (m) => m.movHorizontais,
    ajuda: "Movimentos no chão (nível 01), efetivados no Harpia.",
  },
  {
    id: "faltas", grupo: "Pessoas", nome: "Faltas registradas", formato: "inteiro",
    direcao: "menorMelhor", comparacao: "pct", valor: (m) => m.faltas,
    ajuda: "Faltas lançadas no app no mês. Antes do início do lançamento aparece vazio.",
  },
];

export interface Comparacao {
  valor: number | null;
  base: number | null;
  delta: number | null; // fração (pct) ou pontos percentuais (pp)
  bom: boolean | null; // null = neutro ou sem comparação
}

/** Compara o valor do indicador entre dois meses, respeitando a direção (o que é "bom"). */
export function comparar(ind: Indicador, atual: MesGestao | undefined, base: MesGestao | undefined): Comparacao {
  const valor = atual ? ind.valor(atual) : null;
  const b = base ? ind.valor(base) : null;
  if (valor === null || b === null || (ind.comparacao === "pct" && b === 0)) {
    return { valor, base: b, delta: null, bom: null };
  }
  const delta = ind.comparacao === "pp" ? (valor - b) * 100 : variacaoPercentual(valor, b);
  const bom = ind.direcao === "neutro" || delta === 0
    ? null
    : ind.direcao === "maiorMelhor" ? delta > 0 : delta < 0;
  return { valor, base: b, delta, bom };
}

/** Média dos 12 meses anteriores ao atual, ignorando meses sem dado. */
export function media12(ind: Indicador, serie: MesGestao[], mes: string): number | null {
  const valores = serie
    .filter((m) => m.mes < mes)
    .slice(-12)
    .map((m) => ind.valor(m))
    .filter((v): v is number => v !== null);
  return valores.length ? valores.reduce((s, v) => s + v, 0) / valores.length : null;
}

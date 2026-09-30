import type { CarrosDia, Receita, DescarregamentoTipo, ReceitaDiversa, TotalDiarioDescarregamento } from "./types";
import { TIPOS_DESCARREGAMENTO } from "./descarregamento";

/** Arredonda a 2 casas (centavos), estável para somas de dinheiro. */
export function arredonda2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function toneladas(pesoKg: number): number {
  return pesoKg / 1000;
}

/**
 * Receita de um descarregamento = toneladas × preço/ton, respeitando o valor
 * mínimo cobrado por descarrego (piso, nunca teto), com o resultado final
 * arredondado a 2 casas (centavos).
 * Default `0` preserva o cálculo puro para quem não passa o mínimo (prévias e testes).
 */
export function calcularReceita(
  pesoKg: number,
  precoPorTonelada: number,
  valorMinimo = 0,
): number {
  return arredonda2(Math.max(toneladas(pesoKg) * precoPorTonelada, valorMinimo));
}

/**
 * Receita de um descarregamento por Volume = caixas × preço/caixa, respeitando o
 * mesmo mínimo por descarrego. Sem peso na conta — o peso do Volume é registrado,
 * mas não entra no valor.
 */
export function calcularReceitaVolume(
  quantidade: number,
  precoPorUnidade: number,
  valorMinimo = 0,
): number {
  return arredonda2(Math.max(quantidade * precoPorUnidade, valorMinimo));
}

export function receitaTotal(rs: Receita[]): number {
  return arredonda2(rs.reduce((t, r) => t + r.receita, 0));
}

export function toneladasTotal(rs: Receita[]): number {
  return arredonda2(rs.reduce((t, r) => t + toneladas(r.pesoKg), 0));
}

export function valorMedioPorTonelada(rs: Receita[]): number {
  const tons = toneladasTotal(rs);
  return tons === 0 ? 0 : arredonda2(receitaTotal(rs) / tons);
}

export function receitaPorFornecedor(rs: Receita[]): { fornecedorId: string; nome: string; valor: number }[] {
  const mapa = new Map<string, { fornecedorId: string; nome: string; valor: number }>();
  for (const r of rs) {
    const atual = mapa.get(r.fornecedorId) ?? { fornecedorId: r.fornecedorId, nome: r.fornecedorNome, valor: 0 };
    atual.valor = arredonda2(atual.valor + r.receita);
    mapa.set(r.fornecedorId, atual);
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

export function receitaPorTipo(rs: Receita[]): Record<DescarregamentoTipo, number> {
  const acc = Object.fromEntries(
    TIPOS_DESCARREGAMENTO.map((t) => [t, 0]),
  ) as Record<DescarregamentoTipo, number>;
  for (const r of rs) acc[r.tipo] = arredonda2(acc[r.tipo] + r.receita);
  return acc;
}

/**
 * Quantidade de carros por tipo, juntando os dois modos de lançamento:
 *   • detalhado  → cada linha é 1 carro do seu tipo, exceto nos dias com a
 *     contagem real de carros (`carros`), que substitui as linhas do dia;
 *   • total do dia → soma de `porTipo` (registros antigos, sem quebra, ficam de fora).
 * Diferente de `receitaPorTipo` (R$), que o total do dia não fatia por tipo.
 */
export function quantidadePorTipo(
  rs: Receita[],
  totais: TotalDiarioDescarregamento[] = [],
  carros: CarrosDia[] = [],
): Record<DescarregamentoTipo, number> {
  const acc = Object.fromEntries(
    TIPOS_DESCARREGAMENTO.map((t) => [t, 0]),
  ) as Record<DescarregamentoTipo, number>;
  const carrosPorData = new Map(carros.map((c) => [c.data, c]));
  const diasComLinha = new Set<string>();
  for (const r of rs) {
    diasComLinha.add(r.data);
    if (!carrosPorData.has(r.data)) acc[r.tipo] += 1;
  }
  for (const d of diasComLinha) {
    const c = carrosPorData.get(d);
    if (c) for (const tipo of TIPOS_DESCARREGAMENTO) acc[tipo] += c.porTipo[tipo];
  }
  for (const t of totais) {
    if (!t.porTipo) continue;
    for (const tipo of TIPOS_DESCARREGAMENTO) acc[tipo] += t.porTipo[tipo];
  }
  return acc;
}

export interface DiaDescarregamento {
  data: string; // ISO "yyyy-mm-dd"
  descarregos: number;
  pesoKg: number;
  receita: number;
  /** Como o dia entrou: agregado dos lançamentos por fornecedor, ou digitado direto. */
  origem: "detalhado" | "total";
  /** Só presente em origem "total" — é a linha editável/removível na vista Simples. */
  id?: string;
  /** Origem "detalhado": quantos lançamentos (notas fiscais) o dia tem. */
  notas?: number;
  /** Origem "detalhado": `descarregos` veio da contagem real de carros, não das notas. */
  carrosAjustados?: boolean;
}

/**
 * Colapsa os lançamentos em uma linha por dia: quantos descarregos entraram
 * (contagem real de carros do dia quando existe; senão, 1 por lançamento),
 * quanto pesaram e quanto renderam. É a leitura de quem só quer o resultado do
 * dia, sem o detalhe de fornecedor, tipo e R$/ton.
 *
 * Só descarregamento — receita diversa não tem peso nem contagem de descarrego,
 * então somá-la aqui produziria uma linha em que os três números medem coisas
 * diferentes.
 *
 * Soma o dinheiro com `arredonda2` a cada passo, igual ao resto do módulo: é o
 * que garante que o total do rodapé da tabela feche com o card do topo, que vem
 * por outro caminho de soma.
 *
 * Dias sem lançamento não aparecem — a lista é dos dias com movimento, não do
 * calendário do mês. Ordena do mais recente para o mais antigo, como a tabela
 * detalhada.
 */
export function receitaPorDia(
  rs: Receita[],
  totais: TotalDiarioDescarregamento[] = [],
  carros: CarrosDia[] = [],
): DiaDescarregamento[] {
  const mapa = new Map<string, DiaDescarregamento>();
  for (const r of rs) {
    const atual =
      mapa.get(r.data) ?? { data: r.data, descarregos: 0, pesoKg: 0, receita: 0, origem: "detalhado" as const, notas: 0 };
    atual.descarregos += 1;
    atual.notas! += 1;
    atual.pesoKg += r.pesoKg;
    atual.receita = arredonda2(atual.receita + r.receita);
    mapa.set(r.data, atual);
  }
  // Um lançamento é uma nota, não um caminhão: com a contagem real do dia, ela
  // manda (todos os tipos, volume incluso — aqui "descarregos" é caminhão).
  for (const c of carros) {
    const dia = mapa.get(c.data);
    if (!dia) continue;
    dia.descarregos = TIPOS_DESCARREGAMENTO.reduce((s, t) => s + c.porTipo[t], 0);
    dia.carrosAjustados = true;
  }
  // Totais diários NÃO se fundem com os derivados nem entre si: cada um é uma
  // linha própria, editável pelo id. Um dia misto vira duas linhas rotuladas.
  const lancados: DiaDescarregamento[] = totais.map((t) => ({
    data: t.data,
    descarregos: t.descarregos,
    pesoKg: t.pesoKg,
    receita: t.receita,
    origem: "total",
    id: t.id,
  }));
  // Datas ISO comparam corretamente como string (yyyy-mm-dd é ordenável lexicalmente).
  return [...mapa.values(), ...lancados].sort((a, b) => b.data.localeCompare(a.data));
}

/** Custo logístico líquido = custos brutos − receitas (só demonstração; não altera custos). */
export function custoLiquido(custosBrutos: number, receitas: number): number {
  return arredonda2(custosBrutos - receitas);
}

/**
 * Valor SUGERIDO de uma receita diversa = quantidade × preço unitário.
 * Só sugere: o valor gravado é o negociado e pode divergir de propósito.
 * Sem piso mínimo — isso é regra de descarregamento.
 */
export function calcularValorDiversa(quantidade: number, precoUnitario: number): number {
  return arredonda2(quantidade * precoUnitario);
}

/**
 * Decide o valor a gravar de uma receita diversa: o informado no formulário
 * manda; o produto quantidade × preço só entra quando não veio nada válido.
 *
 * Existe porque o preço combinado com o comprador às vezes diverge do produto
 * exato — arredondamento de conversa, desconto negociado no balcão. Se essa
 * precedência fosse invertida (sempre recalcular), todo desconto seria apagado
 * na gravação e o total do mês deixaria de bater com o dinheiro que entrou.
 *
 * `valorBruto` é o valor cru do formulário (`FormData.get` devolve
 * `string | null`) — a validação de "válido" fica aqui, não espalhada pelas
 * chamadoras.
 */
export function resolverValorDiversa(
  valorBruto: string | null,
  quantidade: number,
  precoUnitario: number,
): number {
  const valorInformado = Number(valorBruto ?? NaN);
  return Number.isFinite(valorInformado) && valorInformado > 0
    ? valorInformado
    : calcularValorDiversa(quantidade, precoUnitario);
}

/** Soma o valor gravado das receitas diversas — nunca o recalculado. */
export function valorTotalDiversas(ds: ReceitaDiversa[]): number {
  return arredonda2(ds.reduce((t, d) => t + d.valor, 0));
}

export interface ResumoReceitas {
  totalDescarregamento: number;
  totalDiversas: number;
  total: number;
  toneladas: number;
  /** Divide SÓ a receita de descarregamento pelas toneladas. */
  medioPorTonelada: number;
}

/**
 * Compõe os totais da tela de receitas a partir das duas origens.
 *
 * Existe como função de domínio, e não solta na página, porque carrega a regra
 * mais fácil de quebrar do módulo: o total soma as duas origens, mas o médio por
 * tonelada divide só o descarregamento. Receita de reciclagem não vem de tonelada
 * nenhuma — deixá-la entrar no numerador infla o indicador sem ninguém perceber.
 */
export function resumoReceitas(
  descarregamentos: Receita[],
  diversas: ReceitaDiversa[],
  totaisDiarios: TotalDiarioDescarregamento[] = [],
): ResumoReceitas {
  const totalTotaisDiarios = arredonda2(totaisDiarios.reduce((t, x) => t + x.receita, 0));
  const tonsTotaisDiarios = arredonda2(totaisDiarios.reduce((t, x) => t + toneladas(x.pesoKg), 0));

  // Card e peso total: todos os tipos, inclusive o Volume.
  const totalDescarregamento = arredonda2(receitaTotal(descarregamentos) + totalTotaisDiarios);
  const tons = arredonda2(toneladasTotal(descarregamentos) + tonsTotaisDiarios);

  // R$/ton: só os tipos cobrados por tonelada (Volume fora), somando os totais do dia.
  const porPeso = descarregamentos.filter((r) => r.tipo !== "volume");
  const receitaPorPeso = arredonda2(receitaTotal(porPeso) + totalTotaisDiarios);
  const tonsPorPeso = arredonda2(toneladasTotal(porPeso) + tonsTotaisDiarios);

  const totalDiversas = valorTotalDiversas(diversas);
  return {
    totalDescarregamento,
    totalDiversas,
    total: arredonda2(totalDescarregamento + totalDiversas),
    toneladas: tons,
    medioPorTonelada: tonsPorPeso === 0 ? 0 : arredonda2(receitaPorPeso / tonsPorPeso),
  };
}

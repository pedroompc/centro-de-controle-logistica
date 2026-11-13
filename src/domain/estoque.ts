// Excesso de estoque, ruptura e obsoletos (aba portada do app Flask do colega,
// app_cortes → "Excesso de Estoque"). Regras de giro e de situação iguais às do
// Flask; preço de venda é o praticado de verdade (vendas dos últimos 90 dias no
// PCMOV), não o custo × 1,35 que o Flask estimava.

/** Uma linha por produto ativo (filiais 1 e 11 somadas). */
export interface ProdutoEstoque {
  codprod: number;
  produto: string;
  embalagem: string;
  codfornec: number | null;
  fornecedor: string | null;
  codcomprador: number | null;
  comprador: string | null;
  estoque: number; // PCEST.QTESTGER
  reservado: number; // PCEST.QTRESERV
  bloqueado: number; // PCEST.QTBLOQUEADA (avaria)
  vendido3m: number; // QTVENDMES + QTVENDMES1 + QTVENDMES2
  custo: number; // custo financeiro unitário (PCEST.CUSTOFIN)
  ultimaSaida: string | null; // PCEST.DTULTFAT, yyyy-mm-dd
  ultimaEntrada: string | null; // PCEST.DTULTENT, yyyy-mm-dd
  qtVendida90: number; // saídas de venda (PCMOV 'S') nos últimos 90 dias
  venda90: number; // Σ QT × PUNIT dessas saídas
  custo90: number; // Σ QT × CUSTOFIN dessas saídas
}

export type Situacao = "ruptura" | "iminente" | "comprar" | "ideal" | "excesso";

export const SITUACOES: { id: Situacao; rotulo: string; dica: string }[] = [
  { id: "ruptura", rotulo: "Ruptura (zerado)", dica: "estoque zerado ou negativo" },
  { id: "iminente", rotulo: "Ruptura iminente (<10d)", dica: "estoque dura menos de 10 dias no giro atual" },
  { id: "comprar", rotulo: "Comprar (10 a 30d)", dica: "estoque dura de 10 a 30 dias" },
  { id: "ideal", rotulo: "Ideal (31 a 60d)", dica: "estoque dura de 31 a 60 dias" },
  { id: "excesso", rotulo: "Excesso (>60d)", dica: "estoque dura mais de 60 dias ou o produto não vende" },
];

/** Dias de estoque ideal (o Flask usa 60). */
export const DIAS_IDEAL = 60;
/** Custo financeiro mensal do capital parado em excesso (taxa fixa do Flask). */
export const TAXA_CUSTO_FINANCEIRO = 0.015;

const dias = (de: string, ate: string) => Math.round((Date.parse(`${ate}T12:00:00Z`) - Date.parse(`${de}T12:00:00Z`)) / 86_400_000);

/** Quanto vende por dia (média dos 3 últimos meses ÷ 90). */
export const giroDia = (p: ProdutoEstoque) => p.vendido3m / 90;
/** Estoque ideal: 60 dias do giro, arredondado como no Flask. */
export const estoqueIdeal = (p: ProdutoEstoque) => Math.round(giroDia(p) * DIAS_IDEAL);
/** Dias que o estoque dura no giro atual; `null` se o produto não vende. */
export const cobertura = (p: ProdutoEstoque) => (giroDia(p) > 0 ? p.estoque / giroDia(p) : null);
/** Preço médio praticado nos últimos 90 dias; `null` sem venda no período. */
export const precoVenda = (p: ProdutoEstoque) => (p.qtVendida90 > 0 ? p.venda90 / p.qtVendida90 : null);

export function situacao(p: ProdutoEstoque): Situacao {
  if (p.estoque <= 0) return "ruptura";
  const c = cobertura(p);
  if (c === null) return "excesso"; // tem estoque e não vende
  if (c < 10) return "iminente";
  if (c <= 30) return "comprar";
  if (c <= 60) return "ideal";
  return "excesso";
}

/** Obsoleto: tem estoque, não vende há mais de 45 dias e não entrou nada nos últimos 30. */
export function obsoleto(p: ProdutoEstoque, hoje: string): boolean {
  if (p.estoque <= 0) return false;
  const semVenda = p.ultimaSaida === null || dias(p.ultimaSaida, hoje) > 45;
  const semEntrada = p.ultimaEntrada === null || dias(p.ultimaEntrada, hoje) > 30;
  return semVenda && semEntrada;
}

export const diasSemVenda = (p: ProdutoEstoque, hoje: string) => (p.ultimaSaida === null ? null : dias(p.ultimaSaida, hoje));
export const excessoQt = (p: ProdutoEstoque) => Math.max(0, p.estoque - estoqueIdeal(p));
export const faltaQt = (p: ProdutoEstoque) => Math.max(0, estoqueIdeal(p) - Math.max(0, p.estoque));
/** Venda que deixa de acontecer por mês com o produto zerado (média mensal × preço praticado). */
export const perdaRuptura = (p: ProdutoEstoque) => (p.estoque <= 0 ? (p.vendido3m / 3) * (precoVenda(p) ?? 0) : 0);

export interface Fatia {
  chave: string;
  rotulo: string;
  valor: number;
}

export interface ResumoEstoque {
  skus: number; // produtos ativos (com estoque ou venda nos 3 meses)
  ativoCusto: number; // estoque a preço de custo
  ativoVenda: number; // estoque a preço praticado
  semPreco: number; // produtos com estoque e sem venda nos 90 dias (fora do ativo a venda)
  limiteIdeal: number; // estoque ideal a custo
  excesso: number; // capital acima do ideal, a custo
  falta: number; // quanto falta para o ideal, a custo
  oportunidades: number; // SKUs abaixo do ideal
  obsoletos: number;
  valorObsoletos: number;
  rupturas: number; // SKUs zerados
  perdaRuptura: number; // venda mensal perdida dos zerados
  vendaMensal: number; // venda média mensal praticada (90 dias ÷ 3)
  markup: number | null; // venda ÷ custo − 1 das vendas dos 90 dias
  custoFinanceiro: number; // excesso × 1,5% ao mês
  quebraValor: number | null; // falta ÷ ideal
  quebraSkus: number | null; // zerados ÷ SKUs
  indiceObsoletos: number | null; // obsoletos ÷ SKUs
  contasPagar: number | null;
  estoqueLiquidoPago: number | null; // ativo a custo − contas a pagar
  porSituacao: { id: Situacao; rotulo: string; skus: number }[];
  porComprador: { chave: string; rotulo: string; excesso: number; ideal: number }[];
  fornecedoresExcesso: Fatia[];
  produtosExcesso: Fatia[];
  produtosAtivo: Fatia[];
  fornecedoresFalta: Fatia[];
  produtosRuptura: Fatia[];
  produtosObsoletos: Fatia[]; // valor = dias sem venda
}

const rotuloProduto = (p: ProdutoEstoque) => `${p.codprod} · ${p.produto}`;
const rotuloFornecedor = (p: ProdutoEstoque) => (p.codfornec === null ? "Sem fornecedor" : `${p.codfornec} · ${p.fornecedor ?? ""}`.trim());

function somarPor(ps: ProdutoEstoque[], chave: (p: ProdutoEstoque) => [string, string], valor: (p: ProdutoEstoque) => number, top = 10): Fatia[] {
  const m = new Map<string, Fatia>();
  for (const p of ps) {
    const v = valor(p);
    if (v <= 0) continue;
    const [k, r] = chave(p);
    const f = m.get(k) ?? { chave: k, rotulo: r, valor: 0 };
    f.valor += v;
    m.set(k, f);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor).slice(0, top);
}

export function resumoEstoque(ps: ProdutoEstoque[], hoje: string, contasPagar: number | null): ResumoEstoque {
  let ativoCusto = 0, ativoVenda = 0, semPreco = 0, limiteIdeal = 0, excesso = 0, falta = 0, oportunidades = 0;
  let obsoletos = 0, valorObsoletos = 0, rupturas = 0, perda = 0, venda90 = 0, custo90 = 0;
  const conta = new Map<Situacao, number>(SITUACOES.map((s) => [s.id, 0]));
  const comp = new Map<string, { chave: string; rotulo: string; excesso: number; ideal: number }>();
  for (const p of ps) {
    const est = Math.max(0, p.estoque);
    const ideal = estoqueIdeal(p);
    const preco = precoVenda(p);
    ativoCusto += est * p.custo;
    if (est > 0) {
      if (preco === null) semPreco += 1;
      else ativoVenda += est * preco;
    }
    limiteIdeal += ideal * p.custo;
    const exc = excessoQt(p) * p.custo;
    excesso += exc;
    const fq = faltaQt(p);
    falta += fq * p.custo;
    if (fq > 0) oportunidades += 1;
    if (obsoleto(p, hoje)) { obsoletos += 1; valorObsoletos += est * p.custo; }
    if (p.estoque <= 0) { rupturas += 1; perda += perdaRuptura(p); }
    venda90 += p.venda90;
    custo90 += p.custo90;
    conta.set(situacao(p), conta.get(situacao(p))! + 1);
    const ck = p.comprador ?? "Sem comprador";
    const c = comp.get(ck) ?? { chave: String(p.codcomprador ?? ""), rotulo: ck, excesso: 0, ideal: 0 };
    c.excesso += exc;
    c.ideal += ideal * p.custo;
    comp.set(ck, c);
  }
  const skus = ps.length;
  return {
    skus, ativoCusto, ativoVenda, semPreco, limiteIdeal, excesso, falta, oportunidades, obsoletos, valorObsoletos, rupturas,
    perdaRuptura: perda,
    vendaMensal: venda90 / 3,
    markup: custo90 > 0 ? venda90 / custo90 - 1 : null,
    custoFinanceiro: excesso * TAXA_CUSTO_FINANCEIRO,
    quebraValor: limiteIdeal > 0 ? falta / limiteIdeal : null,
    quebraSkus: skus > 0 ? rupturas / skus : null,
    indiceObsoletos: skus > 0 ? obsoletos / skus : null,
    contasPagar,
    estoqueLiquidoPago: contasPagar === null ? null : ativoCusto - contasPagar,
    porSituacao: SITUACOES.map((s) => ({ id: s.id, rotulo: s.rotulo, skus: conta.get(s.id)! })),
    porComprador: [...comp.values()].sort((a, b) => b.excesso - a.excesso).slice(0, 10),
    fornecedoresExcesso: somarPor(ps, (p) => [String(p.codfornec ?? 0), rotuloFornecedor(p)], (p) => excessoQt(p) * p.custo),
    produtosExcesso: somarPor(ps, (p) => [String(p.codprod), rotuloProduto(p)], (p) => excessoQt(p) * p.custo),
    produtosAtivo: somarPor(ps, (p) => [String(p.codprod), rotuloProduto(p)], (p) => Math.max(0, p.estoque) * p.custo),
    fornecedoresFalta: somarPor(ps, (p) => [String(p.codfornec ?? 0), rotuloFornecedor(p)], (p) => faltaQt(p) * p.custo),
    produtosRuptura: somarPor(ps, (p) => [String(p.codprod), rotuloProduto(p)], perdaRuptura),
    produtosObsoletos: ps
      .filter((p) => obsoleto(p, hoje))
      .map((p) => ({ chave: String(p.codprod), rotulo: rotuloProduto(p), valor: diasSemVenda(p, hoje) ?? 999 }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10),
  };
}

/** Compradores presentes na base, para o filtro. */
export function compradores(ps: ProdutoEstoque[]): { chave: string; rotulo: string }[] {
  const m = new Map<string, string>();
  for (const p of ps) if (p.codcomprador !== null) m.set(String(p.codcomprador), p.comprador ?? `Comprador ${p.codcomprador}`);
  return [...m].map(([chave, rotulo]) => ({ chave, rotulo })).sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

// --- Tabelas e planilhas (excesso, obsoletos/ISV, ruptura) ---------------------

export type TipoTabela = "excesso" | "obsoletos" | "ruptura";

export interface LinhaTabelaEstoque {
  codprod: number;
  produto: string;
  embalagem: string;
  fornecedor: string;
  comprador: string;
  situacao: Situacao;
  estoque: number;
  reservado: number;
  disponivel: number;
  avaria: number;
  ideal: number;
  excessoQt: number;
  excessoValor: number;
  custo: number;
  preco: number | null;
  valorVenda: number | null;
  ultimaSaida: string | null;
  ultimaEntrada: string | null;
  diasSemVenda: number | null;
  cobertura: number | null; // dias
  perda: number;
}

export function linhasTabela(ps: ProdutoEstoque[], tipo: TipoTabela, hoje: string): LinhaTabelaEstoque[] {
  const sel =
    tipo === "excesso" ? ps.filter((p) => excessoQt(p) > 0)
    : tipo === "obsoletos" ? ps.filter((p) => obsoleto(p, hoje))
    : ps;
  const linhas = sel.map((p) => {
    const preco = precoVenda(p);
    const c = cobertura(p);
    return {
      codprod: p.codprod,
      produto: rotuloProduto(p),
      embalagem: p.embalagem,
      fornecedor: rotuloFornecedor(p),
      comprador: p.comprador ?? "Sem comprador",
      situacao: situacao(p),
      estoque: p.estoque,
      reservado: p.reservado,
      disponivel: p.estoque - p.reservado - p.bloqueado,
      avaria: p.bloqueado,
      ideal: estoqueIdeal(p),
      excessoQt: excessoQt(p),
      excessoValor: excessoQt(p) * p.custo,
      custo: p.custo,
      preco,
      valorVenda: preco === null ? null : Math.max(0, p.estoque) * preco,
      ultimaSaida: p.ultimaSaida,
      ultimaEntrada: p.ultimaEntrada,
      diasSemVenda: diasSemVenda(p, hoje),
      cobertura: c === null ? null : Math.round(c),
      perda: perdaRuptura(p),
    };
  });
  const ordem = new Map(SITUACOES.map((s, i) => [s.id, i]));
  return linhas.sort((a, b) =>
    tipo === "excesso" ? b.excessoValor - a.excessoValor
    : tipo === "obsoletos" ? (b.diasSemVenda ?? 9999) - (a.diasSemVenda ?? 9999)
    : ordem.get(a.situacao)! - ordem.get(b.situacao)! || b.perda - a.perda,
  );
}

const csvTxt = (s: string | number | null | undefined) => `"${String(s ?? "").replace(/"/g, '""')}"`;
const csvNum = (n: number | null) => (n === null ? "" : String(Math.round(n * 100) / 100).replace(".", ","));
const dataBR = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "");
const rotuloSituacao = (s: Situacao) => SITUACOES.find((x) => x.id === s)!.rotulo;

/** Planilha (CSV ";" com BOM, abre direto no Excel PT-BR) nas colunas das planilhas do Flask. */
export function tabelaParaCsv(linhas: LinhaTabelaEstoque[], tipo: TipoTabela): string {
  const cab =
    tipo === "excesso"
      ? ["Comprador", "Fornecedor", "Produto", "Qtd estoque", "Qtd ideal (60d)", "Qtd excesso", "Valor excesso (R$)"]
      : [
          "Produto", "Embalagem", ...(tipo === "ruptura" ? ["Situação"] : []), "Fornecedor", "Comprador",
          "Qtd reservada", "Qtd disponível", "Qtd avaria", "Qtd geral", "Última saída", "Última entrada",
          "Preço de custo (R$)", "Preço de venda praticado (R$)", "Estoque a preço de venda (R$)",
          ...(tipo === "ruptura" ? ["Dias de estoque", "Perda mensal (R$)"] : ["Dias sem venda"]),
        ];
  const corpo = linhas.map((l) =>
    (tipo === "excesso"
      ? [csvTxt(l.comprador), csvTxt(l.fornecedor), csvTxt(l.produto), csvNum(l.estoque), csvNum(l.ideal), csvNum(l.excessoQt), csvNum(l.excessoValor)]
      : [
          csvTxt(l.produto), csvTxt(l.embalagem), ...(tipo === "ruptura" ? [csvTxt(rotuloSituacao(l.situacao))] : []),
          csvTxt(l.fornecedor), csvTxt(l.comprador), csvNum(l.reservado), csvNum(l.disponivel), csvNum(l.avaria), csvNum(l.estoque),
          dataBR(l.ultimaSaida), dataBR(l.ultimaEntrada), csvNum(l.custo), csvNum(l.preco), csvNum(l.valorVenda),
          ...(tipo === "ruptura" ? [csvNum(l.cobertura), csvNum(l.perda)] : [csvNum(l.diasSemVenda)]),
        ]
    ).join(";"),
  );
  return "﻿" + [cab.join(";"), ...corpo].join("\n");
}

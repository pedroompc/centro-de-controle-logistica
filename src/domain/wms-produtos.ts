import { porUnidade } from "./wms";

/*
 * Produtos mais movimentados do galpão num mês (MOVIMENT_END_502 efetivados).
 * Tudo aqui é puro: a query entrega uma linha por produto e este módulo
 * classifica (curva ABC de MOVIMENTO), lê o nível do endereço e levanta alertas
 * de slotting e de paletização.
 */

export interface ProdutoMovimentado {
  merc: number; // código da mercadoria no WMS (MERC_PF_502) — assumido = CODPROD do WinThor
  descricao: string | null;
  embalagem: string | null;
  movimentos: number;
  verticais: number;
  abastecimentos: number; // tipo S: pulmão → picking
  armazenagens: number; // tipo E: doca → endereço
  internas: number; // tipo I
  devolucoes: number; // tipo D
  quantidade: number; // Σ QTD_502 (unidade do WMS — a validar)
  peso: number;
  operadores: number; // pessoas distintas que movimentaram o produto
  operadorPrincipal: string | null; // quem mais movimentou (moda)
  picking: string | null; // destino mais frequente dos abastecimentos
  pulmoes: number; // endereços de origem distintos dos abastecimentos
  qtdPaletePraticada: number | null; // moda da quantidade nas armazenagens (palete como chega)
  lastro: number | null; // cadastro: caixas por camada
  camadas: number | null; // cadastro: camadas por palete
  qtdPaleteCadastro: number | null; // cadastro: total por palete
}

export type Classe = "A" | "B" | "C";
export type Alerta = "picking-alto" | "sem-picking" | "palete-divergente";

export interface LinhaProduto extends ProdutoMovimentado {
  posicao: number;
  classe: Classe;
  participacao: number; // 0..1 dos movimentos do mês
  acumulado: number; // 0..1 acumulado até este produto (inclusive)
  nivelPicking: string | null;
  alertas: Alerta[];
}

/** Limites da curva ABC por participação acumulada ANTES do item. */
export const LIMITE_A = 0.8;
export const LIMITE_B = 0.95;
/** Diferença relativa a partir da qual o palete praticado diverge do cadastro. */
export const TOLERANCIA_PALETE = 0.1;

/** Nível (graus 5–6) de um endereço RR PP NN AAA; `null` se fora do padrão de 9 dígitos. */
export function nivelEndereco(end: string | null): string | null {
  return end && /^[0-9]{9}$/.test(end) ? end.slice(4, 6) : null;
}

/** Formata 070901002 como 07-09-01-002 (rua-prédio-nível-apto). */
export function formatarEndereco(end: string | null): string {
  if (!end) return "—";
  return /^[0-9]{9}$/.test(end) ? `${end.slice(0, 2)}-${end.slice(2, 4)}-${end.slice(4, 6)}-${end.slice(6)}` : end;
}

export function alertasProduto(p: ProdutoMovimentado, classe: Classe, nivel: string | null): Alerta[] {
  const a: Alerta[] = [];
  // Produto de giro alto com picking fora do chão: cada separação/abastecimento vira empilhadeira.
  if (classe === "A" && nivel !== null && nivel > "01") a.push("picking-alto");
  // Produto de giro alto sem abastecimento de picking no mês: sai direto do pulmão ou não tem picking.
  if (classe === "A" && p.picking === null) a.push("sem-picking");
  if (p.qtdPaletePraticada && p.qtdPaleteCadastro &&
      Math.abs(p.qtdPaletePraticada - p.qtdPaleteCadastro) / p.qtdPaleteCadastro > TOLERANCIA_PALETE) {
    a.push("palete-divergente");
  }
  return a;
}

/** Ordena por movimentos, classifica ABC e calcula alertas. Recebe TODOS os produtos do mês. */
export function classificarProdutos(produtos: ProdutoMovimentado[]): LinhaProduto[] {
  const total = produtos.reduce((s, p) => s + p.movimentos, 0);
  const ordenados = [...produtos].sort((a, b) => b.movimentos - a.movimentos || a.merc - b.merc);
  let acum = 0;
  return ordenados.map((p, i) => {
    const antes = porUnidade(acum, total);
    acum += p.movimentos;
    const classe: Classe = antes < LIMITE_A ? "A" : antes < LIMITE_B ? "B" : "C";
    const nivelPicking = nivelEndereco(p.picking);
    return {
      ...p,
      posicao: i + 1,
      classe,
      participacao: porUnidade(p.movimentos, total),
      acumulado: porUnidade(acum, total),
      nivelPicking,
      alertas: alertasProduto(p, classe, nivelPicking),
    };
  });
}

export interface ResumoProdutos {
  skus: number;
  movimentos: number;
  porClasse: Record<Classe, { skus: number; movimentos: number }>;
  pickingAlto: number;
  semPicking: number;
  paleteDivergente: number;
}

export function resumirProdutos(linhas: LinhaProduto[]): ResumoProdutos {
  const porClasse: ResumoProdutos["porClasse"] = {
    A: { skus: 0, movimentos: 0 }, B: { skus: 0, movimentos: 0 }, C: { skus: 0, movimentos: 0 },
  };
  let pickingAlto = 0, semPicking = 0, paleteDivergente = 0, movimentos = 0;
  for (const l of linhas) {
    porClasse[l.classe].skus++;
    porClasse[l.classe].movimentos += l.movimentos;
    movimentos += l.movimentos;
    if (l.alertas.includes("picking-alto")) pickingAlto++;
    if (l.alertas.includes("sem-picking")) semPicking++;
    if (l.alertas.includes("palete-divergente")) paleteDivergente++;
  }
  return { skus: linhas.length, movimentos, porClasse, pickingAlto, semPicking, paleteDivergente };
}

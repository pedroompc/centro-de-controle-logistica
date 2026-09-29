import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { mesProximo } from "@/domain/periodo";
import { classificarProdutos, type LinhaProduto, type ProdutoMovimentado } from "@/domain/wms-produtos";
import { CTE_MOVIMENTOS, EMPRESA, tentar } from "./wms";

/*
 * Produtos mais movimentados: mesma base da /galpao (CTE_MOVIMENTOS).
 * Endereços saem dos PRÓPRIOS movimentos, sem depender de cadastro:
 *   picking  = destino mais frequente dos abastecimentos (S: pulmão → picking)
 *   pulmões  = origens distintas desses abastecimentos
 *   palete praticado = quantidade mais frequente nas armazenagens (E: chega um palete por movimento)
 * Descrição e paletização de cadastro vêm do WinThor (PCPRODUT), assumindo
 * MERC_PF_502 = CODPROD — conferir em docs/wms/validacao-produtos.sql.
 */

// Uma linha por produto movimentado no mês (todos — a curva ABC precisa do total).
const SQL_PRODUTOS = `${CTE_MOVIMENTOS},
prod AS (
  SELECT MERC,
         COUNT(*) MOVS,
         SUM(VERT) VERT,
         SUM(CASE WHEN TIPO = 'S' THEN 1 ELSE 0 END) ABAST,
         SUM(CASE WHEN TIPO = 'E' THEN 1 ELSE 0 END) ARMAZ,
         SUM(CASE WHEN TIPO = 'I' THEN 1 ELSE 0 END) INTERNAS,
         SUM(CASE WHEN TIPO = 'D' THEN 1 ELSE 0 END) DEVOL,
         SUM(NVL(QTD, 0)) QTD,
         SUM(PESO) PESO,
         COUNT(DISTINCT USU) OPERADORES,
         STATS_MODE(USU) USU_TOP,
         STATS_MODE(CASE WHEN TIPO = 'S' THEN END_D END) PICKING,
         COUNT(DISTINCT CASE WHEN TIPO = 'S' THEN END_O END) PULMOES,
         STATS_MODE(CASE WHEN TIPO = 'E' AND QTD > 0 THEN QTD END) QTD_PALETE
    FROM base
   WHERE MERC IS NOT NULL
   GROUP BY MERC
)
SELECT p.*, NVL(TRIM(u.DESCR_COMPLETO_754), u.DESCR_754) NOME_TOP
  FROM prod p
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = p.USU_TOP`;

/** Quantos produtos recebem descrição/paletização do cadastro (o topo da lista). */
export const TOP_PRODUTOS = 60;

// Separadas: se as colunas de paletização não existirem, a descrição continua vindo.
const sqlDescricao = (binds: string) =>
  `SELECT CODPROD, DESCRICAO, EMBALAGEM FROM PCPRODUT WHERE CODPROD IN (${binds})`;
const sqlPaletizacao = (binds: string) =>
  `SELECT CODPROD, LASTROPAL, ALTURAPAL, QTTOTPAL FROM PCPRODUT WHERE CODPROD IN (${binds})`;

const n = (v: unknown): number => Number(v) || 0;
const nOuNull = (v: unknown): number | null => (v == null || !Number(v) ? null : Number(v));
const s = (v: unknown): string | null => (v == null || String(v).trim() === "" ? null : String(v).trim());

export interface ProdutosWms {
  mes: string;
  linhas: LinhaProduto[]; // todos os produtos do mês, já classificados
  indisponivel: string[];
}

export const getProdutosWms = cache(async (mes: string): Promise<ProdutosWms> => {
  const falhas: string[] = [];
  const rows = await tentar("movimentos por produto", falhas, () =>
    queryWinthor<Record<string, unknown>>(SQL_PRODUTOS, { emp: EMPRESA, ini: mes, fim: mesProximo(mes) }));

  const base: ProdutoMovimentado[] = (rows ?? []).map((r) => ({
    merc: n(r.MERC),
    descricao: null,
    embalagem: null,
    movimentos: n(r.MOVS),
    verticais: n(r.VERT),
    abastecimentos: n(r.ABAST),
    armazenagens: n(r.ARMAZ),
    internas: n(r.INTERNAS),
    devolucoes: n(r.DEVOL),
    quantidade: n(r.QTD),
    peso: n(r.PESO),
    operadores: n(r.OPERADORES),
    operadorPrincipal: s(r.NOME_TOP) ?? (r.USU_TOP == null ? null : `Usuário ${r.USU_TOP}`),
    picking: s(r.PICKING),
    pulmoes: n(r.PULMOES),
    qtdPaletePraticada: nOuNull(r.QTD_PALETE),
    lastro: null,
    camadas: null,
    qtdPaleteCadastro: null,
  }));

  // Cadastro só para o topo: IN com binds nomeados (:c0, :c1…).
  const topo = [...base].sort((a, b) => b.movimentos - a.movimentos).slice(0, TOP_PRODUTOS).map((p) => p.merc);
  if (topo.length) {
    const nomes = topo.map((_, i) => `:c${i}`).join(",");
    const binds = Object.fromEntries(topo.map((c, i) => [`c${i}`, c]));
    const [desc, pal] = await Promise.all([
      tentar("descrição dos produtos", falhas, () => queryWinthor<Record<string, unknown>>(sqlDescricao(nomes), binds)),
      tentar("paletização de cadastro", falhas, () => queryWinthor<Record<string, unknown>>(sqlPaletizacao(nomes), binds)),
    ]);
    const porCod = new Map(base.map((p) => [p.merc, p]));
    for (const r of desc ?? []) {
      const p = porCod.get(n(r.CODPROD));
      if (p) { p.descricao = s(r.DESCRICAO); p.embalagem = s(r.EMBALAGEM); }
    }
    for (const r of pal ?? []) {
      const p = porCod.get(n(r.CODPROD));
      if (!p) continue;
      p.lastro = nOuNull(r.LASTROPAL);
      p.camadas = nOuNull(r.ALTURAPAL);
      p.qtdPaleteCadastro = nOuNull(r.QTTOTPAL) ?? (p.lastro && p.camadas ? p.lastro * p.camadas : null);
    }
  }

  return { mes, linhas: classificarProdutos(base), indisponivel: falhas };
});

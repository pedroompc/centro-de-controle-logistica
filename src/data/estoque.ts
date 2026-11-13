import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import type { ProdutoEstoque } from "@/domain/estoque";

// Produtos ativos das filiais 1 e 11 (somadas): estoque, giro dos 3 últimos meses,
// custo e o preço praticado (vendas dos últimos 90 dias no PCMOV). Fora os itens
// que não são de venda — mesma lista do app Flask (descrição "Z-", "ZZ-", "@", "*",
// ativo imobilizado e departamentos de avaria/inativo/imobilizado). Sem lista fixa
// de compradores: todo produto entra; o filtro por comprador é feito na tela.
const SQL_PRODUTOS = `
WITH mv AS (
  SELECT m.CODPROD, SUM(m.QT) QT90, SUM(m.QT * m.PUNIT) VENDA90, SUM(m.QT * NVL(m.CUSTOFIN, 0)) CUSTO90
  FROM PCMOV m
  WHERE ${filialIn("m.CODFILIAL")} AND m.CODOPER = 'S' AND m.DTCANCEL IS NULL
    AND m.DTMOV >= TRUNC(SYSDATE) - 90
  GROUP BY m.CODPROD
), base AS (
  SELECT p.CODPROD, MAX(p.DESCRICAO) PRODUTO, MAX(NVL(p.EMBALAGEM, 'UN')) EMB,
         MAX(f.CODFORNEC) CODFORNEC, MAX(f.FORNECEDOR) FORNECEDOR, MAX(f.CODCOMPRADOR) CODCOMPRADOR, MAX(c.NOME) COMPRADOR,
         SUM(NVL(e.QTESTGER, 0)) EST, SUM(NVL(e.QTRESERV, 0)) RESERV, SUM(NVL(e.QTBLOQUEADA, 0)) BLOQ,
         SUM(NVL(e.QTVENDMES, 0) + NVL(e.QTVENDMES1, 0) + NVL(e.QTVENDMES2, 0)) VEND3M,
         NVL(SUM(GREATEST(NVL(e.QTESTGER, 0), 0) * NVL(e.CUSTOFIN, 0)) / NULLIF(SUM(GREATEST(NVL(e.QTESTGER, 0), 0)), 0), MAX(NVL(e.CUSTOFIN, 0))) CUSTO,
         TO_CHAR(MAX(e.DTULTFAT), 'YYYY-MM-DD') ULTFAT, TO_CHAR(MAX(e.DTULTENT), 'YYYY-MM-DD') ULTENT
  FROM PCEST e
  JOIN PCPRODUT p ON p.CODPROD = e.CODPROD
  JOIN PCFORNEC f ON f.CODFORNEC = p.CODFORNEC
  LEFT JOIN PCEMPR c ON c.MATRICULA = f.CODCOMPRADOR
  WHERE ${filialIn("e.CODFILIAL")}
    AND p.DESCRICAO NOT LIKE 'Z-%' AND p.DESCRICAO NOT LIKE 'ZZ-%' AND p.DESCRICAO NOT LIKE 'Z -%'
    AND p.DESCRICAO NOT LIKE '@%' AND p.DESCRICAO NOT LIKE '*%' AND p.DESCRICAO NOT LIKE 'ATIVO IMOBILIZADO%'
    AND NVL(p.CODEPTO, 0) NOT IN (
      SELECT d.CODEPTO FROM PCDEPTO d
      WHERE UPPER(d.DESCRICAO) LIKE '%AVARIA%' OR UPPER(d.DESCRICAO) LIKE '%INATIVO%' OR UPPER(d.DESCRICAO) LIKE '%IMOBILIZADO%'
         OR UPPER(d.DESCRICAO) LIKE '%Z-%' OR UPPER(d.DESCRICAO) LIKE '%ZZ-%')
  GROUP BY p.CODPROD
  HAVING SUM(NVL(e.QTESTGER, 0)) > 0 OR SUM(NVL(e.QTVENDMES, 0) + NVL(e.QTVENDMES1, 0) + NVL(e.QTVENDMES2, 0)) > 0
)
SELECT b.*, NVL(mv.QT90, 0) QT90, NVL(mv.VENDA90, 0) VENDA90, NVL(mv.CUSTO90, 0) CUSTO90
FROM base b LEFT JOIN mv ON mv.CODPROD = b.CODPROD`;

// Contas a pagar dos 3 últimos meses fechados: títulos de fornecedor vencidos e não
// pagos (PCLANC), como o card "Contas a Pagar" do Flask, sem os cancelados.
const sqlContas = (comprador: boolean) => `
SELECT SUM(NVL(l.VALOR, 0)) CONTAS
FROM PCLANC l
JOIN PCFORNEC f ON f.CODFORNEC = l.CODFORNEC
WHERE ${filialIn("l.CODFILIAL")} AND l.DTPAGTO IS NULL AND l.DTCANCEL IS NULL
  AND l.DTVENC >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -3) AND l.DTVENC < TRUNC(SYSDATE, 'MM')
  ${comprador ? "AND f.CODCOMPRADOR = :comprador" : ""}`;

const str = (v: unknown): string | null => (v == null || String(v).trim() === "" ? null : String(v).trim());
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOuNull = (v: unknown): number | null => (v == null ? null : Number(v));

/** Base de produtos do estoque (~8 s). Cacheada por requisição. */
export const lerProdutosEstoque = cache(async (): Promise<ProdutoEstoque[]> => {
  const rows = await queryWinthor<Record<string, unknown>>(SQL_PRODUTOS, {});
  return rows.map((r) => ({
    codprod: num(r.CODPROD),
    produto: str(r.PRODUTO) ?? String(r.CODPROD),
    embalagem: str(r.EMB) ?? "UN",
    codfornec: numOuNull(r.CODFORNEC),
    fornecedor: str(r.FORNECEDOR),
    codcomprador: numOuNull(r.CODCOMPRADOR),
    comprador: str(r.COMPRADOR),
    estoque: num(r.EST),
    reservado: num(r.RESERV),
    bloqueado: num(r.BLOQ),
    vendido3m: num(r.VEND3M),
    custo: num(r.CUSTO),
    ultimaSaida: str(r.ULTFAT),
    ultimaEntrada: str(r.ULTENT),
    qtVendida90: num(r.QT90),
    venda90: num(r.VENDA90),
    custo90: num(r.CUSTO90),
  }));
});

/** Títulos de fornecedor vencidos nos 3 meses fechados e não pagos. */
export async function lerContasPagar(comprador: number | null): Promise<number> {
  const rows = await queryWinthor<Record<string, unknown>>(sqlContas(comprador !== null), comprador !== null ? { comprador } : {});
  return num(rows[0]?.CONTAS);
}

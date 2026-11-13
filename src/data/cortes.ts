import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import type { LinhaCorte } from "@/domain/cortes";

// Itens cortados do pedido (PCCORTEI), filiais do dashboard, pela data do corte.
// Sem lista fixa de compradores nem de produtos: todo corte gravado entra.
// Custo = custo financeiro de hoje do produto na filial (PCEST.CUSTOFIN), como o
// card "Valor perdido (custo)" do app Flask.
const SQL_CORTES = `
SELECT TO_CHAR(TRUNC(i.DATA), 'YYYY-MM-DD') DIA, i.NUMPED, NULLIF(i.NUMCAR, 0) NUMCAR, i.CODPROD, p.DESCRICAO PRODUTO,
       p.CODFORNEC, f.FORNECEDOR, e.NOME COMPRADOR, i.CODCLI, c.CLIENTE,
       NVL(i.QTCORTADA, 0) QT, NVL(i.QTCORTADA, 0) * NVL(i.PVENDA, 0) VALOR,
       NVL(i.QTCORTADA, 0) * NVL(est.CUSTOFIN, 0) CUSTO, NVL(i.QTCORTADA, 0) * NVL(p.PESOBRUTO, 0) KG, i.MOTIVO, i.HORA,
       CASE WHEN EXISTS (SELECT 1 FROM PCPEDC c2 WHERE c2.NUMPED = i.NUMPED) THEN 1 ELSE 0 END TEM_PEDIDO
FROM PCCORTEI i
JOIN PCPRODUT p ON p.CODPROD = i.CODPROD
LEFT JOIN PCFORNEC f ON f.CODFORNEC = p.CODFORNEC
LEFT JOIN PCEMPR e ON e.MATRICULA = f.CODCOMPRADOR
LEFT JOIN PCCLIENT c ON c.CODCLI = i.CODCLI
LEFT JOIN PCEST est ON est.CODPROD = i.CODPROD AND est.CODFILIAL = i.CODFILIAL
WHERE ${filialIn("i.CODFILIAL")}
  AND i.DATA >= TO_DATE(:ini, 'YYYY-MM-DD') AND i.DATA < TO_DATE(:fim, 'YYYY-MM-DD') + 1
  AND i.QTCORTADA > 0
ORDER BY i.DATA, i.NUMPED`;

// Mês a mês (evolução), mesma regra.
const SQL_MESES = `
SELECT TO_CHAR(TRUNC(i.DATA, 'MM'), 'YYYY-MM-DD') MES, SUM(NVL(i.QTCORTADA, 0) * NVL(i.PVENDA, 0)) VALOR,
       COUNT(*) ITENS, COUNT(DISTINCT i.NUMPED) PEDIDOS
FROM PCCORTEI i
WHERE ${filialIn("i.CODFILIAL")}
  AND i.DATA >= TO_DATE(:ini, 'YYYY-MM-DD') AND i.DATA < TO_DATE(:fim, 'YYYY-MM-DD') + 1
  AND i.QTCORTADA > 0
GROUP BY TRUNC(i.DATA, 'MM')
ORDER BY 1`;

const str = (v: unknown): string | null => (v == null || String(v).trim() === "" ? null : String(v).trim());
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOuNull = (v: unknown): number | null => (v == null ? null : Number(v));

/** Linhas de corte entre `ini` e `fim` ("yyyy-mm-dd", inclusivos). */
export async function lerCortes(ini: string, fim: string): Promise<LinhaCorte[]> {
  const rows = await queryWinthor<Record<string, unknown>>(SQL_CORTES, { ini, fim });
  return rows.map((r) => ({
    dia: String(r.DIA),
    numped: num(r.NUMPED),
    numcar: numOuNull(r.NUMCAR),
    codprod: num(r.CODPROD),
    produto: str(r.PRODUTO) ?? String(r.CODPROD),
    codfornec: numOuNull(r.CODFORNEC),
    fornecedor: str(r.FORNECEDOR),
    comprador: str(r.COMPRADOR),
    codcli: numOuNull(r.CODCLI),
    cliente: str(r.CLIENTE),
    qt: num(r.QT),
    valor: num(r.VALOR),
    custo: num(r.CUSTO),
    kg: num(r.KG),
    motivo: str(r.MOTIVO),
    temPedido: num(r.TEM_PEDIDO) === 1,
    hora: numOuNull(r.HORA),
  }));
}

export interface CorteMensal {
  mes: string;
  valor: number;
  itens: number;
  pedidos: number;
}

export async function lerCortesMensais(ini: string, fim: string): Promise<CorteMensal[]> {
  const rows = await queryWinthor<Record<string, unknown>>(SQL_MESES, { ini, fim });
  return rows.map((r) => ({ mes: String(r.MES), valor: num(r.VALOR), itens: num(r.ITENS), pedidos: num(r.PEDIDOS) }));
}

// Estoque gerencial (PCEST.QTESTGER) dos produtos cortados no período, na filial
// do corte: o de hoje e o do dia do último corte. O da data é o de hoje com as
// movimentações posteriores desfeitas (entradas E/D saem, saídas S/R voltam),
// a mesma conta do app Flask. Roda à parte (~4 s), fora do carregamento da página.
const SQL_ESTOQUE = `
WITH c AS (
  SELECT i.CODPROD, i.CODFILIAL, MAX(TRUNC(i.DATA)) ULT
  FROM PCCORTEI i
  WHERE ${filialIn("i.CODFILIAL")}
    AND i.DATA >= TO_DATE(:ini, 'YYYY-MM-DD') AND i.DATA < TO_DATE(:fim, 'YYYY-MM-DD') + 1
    AND i.QTCORTADA > 0
  GROUP BY i.CODPROD, i.CODFILIAL
),
m AS (
  SELECT c.CODPROD, c.CODFILIAL,
         SUM(CASE WHEN SUBSTR(mv.CODOPER, 1, 1) IN ('E', 'D') THEN ABS(mv.QT) ELSE 0 END) ENTROU,
         SUM(CASE WHEN SUBSTR(mv.CODOPER, 1, 1) IN ('S', 'R') THEN ABS(mv.QT) ELSE 0 END) SAIU
  FROM c JOIN PCMOV mv ON mv.CODPROD = c.CODPROD AND mv.CODFILIAL = c.CODFILIAL AND mv.DTMOV >= c.ULT + 1
  GROUP BY c.CODPROD, c.CODFILIAL
)
SELECT c.CODPROD, SUM(NVL(e.QTESTGER, 0)) HOJE,
       SUM(NVL(e.QTESTGER, 0) - NVL(m.ENTROU, 0) + NVL(m.SAIU, 0)) NA_DATA
FROM c
LEFT JOIN PCEST e ON e.CODPROD = c.CODPROD AND e.CODFILIAL = c.CODFILIAL
LEFT JOIN m ON m.CODPROD = c.CODPROD AND m.CODFILIAL = c.CODFILIAL
GROUP BY c.CODPROD`;

export interface EstoqueCortado {
  hoje: number;
  naData: number; // no dia do último corte do produto no período
}

/** Estoque de hoje e do dia do último corte, por produto cortado entre `ini` e `fim`. */
export async function lerEstoqueDosCortados(ini: string, fim: string): Promise<Map<number, EstoqueCortado>> {
  const rows = await queryWinthor<Record<string, unknown>>(SQL_ESTOQUE, { ini, fim });
  return new Map(rows.map((r) => [num(r.CODPROD), { hoje: Math.max(0, num(r.HOJE)), naData: Math.max(0, num(r.NA_DATA)) }]));
}

import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import type { LinhaFalta } from "@/domain/falta-digitacao";

// Falta na digitação (PCFALTA): item pedido que o Winthor tirou do pedido, ou
// reduziu, por falta de estoque na hora da digitação. Filiais do dashboard, pela
// data da falta. Valor = quantidade em falta × preço de venda do item no pedido.
const SQL_FALTAS = `
SELECT TO_CHAR(TRUNC(f.DATA), 'YYYY-MM-DD') DIA, f.NUMPED, f.CODPROD, p.DESCRICAO PRODUTO, p.CODFORNEC, fo.FORNECEDOR,
       e.NOME COMPRADOR, f.CODCLI, c.CLIENTE, f.CODUSUR, u.NOME RCA,
       NVL(f.QT, 0) QT, NVL(f.QT, 0) * NVL(f.PVENDA, 0) VALOR,
       CASE WHEN EXISTS (SELECT 1 FROM PCPEDC c2 WHERE c2.NUMPED = f.NUMPED) THEN 1 ELSE 0 END TEM_PEDIDO
FROM PCFALTA f
JOIN PCPRODUT p ON p.CODPROD = f.CODPROD
LEFT JOIN PCFORNEC fo ON fo.CODFORNEC = p.CODFORNEC
LEFT JOIN PCEMPR e ON e.MATRICULA = fo.CODCOMPRADOR
LEFT JOIN PCCLIENT c ON c.CODCLI = f.CODCLI
LEFT JOIN PCUSUARI u ON u.CODUSUR = f.CODUSUR
WHERE ${filialIn("f.CODFILIAL")}
  AND f.DATA >= TO_DATE(:ini, 'YYYY-MM-DD') AND f.DATA < TO_DATE(:fim, 'YYYY-MM-DD') + 1
  AND f.QT > 0
ORDER BY f.DATA, f.NUMPED`;

const str = (v: unknown): string | null => (v == null || String(v).trim() === "" ? null : String(v).trim());
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOuNull = (v: unknown): number | null => (v == null ? null : Number(v));

/** Itens em falta na digitação entre `ini` e `fim` ("yyyy-mm-dd", inclusivos). */
export async function lerFaltasDigitacao(ini: string, fim: string): Promise<LinhaFalta[]> {
  const rows = await queryWinthor<Record<string, unknown>>(SQL_FALTAS, { ini, fim });
  return rows.map((r) => ({
    dia: String(r.DIA),
    numped: num(r.NUMPED),
    codprod: num(r.CODPROD),
    produto: str(r.PRODUTO) ?? String(r.CODPROD),
    codfornec: numOuNull(r.CODFORNEC),
    fornecedor: str(r.FORNECEDOR),
    comprador: str(r.COMPRADOR),
    codcli: numOuNull(r.CODCLI),
    cliente: str(r.CLIENTE),
    codusur: numOuNull(r.CODUSUR),
    rca: str(r.RCA),
    qt: num(r.QT),
    valor: num(r.VALOR),
    temPedido: num(r.TEM_PEDIDO) === 1,
  }));
}

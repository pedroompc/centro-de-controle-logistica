import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";

// Busca o XML autorizado da NF-e de um pedido. O XML mora em
// PCDOCELETRONICO.XMLNFE, ligado à nota de saída por NUMTRANSACAO = NUMTRANSVENDA.
// Um pedido pode ter mais de uma NF; pega a de maior NUMNOTA com XML.
const sql = `SELECT * FROM (
  SELECT s.NUMNOTA AS NUMNOTA, d.XMLNFE AS XMLNFE
  FROM PCNFSAID s
  JOIN PCDOCELETRONICO d ON d.NUMTRANSACAO = s.NUMTRANSVENDA
  WHERE ${filialIn("s.CODFILIAL")} AND s.NUMPED = :numped
    AND DBMS_LOB.GETLENGTH(d.XMLNFE) > 0
  ORDER BY s.NUMNOTA DESC
) WHERE ROWNUM = 1`;

export interface XmlNfe {
  numnota: number;
  xml: string;
}

export async function getXmlNfePorPedido(numped: number): Promise<XmlNfe | null> {
  const rows = await queryWinthor<{ NUMNOTA: number; XMLNFE: string }>(sql, { numped });
  const r = rows[0];
  if (!r || !r.XMLNFE) return null;
  return { numnota: Number(r.NUMNOTA), xml: String(r.XMLNFE) };
}

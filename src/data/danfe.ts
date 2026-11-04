import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";

// Busca o XML autorizado da NF-e de um pedido + os campos do Winthor que a nota
// impressa pela empresa traz (canhoto: carregamento, transação, cliente, RCA;
// placa do veículo e volumes). O XML mora em PCDOCELETRONICO.XMLNFE, ligado à
// nota de saída por NUMTRANSACAO = NUMTRANSVENDA. Um pedido pode ter mais de uma
// NF; pega a de maior NUMNOTA com XML.
// VOLUMES = caixas fechadas da nota (QT / QTUNITCX, arredondado pra cima),
// mesma conta da nota impressa.
const sql = `SELECT * FROM (
  SELECT s.NUMNOTA AS NUMNOTA, d.XMLNFE AS XMLNFE,
         s.NUMCAR AS NUMCAR, s.NUMTRANSVENDA AS NUMTRANSVENDA,
         s.CODCLI AS CODCLI, s.CODUSUR AS CODUSUR,
         s.PLACAVEIC AS PLACAVEIC, s.UFPLACAVEIC AS UFPLACAVEIC,
         c.DTSAIDAVEICULO AS DTSAIDAVEICULO,
         (SELECT CEIL(SUM(m.QT / NULLIF(p.QTUNITCX, 0)))
            FROM PCMOV m JOIN PCPRODUT p ON p.CODPROD = m.CODPROD
           WHERE m.NUMTRANSVENDA = s.NUMTRANSVENDA) AS VOLUMES
  FROM PCNFSAID s
  JOIN PCDOCELETRONICO d ON d.NUMTRANSACAO = s.NUMTRANSVENDA
  LEFT JOIN PCCARREG c ON c.NUMCAR = s.NUMCAR
  WHERE ${filialIn("s.CODFILIAL")} AND s.NUMPED = :numped
    AND DBMS_LOB.GETLENGTH(d.XMLNFE) > 0
  ORDER BY s.NUMNOTA DESC
) WHERE ROWNUM = 1`;

// Campos do Winthor que não estão no XML da NF-e.
export interface DanfeWinthor {
  numcar: number | null;
  numtrans: number | null;
  codcli: number | null;
  rca: number | null;
  placa: string | null;
  ufPlaca: string | null;
  dtSaidaVeiculo: Date | null;
  volumes: number | null;
}

export interface XmlNfe {
  numnota: number;
  xml: string;
  winthor: DanfeWinthor;
}

interface Row {
  NUMNOTA: number;
  XMLNFE: string;
  NUMCAR: number | null;
  NUMTRANSVENDA: number | null;
  CODCLI: number | null;
  CODUSUR: number | null;
  PLACAVEIC: string | null;
  UFPLACAVEIC: string | null;
  DTSAIDAVEICULO: Date | null;
  VOLUMES: number | null;
}

const num = (v: unknown): number | null => (v == null ? null : Number(v));

export async function getXmlNfePorPedido(numped: number): Promise<XmlNfe | null> {
  const rows = await queryWinthor<Row>(sql, { numped });
  const r = rows[0];
  if (!r || !r.XMLNFE) return null;
  return {
    numnota: Number(r.NUMNOTA),
    xml: String(r.XMLNFE),
    winthor: {
      numcar: num(r.NUMCAR),
      numtrans: num(r.NUMTRANSVENDA),
      codcli: num(r.CODCLI),
      rca: num(r.CODUSUR),
      placa: r.PLACAVEIC?.trim() || null,
      ufPlaca: r.UFPLACAVEIC?.trim() || null,
      dtSaidaVeiculo: r.DTSAIDAVEICULO ?? null,
      volumes: num(r.VOLUMES),
    },
  };
}

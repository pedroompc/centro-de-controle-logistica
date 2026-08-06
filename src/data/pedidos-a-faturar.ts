import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import type { PedidoPendente } from "@/domain/pedidos-a-faturar/tipos";

// Pedidos liberados (L) e montados (M) sem faturamento, últimos 30 dias.
// Sem ';' final (exigência do queryWinthor). Binds: status_liberado, status_montado.
const SQL = `
SELECT
    ped.NUMPED               AS numero_pedido,
    ped.CODCLI               AS codigo_cliente,
    cli.CLIENTE              AS nome_cliente,
    cli.MUNICENT             AS cidade_cliente,
    cli.BAIRROENT            AS bairro_cliente,
    cli.ESTENT               AS uf_cliente,
    ped.CODUSUR              AS codigo_rca,
    rca.NOME                 AS nome_rca,
    rca.CODSUPERVISOR        AS codigo_supervisor,
    s.NOME                   AS nome_supervisor,
    ped.DATA                 AS data_pedido,
    NVL(ped.DTLIBERA, ped.DATA) AS data_liberacao,
    ped.POSICAO              AS status_winthor,
    NVL(ped.VLATEND, 0)      AS valor_pedido,
    NVL(ped.TOTPESO, 0)      AS peso_pedido,
    ROUND((SYSDATE - NVL(ped.DTLIBERA, ped.DATA)) * 24, 1) AS horas_parado,
    ped.CODEMITENTE          AS codigo_emitente,
    emp.NOME                 AS nome_emitente,
    CASE WHEN ped.CODEMITENTE IN (644, 629, 521, 1015) THEN 'S' ELSE 'N' END AS reentrega
FROM PCPEDC ped
LEFT JOIN PCCLIENT cli ON cli.CODCLI = ped.CODCLI
LEFT JOIN PCUSUARI rca ON rca.CODUSUR = ped.CODUSUR
LEFT JOIN PCSUPERV s   ON s.CODSUPERVISOR = rca.CODSUPERVISOR
LEFT JOIN PCEMPR  emp  ON emp.MATRICULA   = ped.CODEMITENTE
WHERE ped.POSICAO IN (:status_liberado, :status_montado)
  AND ped.CODUSUR != 4
  AND NVL(ped.DTLIBERA, ped.DATA) >= SYSDATE - 30
  AND NOT EXISTS (SELECT 1 FROM PCNFSAID fat WHERE fat.NUMPED = ped.NUMPED)
ORDER BY NVL(ped.DTLIBERA, ped.DATA) ASC`;

const num = (v: unknown): number => Number(v) || 0;
const str = (v: unknown): string | null => (v == null ? null : String(v));

function toISODate(v: unknown): string {
  const d = v instanceof Date ? v : new Date(String(v));
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function mapRowToPedido(row: Record<string, unknown>): PedidoPendente {
  return {
    numeroPedido: num(row.NUMERO_PEDIDO),
    codigoCliente: num(row.CODIGO_CLIENTE),
    nomeCliente: String(row.NOME_CLIENTE ?? ""),
    cidadeCliente: str(row.CIDADE_CLIENTE),
    bairroCliente: str(row.BAIRRO_CLIENTE),
    ufCliente: str(row.UF_CLIENTE),
    codigoRca: num(row.CODIGO_RCA),
    nomeRca: String(row.NOME_RCA ?? ""),
    codigoSupervisor: row.CODIGO_SUPERVISOR == null ? null : num(row.CODIGO_SUPERVISOR),
    nomeSupervisor: str(row.NOME_SUPERVISOR),
    dataPedido: toISODate(row.DATA_PEDIDO),
    dataLiberacao: toISODate(row.DATA_LIBERACAO),
    statusWinthor: String(row.STATUS_WINTHOR ?? ""),
    valorPedido: num(row.VALOR_PEDIDO),
    pesoPedido: num(row.PESO_PEDIDO),
    horasParado: num(row.HORAS_PARADO),
    codigoEmitente: row.CODIGO_EMITENTE == null ? null : num(row.CODIGO_EMITENTE),
    nomeEmitente: str(row.NOME_EMITENTE),
    reentrega: row.REENTREGA === "S",
  };
}

/** Pedidos parados ao vivo. `null` = Winthor indisponível. */
export const getPedidosPendentes = cache(async (): Promise<PedidoPendente[] | null> => {
  try {
    const rows = await queryWinthor<Record<string, unknown>>(SQL, {
      status_liberado: "L",
      status_montado: "M",
    });
    return rows.map(mapRowToPedido);
  } catch (erro) {
    console.error("[pedidos-a-faturar] Winthor indisponível:", (erro as Error).message);
    return null;
  }
});

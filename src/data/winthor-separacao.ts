import { queryWinthor } from "@/lib/oracle/client";
import { inicioFimDoMes } from "@/domain/periodo";
import { sqlDiaOperacional, sqlJanelaOperacional } from "@/domain/turnos-separacao";
import { filialIn } from "./filiais";

/**
 * Confronto da Separação no WINTHOR. O BI mede a produção pelo Harpia (WMS);
 * aqui sai o mesmo período pelo pedido do ERP, para a aba Auditoria comparar.
 *
 * `PCPEDC.DTFINALSEP` NÃO é a hora em que a separação terminou: é gravada no
 * fechamento/retorno da carga ao ERP (17h–06h). Por isso o dia vem do corte
 * operacional (− 07h). Venda balcão tem NUMCAR = 0 e às vezes nem DTFINALSEP —
 * fica de fora daqui e é uma das diferenças conhecidas contra o Harpia.
 */
export interface DiaConfrontoWinthor {
  dia: string; // dia operacional
  filial: string;
  pedidos: number;
  kg: number;
  cancelados: number; // pedidos com DTFINALSEP e POSICAO = 'C' (separados e depois cancelados)
}

const SQL = `
SELECT TO_CHAR(${sqlDiaOperacional("p.DTFINALSEP")}, 'YYYY-MM-DD') AS DIA, p.CODFILIAL AS FILIAL,
       SUM(CASE WHEN p.POSICAO <> 'C' THEN 1 ELSE 0 END) AS PEDIDOS,
       SUM(CASE WHEN p.POSICAO <> 'C' THEN NVL(p.TOTPESO, 0) ELSE 0 END) AS KG,
       SUM(CASE WHEN p.POSICAO = 'C' THEN 1 ELSE 0 END) AS CANC
  FROM PCPEDC p
 WHERE ${sqlJanelaOperacional("p.DTFINALSEP")}
   AND ${filialIn("p.CODFILIAL")}
 GROUP BY ${sqlDiaOperacional("p.DTFINALSEP")}, p.CODFILIAL`;

const num = (v: unknown) => Number(v) || 0;

/** Pedidos com DTFINALSEP no mês, por dia operacional e filial. Lança erro se o Oracle falhar. */
export async function lerConfrontoWinthor(mes: string): Promise<DiaConfrontoWinthor[]> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const rows = await queryWinthor<Record<string, unknown>>(SQL, { ini: inicio, fim });
  return rows
    .map((r) => ({ dia: String(r.DIA), filial: String(r.FILIAL), pedidos: num(r.PEDIDOS), kg: num(r.KG), cancelados: num(r.CANC) }))
    .sort((a, b) => a.dia.localeCompare(b.dia) || a.filial.localeCompare(b.filial));
}

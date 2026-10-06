import { queryWinthor } from "@/lib/oracle/client";
import { inicioFimDoMes } from "@/domain/periodo";
import { filialIn } from "./filiais";

/**
 * Produção da separação pelo WINTHOR: o pedido guarda quando a separação
 * terminou (`PCPEDC.DTFINALSEP` — preenchido em ~99% dos pedidos). Daí sai o
 * que o gestor mede: pedidos separados, kg, carregamentos, clientes e SKUs
 * (linhas do pedido em PCPEDI). Pedido cancelado fica de fora.
 */
export interface DiaProducaoSep {
  dia: string; // "yyyy-mm-dd"
  pedidos: number;
  kg: number;
  valor: number;
  carregamentos: number;
  clientes: number;
  skus: number; // linhas de item (produto × pedido)
}

const SQL = `
WITH ped AS (
  SELECT p.NUMPED, p.DTFINALSEP, NVL(p.TOTPESO, 0) AS KG, NVL(p.VLATEND, 0) AS VALOR, p.NUMCAR, p.CODCLI
    FROM PCPEDC p
   WHERE p.DTFINALSEP >= TO_DATE(:ini, 'YYYY-MM-DD')
     AND p.DTFINALSEP < TO_DATE(:fim, 'YYYY-MM-DD') + 1
     AND p.POSICAO <> 'C'
     AND ${filialIn("p.CODFILIAL")}
), lin AS (
  SELECT i.NUMPED, COUNT(*) AS SKUS
    FROM PCPEDI i
    JOIN ped ON ped.NUMPED = i.NUMPED
   GROUP BY i.NUMPED
)
SELECT TO_CHAR(TRUNC(ped.DTFINALSEP), 'YYYY-MM-DD') AS DIA,
       COUNT(*) AS PEDIDOS,
       SUM(ped.KG) AS KG,
       SUM(ped.VALOR) AS VALOR,
       COUNT(DISTINCT NULLIF(ped.NUMCAR, 0)) AS CARREG,
       COUNT(DISTINCT ped.CODCLI) AS CLIENTES,
       SUM(NVL(lin.SKUS, 0)) AS SKUS
  FROM ped
  LEFT JOIN lin ON lin.NUMPED = ped.NUMPED
 GROUP BY TRUNC(ped.DTFINALSEP)`;

const num = (v: unknown) => Number(v) || 0;

/** Pedidos separados por dia no mês. Lança erro se o Oracle falhar — quem chama mostra. */
export async function lerProducaoSeparacao(mes: string): Promise<DiaProducaoSep[]> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const rows = await queryWinthor<Record<string, unknown>>(SQL, { ini: inicio, fim });
  return rows
    .map((r) => ({
      dia: String(r.DIA),
      pedidos: num(r.PEDIDOS),
      kg: num(r.KG),
      valor: num(r.VALOR),
      carregamentos: num(r.CARREG),
      clientes: num(r.CLIENTES),
      skus: num(r.SKUS),
    }))
    .sort((a, b) => a.dia.localeCompare(b.dia));
}

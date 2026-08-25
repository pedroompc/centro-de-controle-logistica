import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import { ESTADOS_PEDIDO } from "@/domain/pedidos-consulta";
import type { EstadoPedido, PedidoConsulta, ItemPedido } from "@/domain/pedidos-consulta";

const num = (v: unknown): number => Number(v) || 0;
const str = (v: unknown): string | null => (v == null || String(v).trim() === "" ? null : String(v).trim());

function toISO(v: unknown): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Lista de estados para o SQL. Só aceita códigos conhecidos (nunca vem cru do
// usuário p/ dentro da query) — vazio ⇒ todos os estados cobertos pela tela.
function estadosSql(estados: EstadoPedido[]): string {
  const validos = estados.filter((e) => (ESTADOS_PEDIDO as readonly string[]).includes(e));
  const lista = (validos.length ? validos : ESTADOS_PEDIDO).map((e) => `'${e}'`).join(", ");
  return `ped.POSICAO IN (${lista})`;
}

// Faixa por DATA de emissão do pedido (inclusive nos dois extremos).
const faixaData = `ped.DATA >= TO_DATE(:ini,'YYYY-MM-DD') AND ped.DATA < TO_DATE(:fim,'YYYY-MM-DD') + 1`;

// Teto de linhas — protege contra intervalos enormes (a 335 pode ter milhares).
const TETO = 500;

/**
 * Consulta de pedidos (335 turbinada) das filiais 1 e 11, por data de emissão.
 * Uma linha por pedido: cliente, endereço de entrega, estado, motorista da carga,
 * data de faturamento, valor/peso, qtd de itens e se a venda teve devolução.
 *
 * - Motorista: PCPEDC.NUMCAR → PCCARREG.CODMOTORISTA → PCEMPR (só após montagem).
 * - Devolução: existe entrada de devolução (PCESTCOM.VLDEVOLUCAO > 0) ligada a
 *   alguma NF de saída daquele pedido.
 */
const sqlPedidos = (estados: EstadoPedido[]) => `SELECT * FROM (
  SELECT
    ped.NUMPED                       AS NUMPED,
    ped.DATA                         AS DATA_PEDIDO,
    TRUNC(SYSDATE) - TRUNC(ped.DATA) AS DIAS,
    ped.CODCLI                       AS CODCLI,
    cli.CLIENTE                      AS CLIENTE,
    cli.ENDERENT                     AS ENDERECO,
    cli.BAIRROENT                    AS BAIRRO,
    cli.MUNICENT                     AS CIDADE,
    cli.ESTENT                       AS UF,
    ped.POSICAO                      AS POSICAO,
    car.CODMOTORISTA                 AS CODMOTORISTA,
    emp.NOME                         AS MOTORISTA,
    ped.DTFAT                        AS DTFAT,
    NVL(ped.VLTOTAL, 0)              AS VALOR,
    NVL(ped.TOTPESO, 0)              AS PESO,
    (SELECT COUNT(*) FROM PCPEDI i WHERE i.NUMPED = ped.NUMPED) AS QTD_ITENS,
    CASE WHEN EXISTS (
      SELECT 1 FROM PCNFSAID nf
      JOIN PCESTCOM ec ON ec.NUMTRANSVENDA = nf.NUMTRANSVENDA
      WHERE nf.NUMPED = ped.NUMPED AND NVL(ec.VLDEVOLUCAO, 0) > 0
    ) THEN 'S' ELSE 'N' END          AS TEM_DEV
  FROM PCPEDC ped
  LEFT JOIN PCCLIENT cli ON cli.CODCLI      = ped.CODCLI
  LEFT JOIN PCCARREG car ON car.NUMCAR      = ped.NUMCAR
  LEFT JOIN PCEMPR   emp ON emp.MATRICULA   = car.CODMOTORISTA
  WHERE ${filialIn("ped.CODFILIAL")}
    AND ${faixaData}
    AND ${estadosSql(estados)}
  ORDER BY ped.DATA DESC, ped.NUMPED DESC
) WHERE ROWNUM <= ${TETO}`;

interface LinhaPedido {
  NUMPED: number; DATA_PEDIDO: unknown; DIAS: number; CODCLI: number; CLIENTE: string | null;
  ENDERECO: string | null; BAIRRO: string | null; CIDADE: string | null; UF: string | null;
  POSICAO: string | null; CODMOTORISTA: number | null; MOTORISTA: string | null; DTFAT: unknown;
  VALOR: number; PESO: number; QTD_ITENS: number; TEM_DEV: string | null;
}

/**
 * Pedidos no intervalo [ini, fim] (ISO) com os estados pedidos. Retorna `null`
 * se o Winthor estiver indisponível (a página mostra o aviso). Limitado a 500
 * linhas — intervalos grandes devem ser estreitados pelo filtro.
 */
export const getPedidos = cache(async (
  ini: string,
  fim: string,
  estados: EstadoPedido[],
): Promise<PedidoConsulta[] | null> => {
  try {
    const rows = await queryWinthor<LinhaPedido>(sqlPedidos(estados), { ini, fim });
    return rows.map((r) => ({
      numped: num(r.NUMPED),
      data: toISO(r.DATA_PEDIDO) ?? "",
      diasNoSistema: num(r.DIAS),
      codcli: num(r.CODCLI),
      cliente: r.CLIENTE ?? `Cliente ${r.CODCLI}`,
      endereco: str(r.ENDERECO),
      bairro: str(r.BAIRRO),
      cidade: str(r.CIDADE),
      uf: str(r.UF),
      posicao: (r.POSICAO ?? "").trim(),
      codMotorista: r.CODMOTORISTA == null ? null : num(r.CODMOTORISTA),
      motorista: str(r.MOTORISTA),
      dataFaturamento: toISO(r.DTFAT),
      valor: num(r.VALOR),
      peso: num(r.PESO),
      qtdItens: num(r.QTD_ITENS),
      temDevolucao: r.TEM_DEV === "S",
    }));
  } catch (erro) {
    console.error("[pedidos-consulta] Winthor indisponível:", (erro as Error).message);
    return null;
  }
});

const sqlItens = `SELECT i.CODPROD,
       MAX(pr.DESCRICAO) DESCRICAO,
       SUM(NVL(i.QT, 0)) QT,
       ROUND(SUM(NVL(i.QT, 0) * NVL(i.PVENDA, 0)), 2) VALOR
FROM PCPEDI i
LEFT JOIN PCPRODUT pr ON pr.CODPROD = i.CODPROD
WHERE i.NUMPED = :numped
GROUP BY i.CODPROD
ORDER BY VALOR DESC`;

interface LinhaItem { CODPROD: number; DESCRICAO: string | null; QT: number; VALOR: number }

/** Itens de um pedido (drill-down). `[]` se indisponível ou sem itens. */
export const getItensPedido = cache(async (numped: number): Promise<ItemPedido[]> => {
  try {
    const rows = await queryWinthor<LinhaItem>(sqlItens, { numped });
    return rows.map((r) => ({
      codprod: num(r.CODPROD),
      descricao: r.DESCRICAO ?? `Produto ${r.CODPROD}`,
      quantidade: num(r.QT),
      valor: num(r.VALOR),
    }));
  } catch (erro) {
    console.error("[pedidos-consulta] itens indisponíveis:", (erro as Error).message);
    return [];
  }
});

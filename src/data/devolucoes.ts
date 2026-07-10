import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { agregarPorSetor } from "@/domain/devolucoes";
import type {
  ResumoDevolucoes,
  DevolucaoPorMotivo,
  DevolucaoPorCliente,
  SetorDevolucao,
} from "@/domain/devolucoes";

const FILIAL = "1";

// Motivo (PCTABDEV) → setor responsável, conforme o cadastro de motivos do Winthor.
const SETOR = `CASE
    WHEN ne.CODDEVOL IN (85,86,87,88,89,90,91,97,98,99,100,101,102,103,104,111,112) THEN 'Logística'
    WHEN ne.CODDEVOL IN (93,94,95,96,106,107,108,109,110) THEN 'Comercial'
    WHEN ne.CODDEVOL IN (92,105) THEN 'Faturamento'
    ELSE 'Não classificado' END`;

// Regra da rotina 1311 (valor bruto da nota de entrada de devolução).
// A CTE é escopada às vendas do período (senão varre todo o histórico → ~70s).
const CTES = `
vendas AS (
  SELECT nf.NUMTRANSVENDA, nf.CODCLI
  FROM PCNFSAID nf
  WHERE nf.CODFILIAL = :filial
    AND nf.DTSAIDA >= TO_DATE(:ini, 'YYYY-MM-DD') AND nf.DTSAIDA < TO_DATE(:fim, 'YYYY-MM-DD') + 1
    AND NVL(nf.CONDVENDA, 0) NOT IN (4, 8, 10, 13, 20, 98, 99)
),
dev AS (
  SELECT MAX(ec.NUMTRANSVENDA) AS NUMTRANSVENDA,
         MAX(NVL(td.MOTIVO, 'Não informado')) AS MOTIVO,
         ${SETOR} AS SETOR,
         DECODE(ne.VLTOTAL, 0, MAX(NVL(ec.VLDEVOLUCAO, 0)), ne.VLTOTAL) AS VL
  FROM PCNFENT ne
  JOIN PCESTCOM ec ON ec.NUMTRANSENT = ne.NUMTRANSENT
  LEFT JOIN PCTABDEV td ON td.CODDEVOL = ne.CODDEVOL
  WHERE ne.CODFISCAL IN ('131','132','231','232','199','299')
    AND ne.TIPODESCARGA IN ('6','7','T')
    AND NVL(ne.OBS, 'X') <> 'NF CANCELADA'
    AND ec.NUMTRANSVENDA IN (SELECT NUMTRANSVENDA FROM vendas)
    AND EXISTS (SELECT 1 FROM PCMOV pm
                 WHERE pm.NUMTRANSENT = ne.NUMTRANSENT AND pm.NUMNOTA = ne.NUMNOTA AND pm.DTCANCEL IS NULL)
  GROUP BY ne.NUMTRANSENT, ne.VLTOTAL, ne.CODDEVOL
)`;

const SQL_MOTIVO = `WITH ${CTES}
  SELECT dev.MOTIVO, dev.SETOR, COUNT(*) NOTAS, ROUND(SUM(dev.VL), 2) VALOR
  FROM vendas v JOIN dev ON dev.NUMTRANSVENDA = v.NUMTRANSVENDA
  GROUP BY dev.MOTIVO, dev.SETOR
  ORDER BY VALOR DESC`;

const SQL_CLIENTE = `SELECT * FROM (WITH ${CTES}
  SELECT v.CODCLI, MAX(cli.CLIENTE) NOME, COUNT(DISTINCT v.NUMTRANSVENDA) NOTAS, ROUND(SUM(dev.VL), 2) VALOR
  FROM vendas v JOIN dev ON dev.NUMTRANSVENDA = v.NUMTRANSVENDA
  LEFT JOIN PCCLIENT cli ON cli.CODCLI = v.CODCLI
  GROUP BY v.CODCLI ORDER BY VALOR DESC
) WHERE ROWNUM <= 10`;

interface LinhaMotivo { MOTIVO: string; SETOR: string; NOTAS: number; VALOR: number }
interface LinhaCliente { CODCLI: number; NOME: string | null; NOTAS: number; VALOR: number }

function hojeISO(hoje = new Date()): string {
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
const n = (v: unknown): number => Number(v) || 0;

/**
 * Devoluções da filial 1 no mês corrente (1º dia → hoje): total, por setor,
 * por motivo e top clientes. Retorna `null` se o Winthor estiver indisponível.
 */
export const getDevolucoesMesAtual = cache(async (): Promise<ResumoDevolucoes | null> => {
  const binds = { filial: FILIAL, ini: primeiroDiaDoMes(), fim: hojeISO() };
  try {
    const [motivosRaw, clientesRaw] = await Promise.all([
      queryWinthor<LinhaMotivo>(SQL_MOTIVO, binds),
      queryWinthor<LinhaCliente>(SQL_CLIENTE, binds),
    ]);

    const porMotivo: DevolucaoPorMotivo[] = motivosRaw.map((r) => ({
      motivo: r.MOTIVO,
      setor: r.SETOR as SetorDevolucao,
      notas: n(r.NOTAS),
      valor: n(r.VALOR),
    }));
    const topClientes: DevolucaoPorCliente[] = clientesRaw.map((r) => ({
      codcli: n(r.CODCLI),
      nome: r.NOME ?? `Cliente ${r.CODCLI}`,
      notas: n(r.NOTAS),
      valor: n(r.VALOR),
    }));

    return {
      total: porMotivo.reduce((t, m) => t + m.valor, 0),
      porSetor: agregarPorSetor(porMotivo),
      porMotivo,
      topClientes,
    };
  } catch (erro) {
    console.error("[devolucoes] Winthor indisponível:", (erro as Error).message);
    return null;
  }
});

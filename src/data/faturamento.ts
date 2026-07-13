import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { primeiroDiaDoMes } from "@/domain/periodo";
import type { ResumoFaturamento } from "@/domain/faturamento";

// A rotina 111 roda uma filial por vez; o dashboard usa a filial 1 (DIA Afogados).
const FILIAL = "1";

// Faixa de data indexável: `col >= :ini AND col < :fim + 1` (inclui o dia :fim
// inteiro e usa índice — TRUNC(col) BETWEEN desabilitaria o índice e a query
// passava de 25s; assim roda em ~0,1–0,3s).
const faixa = (col: string) =>
  `${col} >= TO_DATE(:ini, 'YYYY-MM-DD') AND ${col} < TO_DATE(:fim, 'YYYY-MM-DD') + 1`;

// Universo de NFs de venda (rotina 111): tipo VP/VV, não canceladas, filial e período.
// "Todos os tipos de venda" na tela = VP + VV (SR/DF/transferências ficam fora).
const FILTRO_NF = `n.CODFILIAL = :filial AND ${faixa("n.DTSAIDA")} AND n.TIPOVENDA IN ('VP', 'VV') AND n.DTCANCEL IS NULL`;
const UNIVERSO_VENDA = `SELECT n.NUMTRANSVENDA FROM PCNFSAID n WHERE ${FILTRO_NF} AND n.NUMTRANSVENDA > 0`;

// Deduções aplicadas ao preço praticado (o desconto já está embutido no PUNIT).
const VALOR_ITEM = `(m.PUNIT - NVL(m.ST, 0) - NVL(m.VLIPI, 0) - NVL(m.VLREPASSE, 0)) * m.QT`;
const PESO_ITEM = `NVL(m.PESOBRUTO, 0) * m.QT`;

// Vínculo da nota de entrada de devolução com a NF de venda de origem. Uma
// devolução SEM vínculo (NUMTRANSVENDA = 0) é "avulsa" — o 111 a isola numa
// linha à parte. Pré-agregado por NUMTRANSENT p/ não multiplicar a soma dos itens.
const VENDA_LINK = `(SELECT NUMTRANSENT, MAX(NVL(NUMTRANSVENDA, 0)) NUMTRANSVENDA
                       FROM PCESTCOM GROUP BY NUMTRANSENT)`;
const EH_AVULSA = `NVL(vlink.NUMTRANSVENDA, 0) = 0`;

// Três agregados de uma linha cada, combinados por cross join. Cada bloco varre
// sua tabela uma única vez; PCMOV é podado por filial + data antes do resto.
const SQL = `
SELECT h.EMITIDAS, h.POSITIVADOS,
       s.VENDA_FATURADA, s.PESO_VENDA,
       d.DEVOLVIDAS, d.DEVOLVIDAS_AVULSAS,
       d.VALOR_DEVOLUCAO, d.VALOR_DEVOLUCAO_AVULSA, d.PESO_DEVOLUCAO
  FROM
  (SELECT COUNT(*) EMITIDAS, COUNT(DISTINCT n.CODCLI) POSITIVADOS
     FROM PCNFSAID n WHERE ${FILTRO_NF}) h,
  (SELECT NVL(SUM(${VALOR_ITEM}), 0) VENDA_FATURADA, NVL(SUM(${PESO_ITEM}), 0) PESO_VENDA
     FROM PCMOV m
    WHERE m.CODFILIAL = :filial AND ${faixa("m.DTMOV")} AND m.CODOPER = 'S'
      AND m.NUMTRANSVENDA IN (${UNIVERSO_VENDA})) s,
  (SELECT COUNT(DISTINCT CASE WHEN NOT (${EH_AVULSA}) THEN m.NUMNOTA END) DEVOLVIDAS,
          COUNT(DISTINCT CASE WHEN ${EH_AVULSA} THEN m.NUMNOTA END) DEVOLVIDAS_AVULSAS,
          NVL(SUM(CASE WHEN NOT (${EH_AVULSA}) THEN ${VALOR_ITEM} END), 0) VALOR_DEVOLUCAO,
          NVL(SUM(CASE WHEN ${EH_AVULSA} THEN ${VALOR_ITEM} END), 0) VALOR_DEVOLUCAO_AVULSA,
          NVL(SUM(${PESO_ITEM}), 0) PESO_DEVOLUCAO
     FROM PCMOV m
     LEFT JOIN ${VENDA_LINK} vlink ON vlink.NUMTRANSENT = m.NUMTRANSENT
    WHERE m.CODFILIAL = :filial AND ${faixa("m.DTMOV")} AND m.CODOPER = 'ED'
      AND m.DTCANCEL IS NULL) d`;

interface LinhaResumo {
  EMITIDAS: number;
  POSITIVADOS: number;
  VENDA_FATURADA: number;
  PESO_VENDA: number;
  DEVOLVIDAS: number;
  DEVOLVIDAS_AVULSAS: number;
  VALOR_DEVOLUCAO: number;
  VALOR_DEVOLUCAO_AVULSA: number;
  PESO_DEVOLUCAO: number;
}

function hojeISO(hoje = new Date()): string {
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

const n = (v: unknown): number => Number(v) || 0;

/**
 * Resumo de faturamento da rotina 111 para um período/filial arbitrários.
 * Retorna `null` se o Winthor estiver indisponível ou não houver dados.
 */
export async function getResumoFaturamento(
  ini: string, fim: string, filial: string = FILIAL,
): Promise<ResumoFaturamento | null> {
  try {
    const rows = await queryWinthor<LinhaResumo>(SQL, { filial, ini, fim });
    const r = rows[0];
    if (!r) return null;

    const vendaFaturada = n(r.VENDA_FATURADA);
    const valorDevolucao = n(r.VALOR_DEVOLUCAO);
    const valorDevolucaoAvulsa = n(r.VALOR_DEVOLUCAO_AVULSA);
    const pesoVenda = n(r.PESO_VENDA);
    const pesoDevolucao = n(r.PESO_DEVOLUCAO);

    return {
      emitidas: n(r.EMITIDAS),
      positivados: n(r.POSITIVADOS),
      devolvidas: n(r.DEVOLVIDAS),
      devolvidasAvulsas: n(r.DEVOLVIDAS_AVULSAS),
      vendaFaturada,
      valorDevolucao,
      valorDevolucaoAvulsa,
      vendaLiquida: vendaFaturada - valorDevolucao - valorDevolucaoAvulsa,
      // Peso líquido de devolução (bate ~exato com a tela do 111; refino fino pendente).
      pesoFaturado: pesoVenda - pesoDevolucao,
      pesoDevolucao,
    };
  } catch (erro) {
    console.error("[faturamento] Winthor indisponível:", (erro as Error).message);
    return null;
  }
}

/** Resumo do mês corrente (1º dia → hoje), memoizado por request. */
export const getResumoFaturamentoMesAtual = cache(
  async (): Promise<ResumoFaturamento | null> =>
    getResumoFaturamento(primeiroDiaDoMes(), hojeISO(), FILIAL),
);

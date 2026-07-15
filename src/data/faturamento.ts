import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { filialIn } from "./filiais";
import type { ResumoFaturamento } from "@/domain/faturamento";

// Faixa de data indexável: `col >= :ini AND col < :fim + 1` (inclui o dia :fim
// inteiro e usa índice — TRUNC(col) BETWEEN desabilitaria o índice e a query
// passava de 25s; assim roda em ~0,1–0,3s).
const faixa = (col: string) =>
  `${col} >= TO_DATE(:ini, 'YYYY-MM-DD') AND ${col} < TO_DATE(:fim, 'YYYY-MM-DD') + 1`;

// Universo de NFs de venda (rotina 111): tipo VP/VV, não canceladas, filiais 1 e
// 11 e período. "Todos os tipos de venda" na tela = VP + VV (SR/DF/transferências
// ficam fora). Usado só para CONTAGENS (Emitidas/Positivados) e PESO — os VALORES
// (faturada, devolução, avulsa) vêm da VIEW_BI_FATURAMENTO (ver SQL).
const FILTRO_NF = `${filialIn("n.CODFILIAL")} AND ${faixa("n.DTSAIDA")} AND n.TIPOVENDA IN ('VP', 'VV') AND n.DTCANCEL IS NULL`;
const UNIVERSO_VENDA = `SELECT n.NUMTRANSVENDA FROM PCNFSAID n WHERE ${FILTRO_NF} AND n.NUMTRANSVENDA > 0`;

const PESO_ITEM = `NVL(m.PESOBRUTO, 0) * m.QT`;

// Vínculo da nota de entrada de devolução com a NF de venda de origem. Uma
// devolução SEM vínculo (NUMTRANSVENDA = 0) é "avulsa" — o 111 a isola numa
// linha à parte. Pré-agregado por NUMTRANSENT p/ não multiplicar a soma dos itens.
const VENDA_LINK = `(SELECT NUMTRANSENT, MAX(NVL(NUMTRANSVENDA, 0)) NUMTRANSVENDA
                       FROM PCESTCOM GROUP BY NUMTRANSENT)`;
const EH_AVULSA = `NVL(vlink.NUMTRANSVENDA, 0) = 0`;

// Quatro agregados de uma linha cada, combinados por cross join. Cada bloco varre
// sua fonte uma única vez.
//   • VALORES (faturada, devolução, avulsa) → VIEW_BI_FATURAMENTO: view oficial
//     de BI que já embute as regras do diretor (deduz ST, IPI, bonificação e
//     avulsa). Bate no centavo com o "Deduzir Devol;ST;Bonif;IPI" do 111.
//   • CONTAGENS (Emitidas/Positivados/Devolvidas) e PESO → PCNFSAID/PCMOV, pois a
//     view não tem número de nota nem peso (kg).
const SQL = `
SELECT val.VENDA_FATURADA, val.VALOR_DEVOLUCAO, val.VALOR_DEVOLUCAO_AVULSA,
       h.EMITIDAS, h.POSITIVADOS, s.PESO_VENDA,
       d.DEVOLVIDAS, d.DEVOLVIDAS_AVULSAS, d.PESO_DEVOLUCAO
  FROM
  (SELECT NVL(SUM(v.VENDAS), 0) VENDA_FATURADA,
          NVL(SUM(v.DEVOLUCAO), 0) VALOR_DEVOLUCAO,
          NVL(SUM(v.AVULSA), 0) VALOR_DEVOLUCAO_AVULSA
     FROM VIEW_BI_FATURAMENTO v
    WHERE ${filialIn("v.CODFILIAL")} AND ${faixa("v.DTSAIDA")}) val,
  (SELECT COUNT(*) EMITIDAS, COUNT(DISTINCT n.CODCLI) POSITIVADOS
     FROM PCNFSAID n WHERE ${FILTRO_NF}) h,
  (SELECT NVL(SUM(${PESO_ITEM}), 0) PESO_VENDA
     FROM PCMOV m
    WHERE ${filialIn("m.CODFILIAL")} AND ${faixa("m.DTMOV")} AND m.CODOPER = 'S'
      AND m.NUMTRANSVENDA IN (${UNIVERSO_VENDA})) s,
  (SELECT COUNT(DISTINCT CASE WHEN NOT (${EH_AVULSA}) THEN m.NUMNOTA END) DEVOLVIDAS,
          COUNT(DISTINCT CASE WHEN ${EH_AVULSA} THEN m.NUMNOTA END) DEVOLVIDAS_AVULSAS,
          NVL(SUM(${PESO_ITEM}), 0) PESO_DEVOLUCAO
     FROM PCMOV m
     LEFT JOIN ${VENDA_LINK} vlink ON vlink.NUMTRANSENT = m.NUMTRANSENT
    WHERE ${filialIn("m.CODFILIAL")} AND ${faixa("m.DTMOV")} AND m.CODOPER = 'ED'
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
 * Resumo de faturamento da rotina 111 (filiais 1 e 11 consolidadas) para um
 * período arbitrário. Retorna `null` se o Winthor estiver indisponível ou não
 * houver dados.
 */
export async function getResumoFaturamento(
  ini: string, fim: string,
): Promise<ResumoFaturamento | null> {
  try {
    const rows = await queryWinthor<LinhaResumo>(SQL, { ini, fim });
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
    getResumoFaturamento(primeiroDiaDoMes(), hojeISO()),
);

import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { mesAnterior, mesProximo } from "@/domain/periodo";
import { rankingOperadores, type OperadorMes, type LinhaRanking } from "@/domain/wms-operacao";
import { CTE_MOVIMENTOS, EMPRESA, tentar } from "./wms";

/*
 * Operação do galpão: produtividade por operador e movimentos por hora do dia.
 * Mesma base da /galpao (MOVIMENT_END_502 efetivados, CTE_MOVIMENTOS) — os
 * totais batem com os cards de verticais/horizontais.
 */

// Por operador e mês. Nome: DESCR_COMPLETO_754 (nome completo) ou o login.
const SQL_OPERADORES = `${CTE_MOVIMENTOS}
SELECT TO_CHAR(b.MES, 'YYYY-MM-DD') MES,
       b.USU,
       MAX(NVL(TRIM(u.DESCR_COMPLETO_754), u.DESCR_754)) NOME,
       COUNT(*) MOVS,
       SUM(b.VERT) VERT,
       SUM(b.HORIZ) HORIZ,
       SUM(CASE WHEN b.TIPO = 'S' THEN 1 ELSE 0 END) ABAST,
       SUM(CASE WHEN b.TIPO = 'E' THEN 1 ELSE 0 END) ARMAZ,
       COUNT(DISTINCT TRUNC(b.DTHR)) DIAS
  FROM base b
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = b.USU
 GROUP BY b.MES, b.USU`;

// Dia da semana ISO sem depender do NLS: 0 = segunda … 6 = domingo.
const DSEM = `(TRUNC(DTHR) - TRUNC(DTHR, 'IW'))`;

// Movimentos por (dia da semana × hora), só os que têm hora real de efetivação.
const SQL_HORAS = `${CTE_MOVIMENTOS}
SELECT ${DSEM} DSEM,
       TO_NUMBER(TO_CHAR(DTHR, 'HH24')) HORA,
       COUNT(*) MOVS,
       SUM(VERT) VERT
  FROM base
 WHERE COM_HORA = 1
 GROUP BY ${DSEM}, TO_NUMBER(TO_CHAR(DTHR, 'HH24'))`;

// Quantos dias de cada dia da semana tiveram movimento (denominador das médias)
// + quantos movimentos ficaram sem hora (para o descarte aparecer na tela).
const SQL_DIAS = `${CTE_MOVIMENTOS}
SELECT ${DSEM} DSEM,
       COUNT(DISTINCT CASE WHEN COM_HORA = 1 THEN TRUNC(DTHR) END) DIAS,
       COUNT(*) TOTAL,
       SUM(COM_HORA) COM_HORA
  FROM base
 GROUP BY ${DSEM}`;

const n = (v: unknown): number => Number(v) || 0;
const vazio24 = () => Array.from({ length: 24 }, () => 0);

export interface OperacaoWms {
  mes: string;
  ranking: LinhaRanking[];
  porHora: number[]; // [0..23] movimentos no mês
  porHoraVert: number[]; // [0..23] só verticais
  grade: number[][]; // [dia da semana 0=seg][hora] movimentos no mês
  diasPorSemana: number[]; // [0=seg..6=dom] dias com movimento
  diasComMovimento: number;
  total: number;
  semHora: number; // movimentos sem hora de efetivação (fora do gráfico por hora)
  indisponivel: string[];
}

/** Operação de um mês: ranking (com o mês anterior para comparar) e distribuição por hora. */
export const getOperacaoWms = cache(async (mes: string): Promise<OperacaoWms> => {
  const falhas: string[] = [];
  const doMes = { emp: EMPRESA, ini: mes, fim: mesProximo(mes) };

  const [opRows, horaRows, diaRows] = await Promise.all([
    tentar("produtividade por operador", falhas, () =>
      queryWinthor<Record<string, unknown>>(SQL_OPERADORES, { emp: EMPRESA, ini: mesAnterior(mes), fim: mesProximo(mes) })),
    tentar("movimentos por hora", falhas, () =>
      queryWinthor<Record<string, unknown>>(SQL_HORAS, doMes)),
    tentar("dias trabalhados", falhas, () =>
      queryWinthor<Record<string, unknown>>(SQL_DIAS, doMes)),
  ]);

  const paraOperador = (r: Record<string, unknown>): OperadorMes => ({
    usuario: n(r.USU),
    nome: r.USU == null ? "Sem usuário registrado" : String(r.NOME ?? `Usuário ${r.USU}`).trim(),
    movimentos: n(r.MOVS),
    verticais: n(r.VERT),
    horizontais: n(r.HORIZ),
    abastecimentos: n(r.ABAST),
    armazenagens: n(r.ARMAZ),
    dias: n(r.DIAS),
  });
  const ops = opRows ?? [];
  const ranking = rankingOperadores(
    ops.filter((r) => r.MES === mes).map(paraOperador),
    ops.filter((r) => r.MES === mesAnterior(mes)).map(paraOperador),
  );

  const porHora = vazio24();
  const porHoraVert = vazio24();
  const grade = Array.from({ length: 7 }, vazio24);
  for (const r of horaRows ?? []) {
    const h = n(r.HORA);
    const d = n(r.DSEM);
    if (h < 0 || h > 23 || d < 0 || d > 6) continue;
    porHora[h] += n(r.MOVS);
    porHoraVert[h] += n(r.VERT);
    grade[d][h] += n(r.MOVS);
  }

  const diasPorSemana = Array.from({ length: 7 }, () => 0);
  let total = 0;
  let comHora = 0;
  for (const r of diaRows ?? []) {
    const d = n(r.DSEM);
    if (d >= 0 && d <= 6) diasPorSemana[d] = n(r.DIAS);
    total += n(r.TOTAL);
    comHora += n(r.COM_HORA);
  }

  return {
    mes,
    ranking,
    porHora,
    porHoraVert,
    grade,
    diasPorSemana,
    diasComMovimento: diasPorSemana.reduce((s, v) => s + v, 0),
    total,
    semHora: total - comHora,
    indisponivel: falhas,
  };
});

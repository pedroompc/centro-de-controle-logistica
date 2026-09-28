import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { mesProximo } from "@/domain/periodo";
import type { MovHoraOperador, CargaSeparada } from "@/domain/wms-eficiencia";
import { CTE_MOVIMENTOS, EMPRESA, faixa, tentar } from "./wms";

/*
 * Base do painel de eficiência por turno (/galpao). Duas queries por mês; todo o
 * drill-down (turno → dia → operador) é feito em memória por montarPainel.
 * A janela vai até o dia 2 do mês seguinte (exclusivo) para a madrugada do dia 1º
 * fechar a última Noite do mês — o domínio descarta o que não é do mês.
 */

// Movimentos efetivados por dia × hora × operador. HORA nula = sem hora de efetivação.
const SQL_MOV = `${CTE_MOVIMENTOS}
SELECT TO_CHAR(TRUNC(b.DTHR), 'YYYY-MM-DD') DIA,
       CASE WHEN b.COM_HORA = 1 THEN TO_NUMBER(TO_CHAR(b.DTHR, 'HH24')) END HORA,
       b.USU,
       MAX(NVL(TRIM(u.DESCR_COMPLETO_754), u.DESCR_754)) NOME,
       SUM(b.VERT) VERT,
       SUM(b.HORIZ) HORIZ
  FROM base b
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = b.USU
 GROUP BY TRUNC(b.DTHR), CASE WHEN b.COM_HORA = 1 THEN TO_NUMBER(TO_CHAR(b.DTHR, 'HH24')) END, b.USU`;

// Cargas FECHADAS pela hora de início da separação (define o turno).
// Tempo = início da separação → início da conferência (mesma regra da aba Indicadores).
// SKUs = produtos distintos nos mapas de separação da carga (1196 → 1195).
const INI = "c.DT_HR_INICIO_SEPARACAO_38";
const SQL_CARGAS = `
SELECT TO_CHAR(c.CARREG_PK_38) CARGA,
       TO_CHAR(${INI}, 'YYYY-MM-DD') DIA,
       CASE WHEN ${INI} <> TRUNC(${INI}) THEN TO_NUMBER(TO_CHAR(${INI}, 'HH24')) END HORA,
       (c.DT_HR_INICIO_CONFERENCIA_38 - ${INI}) * 1440 MIN_SEP,
       NVL(c.PESO_CARREG_38, 0) PESO,
       (SELECT COUNT(DISTINCT mm.MERC_PF_1196)
          FROM HARPIAW2.PLAN_SEP_MAPA_1195 p
          JOIN HARPIAW2.PLAN_SEP_MAPA_MERC_1196 mm
            ON mm.EMPRESA_PF_1196 = p.EMPRESA_PF_1195 AND mm.SEQ_PLANILHA_PF_1196 = p.SEQ_PLANILHA_PK_1195
         WHERE p.EMPRESA_PF_1195 = c.EMPRESA_PF_38
           AND p.CARGA_1195 = c.CARREG_PK_38) SKUS
  FROM HARPIAW2.CARREG_VEIC_38 c
 WHERE c.EMPRESA_PF_38 = :emp
   AND c.DT_HR_FECHAMENTO_CARGA_38 IS NOT NULL
   AND ${faixa(INI)}`;

const n = (v: unknown): number => Number(v) || 0;
const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export interface BaseEficiencia {
  movs: MovHoraOperador[];
  cargas: CargaSeparada[];
  indisponivel: string[];
}

export const getBaseEficiencia = cache(async (mes: string): Promise<BaseEficiencia> => {
  const falhas: string[] = [];
  const binds = { emp: EMPRESA, ini: mes, fim: mesProximo(mes).slice(0, 8) + "02" };

  const [movRows, cargaRows] = await Promise.all([
    tentar("movimentações", falhas, () => queryWinthor<Record<string, unknown>>(SQL_MOV, binds)),
    tentar("separação de cargas", falhas, () => queryWinthor<Record<string, unknown>>(SQL_CARGAS, binds)),
  ]);

  return {
    movs: (movRows ?? []).map((r) => ({
      dia: String(r.DIA),
      hora: nulo(r.HORA),
      usuario: nulo(r.USU),
      nome: r.USU == null ? "Sem usuário registrado" : String(r.NOME ?? `Usuário ${r.USU}`).trim(),
      verticais: n(r.VERT),
      horizontais: n(r.HORIZ),
    })),
    cargas: (cargaRows ?? []).map((r) => ({
      carga: String(r.CARGA),
      dia: String(r.DIA),
      hora: nulo(r.HORA),
      minutos: nulo(r.MIN_SEP),
      skus: n(r.SKUS),
      pesoKg: n(r.PESO),
    })),
    indisponivel: falhas,
  };
});

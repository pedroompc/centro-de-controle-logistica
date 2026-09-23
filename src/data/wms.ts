import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { mesProximo } from "@/domain/periodo";
import {
  estatisticaPorMes, estatisticaSeparacao, MOV_VAZIO, COLETOR_VAZIO,
  type PontoWms, type MovimentoMes, type ColetorMes,
} from "@/domain/wms";

/*
 * WMS Harpia — schema HARPIAW2 (produção), no MESMO Oracle do WinThor.
 * Mapa das tabelas e o porquê de cada regra: docs/superpowers/specs/2026-09-23-wms-eficiencia-galpao-design.md
 * Queries equivalentes para conferir no cliente SQL: docs/wms/validacao-kpis-galpao.sql
 */

/** Empresa do WMS (EMPRESA_PF_* = 1 em todas as amostras — CD de Moreno). */
export const EMPRESA = 1;

/** Tetos para descartar tarefa esquecida em aberto (minutos). */
export const TETO_CARGA_MIN = 12 * 60; // uma carga grande pode levar um turno inteiro
export const TETO_COLETOR_MIN = 4 * 60; // uma tarefa de coletor é curta

// Datas vêm como 'YYYY-MM-DD'; `fim` é exclusivo (1º dia do mês seguinte).
export const faixa = (col: string) =>
  `${col} >= TO_DATE(:ini,'YYYY-MM-DD') AND ${col} < TO_DATE(:fim,'YYYY-MM-DD')`;

const n = (v: unknown): number => Number(v) || 0;

/*
 * Endereço = 9 dígitos RR PP NN AAA (rua, prédio, NÍVEL, apartamento) — ex.:
 * 070901002 ⇒ GRAU1=07, GRAU2=09, GRAU3=01, GRAU4=002 (DEPOSIT_EMPRESA_END_179).
 * Nível 01 é o chão; acima disso só com empilhadeira. Ruas virtuais
 * (PRIM_GRAU_END_611.SN_VIRTUAL_611 = 'S') e códigos fora do padrão ficam sem nível.
 */
const nivel = (col: string, virt: string) =>
  `CASE WHEN REGEXP_LIKE(${col}, '^[0-9]{9}$') AND ${virt}.RUA IS NULL THEN SUBSTR(${col}, 5, 2) END`;

// Só movimentos EFETIVADOS (STATUS_502 = 2). Pré-contagem (C) fica fora: quantidade sempre zero.
// CTE compartilhada pelas queries de movimentação (mês, operador e hora do dia).
//   DTHR     = quando o movimento foi efetivado (DT_FIN_502; sem ele, a data do movimento)
//   COM_HORA = 1 se DT_FIN_502 traz hora de verdade (DT_MOVIMENT_502 às vezes é só data)
//   USU      = quem efetivou (USU_EFETIV_FK_502; sem ele, quem registrou)
//   VERT/HORIZ = 1/0 conforme o nível de origem/destino
export const CTE_MOVIMENTOS = `
WITH virt AS (
  SELECT PRIM_GRAU_END_PK_611 RUA FROM HARPIAW2.PRIM_GRAU_END_611
   WHERE EMPRESA_PF_611 = :emp AND SN_VIRTUAL_611 = 'S'
),
niv AS (
  SELECT NVL(m.DT_FIN_502, m.DT_MOVIMENT_502) DTHR,
         CASE WHEN m.DT_FIN_502 IS NOT NULL AND m.DT_FIN_502 <> TRUNC(m.DT_FIN_502) THEN 1 ELSE 0 END COM_HORA,
         NVL(m.USU_EFETIV_FK_502, m.USU_FK_502) USU,
         m.TIPO_MOVIMENT_502 TIPO,
         m.MERC_PF_502 MERC,
         NVL(m.PESO_502, 0) PESO,
         ${nivel("m.END_PF_502", "vo")} NIV_O,
         ${nivel("m.END_DESTINO_FK_502", "vd")} NIV_D
    FROM HARPIAW2.MOVIMENT_END_502 m
    LEFT JOIN virt vo ON vo.RUA = SUBSTR(m.END_PF_502, 1, 2)
    LEFT JOIN virt vd ON vd.RUA = SUBSTR(m.END_DESTINO_FK_502, 1, 2)
   WHERE m.EMPRESA_PF_502 = :emp
     AND m.STATUS_502 = '2'
     AND m.TIPO_MOVIMENT_502 IN ('S', 'E', 'I', 'D')
     AND ${faixa("NVL(m.DT_FIN_502, m.DT_MOVIMENT_502)")}
),
base AS (
  SELECT niv.*,
         TRUNC(DTHR, 'MM') MES,
         CASE WHEN NIV_O > '01' OR NIV_D > '01' THEN 1 ELSE 0 END VERT,
         CASE WHEN NOT (NVL(NIV_O, '00') > '01' OR NVL(NIV_D, '00') > '01')
               AND (NIV_O IS NOT NULL OR NIV_D IS NOT NULL) THEN 1 ELSE 0 END HORIZ
    FROM niv
)
`;

const SQL_MOVIMENTOS = `${CTE_MOVIMENTOS}
SELECT TO_CHAR(MES, 'YYYY-MM-DD') MES,
       SUM(VERT) VERTICAIS,
       SUM(HORIZ) HORIZONTAIS,
       SUM(CASE WHEN TIPO = 'S' THEN 1 ELSE 0 END) ABASTECIMENTOS,
       SUM(CASE WHEN TIPO = 'E' THEN 1 ELSE 0 END) ARMAZENAGENS,
       SUM(CASE WHEN TIPO = 'I' THEN 1 ELSE 0 END) INTERNAS,
       SUM(CASE WHEN TIPO = 'D' THEN 1 ELSE 0 END) DEVOLUCOES,
       SUM(PESO) PESO,
       COUNT(DISTINCT MERC) SKUS
  FROM base
 GROUP BY MES`;

// Uma linha por carga FECHADA (fechada = expedida). Um caminhão sai com várias
// cargas, então a viagem é contada à parte: placa distinta por dia. Durações em minutos.
const SQL_CARGAS = `
SELECT TO_CHAR(TRUNC(c.DT_CARREG_PK_38, 'MM'), 'YYYY-MM-DD') MES,
       NVL(c.PESO_CARREG_38, 0) PESO,
       TO_CHAR(c.DT_CARREG_PK_38, 'YYYY-MM-DD') DIA,
       c.PLACA_VEIC_FK_38 PLACA,
       (c.DT_HR_INICIO_CONFERENCIA_38 - c.DT_HR_INICIO_SEPARACAO_38) * 1440 MIN_SEP,
       (c.DT_HR_FECHAMENTO_CARGA_38 - c.DT_HR_INICIO_SEPARACAO_38) * 1440 MIN_CICLO
  FROM HARPIAW2.CARREG_VEIC_38 c
 WHERE c.EMPRESA_PF_38 = :emp
   AND c.DT_HR_FECHAMENTO_CARGA_38 IS NOT NULL
   AND ${faixa("c.DT_CARREG_PK_38")}`;

// Tarefas de separação por coletor finalizadas; linha = item com algo separado.
const SQL_COLETOR = `
WITH t AS (
  SELECT TRUNC(s.DT_HR_SEP_INI_1275, 'MM') MES,
         s.USU_SEPARADOR_FK_1275 USU,
         (s.DT_HR_SEP_FIM_1275 - s.DT_HR_SEP_INI_1275) * 1440 DUR_MIN,
         (SELECT COUNT(*) FROM HARPIAW2.PLAN_SEP_COLETOR_MERC_1276 i
           WHERE i.EMPRESA_PF_1276 = s.EMPRESA_PF_1275
             AND i.SEQ_SEPARACAO_PF_1276 = s.SEQ_SEPARACAO_PK_1275
             AND NVL(i.QTD_UN_SEPARADA_1276, 0) + NVL(i.QTD_CX_SEPARADA_1276, 0) > 0) LINHAS
    FROM HARPIAW2.PLAN_SEP_COLETOR_1275 s
   WHERE s.EMPRESA_PF_1275 = :emp
     AND s.DT_HR_SEP_FIM_1275 IS NOT NULL
     AND ${faixa("s.DT_HR_SEP_INI_1275")}
)
SELECT TO_CHAR(MES, 'YYYY-MM-DD') MES,
       COUNT(*) TAREFAS,
       COUNT(DISTINCT USU) SEPARADORES,
       SUM(DUR_MIN) MINUTOS,
       SUM(LINHAS) LINHAS
  FROM t
 WHERE DUR_MIN >= 0 AND DUR_MIN <= :teto
 GROUP BY MES`;

// Foto de HOJE (o WMS não guarda saldo histórico por SKU).
// "Sem saída" = SKU com saldo que não entrou em nenhuma carga dos últimos 90 dias
// (mapa de separação 1196 → planilha 1195 → carga 38).
const SQL_ESTOQUE = `
SELECT
  (SELECT COUNT(*) FROM HARPIAW2.MERC_EMPRESA_468
    WHERE EMPRESA_PF_468 = :emp AND SALDO_ESTOQ_468 > 0) SKUS,
  (SELECT COUNT(*) FROM HARPIAW2.MERC_EMPRESA_468 me
    WHERE me.EMPRESA_PF_468 = :emp AND me.SALDO_ESTOQ_468 > 0
      AND NOT EXISTS (
        SELECT 1
          FROM HARPIAW2.PLAN_SEP_MAPA_MERC_1196 mm
          JOIN HARPIAW2.PLAN_SEP_MAPA_1195 p
            ON p.EMPRESA_PF_1195 = mm.EMPRESA_PF_1196 AND p.SEQ_PLANILHA_PK_1195 = mm.SEQ_PLANILHA_PF_1196
          JOIN HARPIAW2.CARREG_VEIC_38 c
            ON c.EMPRESA_PF_38 = p.EMPRESA_PF_1195 AND c.CARREG_PK_38 = p.CARGA_1195
         WHERE mm.EMPRESA_PF_1196 = me.EMPRESA_PF_468
           AND mm.MERC_PF_1196 = me.MERC_PF_468
           AND c.DT_CARREG_PK_38 >= TRUNC(SYSDATE) - 90)) SKUS_SEM_SAIDA,
  (SELECT COUNT(*) FROM HARPIAW2.DEPOSIT_EMPRESA_END_179
    WHERE EMPRESA_PF_179 = :emp AND TIPO_END_179 = 'M' AND STATUS_179 = 'O') PULMAO_OCUPADO,
  (SELECT COUNT(*) FROM HARPIAW2.DEPOSIT_EMPRESA_END_179
    WHERE EMPRESA_PF_179 = :emp AND TIPO_END_179 = 'M' AND STATUS_179 <> 'B') PULMAO_UTIL
FROM DUAL`;

export interface FotoEstoque {
  skus: number;
  skusSemSaida90d: number;
  pulmaoOcupado: number;
  pulmaoUtil: number; // posições de pulmão não bloqueadas
}

export interface PainelWms {
  serie: PontoWms[]; // do mês mais antigo ao corrente (último = parcial)
  estoque: FotoEstoque | null;
  // Fontes que falharam (a página avisa em vez de mostrar zero como se fosse real).
  indisponivel: string[];
}

export async function tentar<T>(rotulo: string, falhas: string[], fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (erro) {
    console.error(`[wms] ${rotulo} indisponível:`, (erro as Error).message);
    falhas.push(rotulo);
    return null;
  }
}

/** Série mensal do galpão para os `meses` informados (ISO, 1º dia, em ordem) + foto do estoque. */
export const getPainelWms = cache(async (meses: string[]): Promise<PainelWms> => {
  const ini = meses[0];
  const fim = mesProximo(meses[meses.length - 1]);
  const falhas: string[] = [];

  const [movRows, cargaRows, coletorRows, estoqueRows] = await Promise.all([
    tentar("movimentações", falhas, () =>
      queryWinthor<Record<string, unknown>>(SQL_MOVIMENTOS, { emp: EMPRESA, ini, fim })),
    tentar("cargas", falhas, () =>
      queryWinthor<Record<string, unknown>>(SQL_CARGAS, { emp: EMPRESA, ini, fim })),
    tentar("separação por coletor", falhas, () =>
      queryWinthor<Record<string, unknown>>(SQL_COLETOR, { emp: EMPRESA, ini, fim, teto: TETO_COLETOR_MIN })),
    tentar("estoque", falhas, () =>
      queryWinthor<Record<string, unknown>>(SQL_ESTOQUE, { emp: EMPRESA })),
  ]);

  const mov = new Map<string, MovimentoMes>();
  for (const r of movRows ?? []) {
    mov.set(String(r.MES), {
      verticais: n(r.VERTICAIS),
      horizontais: n(r.HORIZONTAIS),
      abastecimentos: n(r.ABASTECIMENTOS),
      armazenagens: n(r.ARMAZENAGENS),
      internas: n(r.INTERNAS),
      devolucoes: n(r.DEVOLUCOES),
      pesoKg: n(r.PESO),
      skusMovimentados: n(r.SKUS),
    });
  }

  const cargas = cargaRows ?? [];
  const nulo = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  const sep = estatisticaPorMes(cargas.map((r) => ({ mes: String(r.MES), minutos: nulo(r.MIN_SEP) })), TETO_CARGA_MIN);
  const ciclo = estatisticaPorMes(cargas.map((r) => ({ mes: String(r.MES), minutos: nulo(r.MIN_CICLO) })), TETO_CARGA_MIN);
  const volume = new Map<string, { cargas: number; pesoKg: number; saidas: Set<string> }>();
  for (const r of cargas) {
    const v = volume.get(String(r.MES)) ?? { cargas: 0, pesoKg: 0, saidas: new Set<string>() };
    v.cargas += 1;
    v.pesoKg += n(r.PESO);
    const placa = String(r.PLACA ?? "").trim();
    if (placa) v.saidas.add(`${placa}|${r.DIA}`);
    volume.set(String(r.MES), v);
  }

  const coletor = new Map<string, ColetorMes>();
  for (const r of coletorRows ?? []) {
    coletor.set(String(r.MES), {
      tarefas: n(r.TAREFAS),
      separadores: n(r.SEPARADORES),
      minutos: n(r.MINUTOS),
      linhas: n(r.LINHAS),
    });
  }

  const vazio = estatisticaSeparacao([]);
  const serie: PontoWms[] = meses.map((mes) => ({
    mes,
    pesoFaturadoKg: null, // preenchido pela página com o WinThor (fonte do dashboard)
    mov: mov.get(mes) ?? MOV_VAZIO,
    cargas: {
      cargas: volume.get(mes)?.cargas ?? 0,
      pesoKg: volume.get(mes)?.pesoKg ?? 0,
      viagens: volume.get(mes)?.saidas.size ?? 0,
      separacao: sep.get(mes) ?? vazio,
      ciclo: ciclo.get(mes) ?? vazio,
    },
    coletor: coletor.get(mes) ?? COLETOR_VAZIO,
  }));

  const e = estoqueRows?.[0];
  const estoque: FotoEstoque | null = e
    ? {
        skus: n(e.SKUS),
        skusSemSaida90d: n(e.SKUS_SEM_SAIDA),
        pulmaoOcupado: n(e.PULMAO_OCUPADO),
        pulmaoUtil: n(e.PULMAO_UTIL),
      }
    : null;

  return { serie, estoque, indisponivel: falhas };
});

import { queryWinthor } from "@/lib/oracle/client";
import { inicioFimDoMes } from "@/domain/periodo";
import { filialIn } from "./filiais";

/**
 * Abastecimento no Harpia (esquema HARPIAW2, mesmo Oracle do Winthor) tem
 * DUAS fontes independentes, quase sem ligação entre si:
 *
 * 1) `PREPARA_ABAST_809`/`_GUIAS_1360`/`_MERC_1361` — o FATURAMENTO prepara a
 *    carga/guia pra separação (quem/quando em `PREP_USU_FK_809` é faturamento,
 *    não quem executa no piso).
 * 2) `MOVIMENT_END_502` — a movimentação FÍSICA de endereço (reserva → picking,
 *    `TIPO_END_502='M'` para `TIPO_END_DESTINO_502` em ('C','P')), executada
 *    pela equipe real de piso (depto LOGISTICA). É bem maior em volume que (1)
 *    e é a fonte certa pra "quem fez", vertical×horizontal e horário.
 *
 * Rupturas de picking (estoque negativo no endereço) ficam em
 * `HIST_ABAST_NEG_848`, ligadas a (1).
 *
 * Movimentação e cargas vêm em linhas POR DIA (não pré-agregadas) pra dar
 * pro BI cruzar filtro de dia entre visões e abrir histórico por pessoa/
 * produto — a agregação em si é feita no domínio (`@/domain/abastecimento`).
 */

export interface DiaAbastecimento {
  dia: string; // "yyyy-mm-dd"
  abastecimentos: number;
  caixas: number;
  unidades: number;
  skus: number; // produtos distintos abastecidos no dia
}

export interface ProdutoGiro {
  produto: number;
  descricao: string | null;
  curva: string | null; // classe de venda do Winthor (A/B/C) — proxy da curva ABC
  abastecimentos: number;
  caixas: number;
  unidades: number;
}

export interface ProdutoGiroDia {
  produto: number;
  dia: string;
  abastecimentos: number;
}

export interface CurvaAbast {
  curva: string; // "A" | "B" | "C" | "?" (sem classificação)
  abastecimentos: number;
  skus: number; // produtos distintos dessa curva abastecidos no mês
}

export interface CargaAntecedencia {
  numcar: number;
  dia: string; // dia do 1º abastecimento que serviu a carga
  /** Horas entre o 1º abastecimento e o fim da separação da carga; `null` = carga sem separação finalizada no recorte. */
  horasFolga: number | null;
}

export interface RupturaAbastecimento {
  data: string; // "yyyy-mm-dd HH:mm"
  produto: number;
  descricao: string | null;
  caixas: number;
  unidades: number;
}

export interface LinhaPessoaDia {
  dia: string;
  usuario: number;
  nome: string | null;
  departamento: string | null;
  total: number;
  vertical: number;
}

export interface LinhaHoraDia {
  dia: string;
  hora: number;
  total: number;
}

export interface DiaMovimentoPiso {
  dia: string;
  total: number;
  vertical: number;
}

export interface ProdutoMovimentoPiso {
  produto: number;
  descricao: string | null;
  total: number;
}

export interface MovimentoPiso {
  total: number;
  vertical: number;
  horizontal: number;
  dias: DiaMovimentoPiso[]; // pro calendário
  porPessoaDia: LinhaPessoaDia[]; // agregação/filtro por dia é no domínio
  porHoraDia: LinhaHoraDia[]; // idem
  produtosTop: ProdutoMovimentoPiso[]; // top 50 do mês inteiro
}

export interface LinhaConvocacao {
  dia: string;
  operador: number;
  nome: string | null;
  minutosResposta: number | null; // aceite − solicitação
  minutosExecucao: number | null; // finalização − aceite
  finalizada: boolean;
  rejeitada: boolean;
}

export interface DadosHarpiaAbastecimento {
  dias: DiaAbastecimento[];
  produtos: ProdutoGiro[];
  produtosDia: ProdutoGiroDia[]; // histórico diário só dos produtos do top 20 (drill-down)
  curvas: CurvaAbast[];
  cargas: CargaAntecedencia[];
  rupturas: RupturaAbastecimento[];
  /** Abastecimentos (eventos) do mês que tiveram ruptura associada — o resto é preventivo. */
  abastecimentosReativos: number;
  /** Movimentação física de endereço (reserva → picking), pela equipe de piso. */
  movimentoPiso: MovimentoPiso;
  /** Convocação Ativa: solicitação→aceite→finalização por operador. Módulo ligado em 2026-10-13 — ainda com poucos dados. */
  convocacoes: LinhaConvocacao[];
}

const num = (v: unknown) => Number(v) || 0;

const SQL_DIAS = `
SELECT TO_CHAR(TRUNC(p.PREP_DTHR_809), 'YYYY-MM-DD') AS DIA,
       COUNT(DISTINCT p.ID_NUM_ABAST_PK_809) AS ABASTS,
       SUM(m.QTD_SEP_CX_1361) AS CX,
       SUM(m.QTD_SEP_UN_1361) AS UN,
       COUNT(DISTINCT m.MERC_FK_1361) AS SKUS
  FROM HARPIAW2.PREPARA_ABAST_809 p
  JOIN HARPIAW2.PREPARA_ABAST_MERC_1361 m ON m.NUM_ABAST_FK_1361 = p.ID_NUM_ABAST_PK_809
 WHERE p.PREP_DTHR_809 >= TO_DATE(:ini, 'YYYY-MM-DD') AND p.PREP_DTHR_809 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
 GROUP BY TRUNC(p.PREP_DTHR_809)`;

// ROWNUM (não FETCH FIRST) por compatibilidade com Oracle anterior ao 12c.
// CLASSEVENDA do Winthor = proxy da curva ABC (classificação por venda).
const SQL_PRODUTOS = `
SELECT * FROM (
  SELECT m.MERC_FK_1361 AS PRODUTO, pr.CLASSEVENDA AS CURVA, COUNT(*) AS QTD,
         SUM(m.QTD_SEP_CX_1361) AS CX, SUM(m.QTD_SEP_UN_1361) AS UN
    FROM HARPIAW2.PREPARA_ABAST_MERC_1361 m
    JOIN HARPIAW2.PREPARA_ABAST_809 p ON p.ID_NUM_ABAST_PK_809 = m.NUM_ABAST_FK_1361
    LEFT JOIN PCPRODUT pr ON pr.CODPROD = m.MERC_FK_1361
   WHERE p.PREP_DTHR_809 >= TO_DATE(:ini, 'YYYY-MM-DD') AND p.PREP_DTHR_809 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   GROUP BY m.MERC_FK_1361, pr.CLASSEVENDA
   ORDER BY COUNT(*) DESC
) WHERE ROWNUM <= 20`;

const SQL_CURVAS = `
SELECT NVL(pr.CLASSEVENDA, '?') AS CURVA, COUNT(*) AS QTD, COUNT(DISTINCT m.MERC_FK_1361) AS SKUS
  FROM HARPIAW2.PREPARA_ABAST_MERC_1361 m
  JOIN HARPIAW2.PREPARA_ABAST_809 p ON p.ID_NUM_ABAST_PK_809 = m.NUM_ABAST_FK_1361
  LEFT JOIN PCPRODUT pr ON pr.CODPROD = m.MERC_FK_1361
 WHERE p.PREP_DTHR_809 >= TO_DATE(:ini, 'YYYY-MM-DD') AND p.PREP_DTHR_809 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
 GROUP BY pr.CLASSEVENDA`;

// Antecedência: 1º abastecimento (Harpia) que serviu a carga × 1ª separação
// finalizada (Winthor) daquela mesma carga. Diferença calculada no Oracle
// (dias de DATE), em horas; carga sem separação ainda fica com NULL.
const SQL_CARGAS = `
WITH abast AS (
  SELECT g.CARREG_1360 AS NUMCAR, MIN(p.PREP_DTHR_809) AS DT_ABAST
    FROM HARPIAW2.PREPARA_ABAST_GUIAS_1360 g
    JOIN HARPIAW2.PREPARA_ABAST_809 p ON p.ID_NUM_ABAST_PK_809 = g.NUM_ABAST_FK_1360
   WHERE p.PREP_DTHR_809 >= TO_DATE(:ini, 'YYYY-MM-DD') AND p.PREP_DTHR_809 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
     AND g.CARREG_1360 IS NOT NULL AND g.CARREG_1360 > 0
   GROUP BY g.CARREG_1360
), sep AS (
  SELECT NUMCAR, MIN(DTFINALSEP) AS DT_SEP
    FROM PCPEDC
   WHERE NUMCAR IS NOT NULL AND NUMCAR > 0 AND POSICAO <> 'C' AND ${filialIn("CODFILIAL")}
   GROUP BY NUMCAR
)
SELECT a.NUMCAR, TO_CHAR(TRUNC(a.DT_ABAST), 'YYYY-MM-DD') AS DIA, (s.DT_SEP - a.DT_ABAST) * 24 AS HORAS_FOLGA
  FROM abast a
  LEFT JOIN sep s ON s.NUMCAR = a.NUMCAR`;

const SQL_RUPTURAS = `
SELECT TO_CHAR(h.DT_HIST_PK_848, 'YYYY-MM-DD HH24:MI') AS DT, h.MERC_PF_848 AS PRODUTO,
       h.TOTAL_CX_848 AS CX, h.TOTAL_UN_848 AS UN
  FROM HARPIAW2.HIST_ABAST_NEG_848 h
 WHERE h.DT_HIST_PK_848 >= TO_DATE(:ini, 'YYYY-MM-DD') AND h.DT_HIST_PK_848 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
 ORDER BY h.DT_HIST_PK_848 DESC`;

const SQL_REATIVOS = `
SELECT COUNT(DISTINCT ABASTECIMENTO_848) AS REATIVOS
  FROM HARPIAW2.HIST_ABAST_NEG_848
 WHERE DT_HIST_PK_848 >= TO_DATE(:ini, 'YYYY-MM-DD') AND DT_HIST_PK_848 < TO_DATE(:fim, 'YYYY-MM-DD') + 1`;

// Movimentação física de endereço: reserva (M) → picking/conferência (C/P).
// Endereço = RUA(2)+PREDIO(2)+NIVEL(2)+APTO(3); nível em SUBSTR(col,5,2),
// validado contra a faixa real de uso (00-05, ver convocação ativa 1022).
const FILTRO_PISO = `m.TIPO_END_502 = 'M' AND m.TIPO_END_DESTINO_502 IN ('C', 'P') AND LENGTH(m.END_PF_502) = 9 AND LENGTH(m.END_DESTINO_FK_502) = 9`;
const VERTICAL_PISO = `CASE WHEN SUBSTR(m.END_PF_502, 5, 2) <> SUBSTR(m.END_DESTINO_FK_502, 5, 2) THEN 1 ELSE 0 END`;

const SQL_MOVIMENTO_TOTAL = `
SELECT COUNT(*) AS TOTAL, SUM(${VERTICAL_PISO}) AS VERTICAL
  FROM HARPIAW2.MOVIMENT_END_502 m
 WHERE m.DT_MOVIMENT_502 >= TO_DATE(:ini, 'YYYY-MM-DD') AND m.DT_MOVIMENT_502 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   AND ${FILTRO_PISO}`;

// Por pessoa E por dia (não pré-agregado) — dá pro BI filtrar por dia e abrir histórico por pessoa.
const SQL_MOVIMENTO_PESSOAS_DIA = `
SELECT TO_CHAR(TRUNC(m.DT_MOVIMENT_502), 'YYYY-MM-DD') AS DIA, m.USU_FK_502 AS USU,
       u.DESCR_COMPLETO_754 AS NOME, d.DESCR_176 AS DEPTO,
       COUNT(*) AS TOTAL, SUM(${VERTICAL_PISO}) AS VERTICAL
  FROM HARPIAW2.MOVIMENT_END_502 m
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = m.USU_FK_502
  LEFT JOIN HARPIAW2.DEPART_176 d ON d.DEPART_PK_176 = u.DEPART_FK_754
 WHERE m.DT_MOVIMENT_502 >= TO_DATE(:ini, 'YYYY-MM-DD') AND m.DT_MOVIMENT_502 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   AND ${FILTRO_PISO}
 GROUP BY TRUNC(m.DT_MOVIMENT_502), m.USU_FK_502, u.DESCR_COMPLETO_754, d.DESCR_176`;

const SQL_MOVIMENTO_DIAS = `
SELECT TO_CHAR(TRUNC(m.DT_MOVIMENT_502), 'YYYY-MM-DD') AS DIA, COUNT(*) AS TOTAL, SUM(${VERTICAL_PISO}) AS VERTICAL
  FROM HARPIAW2.MOVIMENT_END_502 m
 WHERE m.DT_MOVIMENT_502 >= TO_DATE(:ini, 'YYYY-MM-DD') AND m.DT_MOVIMENT_502 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   AND ${FILTRO_PISO}
 GROUP BY TRUNC(m.DT_MOVIMENT_502)`;

// Por hora E por dia — mesma lógica: filtro de dia reusa a mesma consulta.
const SQL_MOVIMENTO_HORA_DIA = `
SELECT TO_CHAR(TRUNC(m.DT_MOVIMENT_502), 'YYYY-MM-DD') AS DIA, TO_CHAR(m.DT_MOVIMENT_502, 'HH24') AS HORA, COUNT(*) AS TOTAL
  FROM HARPIAW2.MOVIMENT_END_502 m
 WHERE m.DT_MOVIMENT_502 >= TO_DATE(:ini, 'YYYY-MM-DD') AND m.DT_MOVIMENT_502 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   AND ${FILTRO_PISO}
 GROUP BY TRUNC(m.DT_MOVIMENT_502), TO_CHAR(m.DT_MOVIMENT_502, 'HH24')`;

// ROWNUM (não FETCH FIRST) por compatibilidade com Oracle anterior ao 12c.
const SQL_MOVIMENTO_PRODUTOS = `
SELECT * FROM (
  SELECT m.MERC_PF_502 AS PRODUTO, COUNT(*) AS TOTAL
    FROM HARPIAW2.MOVIMENT_END_502 m
   WHERE m.DT_MOVIMENT_502 >= TO_DATE(:ini, 'YYYY-MM-DD') AND m.DT_MOVIMENT_502 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
     AND ${FILTRO_PISO}
   GROUP BY m.MERC_PF_502
   ORDER BY COUNT(*) DESC
) WHERE ROWNUM <= 50`;

// Convocação Ativa: solicitação→aceite→finalização de cada tarefa de
// movimentação. Tempos em minutos ((data2-data1)*1440), calculados no Oracle.
// Nome do operador resolvido até o funcionário real (USUARIO_754), com
// fallback pro nome cadastrado só na Convocação Ativa.
const SQL_CONVOCACOES = `
SELECT TO_CHAR(TRUNC(c.DT_HR_SOLICITACAO_1028), 'YYYY-MM-DD') AS DIA,
       c.OPERADOR_FK_1028 AS OPERADOR,
       NVL(u.DESCR_COMPLETO_754, op.DESCRICAO_1023) AS NOME,
       (c.DT_HR_ACEITE_1028 - c.DT_HR_SOLICITACAO_1028) * 1440 AS MIN_RESPOSTA,
       (c.DT_HR_FINALIZACAO_1028 - c.DT_HR_ACEITE_1028) * 1440 AS MIN_EXECUCAO,
       CASE WHEN c.DT_HR_FINALIZACAO_1028 IS NOT NULL THEN 1 ELSE 0 END AS FINALIZADA,
       CASE WHEN c.DT_HR_REJEICAO_1028 IS NOT NULL THEN 1 ELSE 0 END AS REJEITADA
  FROM HARPIAW2.CONV_ATIVA_CONVOCACAO_1028 c
  LEFT JOIN HARPIAW2.CONV_ATIVA_OPERADORES_1023 op ON op.OPERADOR_PK_1023 = c.OPERADOR_FK_1028 AND op.EMPRESA_PF_1023 = c.EMPRESA_PF_1028
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = op.USU_FK_1023
 WHERE c.DT_HR_SOLICITACAO_1028 >= TO_DATE(:ini, 'YYYY-MM-DD') AND c.DT_HR_SOLICITACAO_1028 < TO_DATE(:fim, 'YYYY-MM-DD') + 1`;

/** Descrição do produto pelo cadastro do Winthor (o código do Harpia costuma ser o CODPROD). */
async function descricoesProdutos(codigos: number[]): Promise<Map<number, string>> {
  const unicos = [...new Set(codigos.filter((c) => c > 0))];
  const mapa = new Map<number, string>();
  if (!unicos.length) return mapa;
  try {
    const rows = await queryWinthor<{ CODPROD: number; DESCRICAO: string }>(
      `SELECT CODPROD, DESCRICAO FROM PCPRODUT WHERE CODPROD IN (${unicos.map((_, i) => `:c${i}`).join(",")})`,
      Object.fromEntries(unicos.map((c, i) => [`c${i}`, c])),
    );
    for (const r of rows) mapa.set(num(r.CODPROD), String(r.DESCRICAO));
  } catch {
    // sem descrição; segue com o código
  }
  return mapa;
}

/** Histórico diário dos produtos do top 20 (drill-down do Giro). Vazio se não há produtos. */
async function produtosDiaDoMes(codigos: number[], binds: { ini: string; fim: string }): Promise<ProdutoGiroDia[]> {
  const unicos = [...new Set(codigos.filter((c) => c > 0))];
  if (!unicos.length) return [];
  const sql = `
SELECT m.MERC_FK_1361 AS PRODUTO, TO_CHAR(TRUNC(p.PREP_DTHR_809), 'YYYY-MM-DD') AS DIA, COUNT(*) AS QTD
  FROM HARPIAW2.PREPARA_ABAST_MERC_1361 m
  JOIN HARPIAW2.PREPARA_ABAST_809 p ON p.ID_NUM_ABAST_PK_809 = m.NUM_ABAST_FK_1361
 WHERE p.PREP_DTHR_809 >= TO_DATE(:ini, 'YYYY-MM-DD') AND p.PREP_DTHR_809 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   AND m.MERC_FK_1361 IN (${unicos.map((_, i) => `:c${i}`).join(",")})
 GROUP BY m.MERC_FK_1361, TRUNC(p.PREP_DTHR_809)`;
  const rows = await queryWinthor<{ PRODUTO: number; DIA: string; QTD: number }>(sql, {
    ...binds,
    ...Object.fromEntries(unicos.map((c, i) => [`c${i}`, c])),
  });
  return rows.map((r) => ({ produto: num(r.PRODUTO), dia: String(r.DIA), abastecimentos: num(r.QTD) }));
}

/** Lê o abastecimento do mês no Harpia. Lança erro (ex.: sem permissão) — quem chama mostra. */
export async function lerAbastecimentoHarpia(mes: string): Promise<DadosHarpiaAbastecimento> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const binds = { ini: inicio, fim };
  const [dias, prods, curvasRaw, cargas, rupturas, reativos, movTotal, movPessoasDia, movDias, movHoraDia, movProdutos, convocacoesRaw] = await Promise.all([
    queryWinthor<Record<string, unknown>>(SQL_DIAS, binds),
    queryWinthor<Record<string, unknown>>(SQL_PRODUTOS, binds),
    queryWinthor<{ CURVA: string; QTD: number; SKUS: number }>(SQL_CURVAS, binds),
    queryWinthor<{ NUMCAR: number; DIA: string; HORAS_FOLGA: number | null }>(SQL_CARGAS, binds),
    queryWinthor<{ DT: string; PRODUTO: number; CX: number; UN: number }>(SQL_RUPTURAS, binds),
    queryWinthor<{ REATIVOS: number }>(SQL_REATIVOS, binds),
    queryWinthor<{ TOTAL: number; VERTICAL: number }>(SQL_MOVIMENTO_TOTAL, binds),
    queryWinthor<{ DIA: string; USU: number; NOME: string | null; DEPTO: string | null; TOTAL: number; VERTICAL: number }>(SQL_MOVIMENTO_PESSOAS_DIA, binds),
    queryWinthor<{ DIA: string; TOTAL: number; VERTICAL: number }>(SQL_MOVIMENTO_DIAS, binds),
    queryWinthor<{ DIA: string; HORA: string; TOTAL: number }>(SQL_MOVIMENTO_HORA_DIA, binds),
    queryWinthor<{ PRODUTO: number; TOTAL: number }>(SQL_MOVIMENTO_PRODUTOS, binds),
    queryWinthor<{ DIA: string; OPERADOR: number; NOME: string | null; MIN_RESPOSTA: number | null; MIN_EXECUCAO: number | null; FINALIZADA: number; REJEITADA: number }>(SQL_CONVOCACOES, binds),
  ]);
  const [descricoes, produtosDia] = await Promise.all([
    descricoesProdutos([...prods.map((r) => num(r.PRODUTO)), ...rupturas.map((r) => r.PRODUTO), ...movProdutos.map((r) => r.PRODUTO)]),
    produtosDiaDoMes(prods.map((r) => num(r.PRODUTO)), binds),
  ]);
  const movTotalNum = num(movTotal[0]?.TOTAL);
  const movVerticalNum = num(movTotal[0]?.VERTICAL);
  return {
    dias: dias
      .map((r) => ({ dia: String(r.DIA), abastecimentos: num(r.ABASTS), caixas: num(r.CX), unidades: num(r.UN), skus: num(r.SKUS) }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
    produtos: prods.map((r) => ({
      produto: num(r.PRODUTO),
      descricao: descricoes.get(num(r.PRODUTO)) ?? null,
      curva: r.CURVA == null ? null : String(r.CURVA),
      abastecimentos: num(r.QTD),
      caixas: num(r.CX),
      unidades: num(r.UN),
    })),
    produtosDia,
    curvas: curvasRaw
      .map((r) => ({ curva: String(r.CURVA), abastecimentos: num(r.QTD), skus: num(r.SKUS) }))
      .sort((a, b) => b.abastecimentos - a.abastecimentos),
    cargas: cargas.map((r) => ({
      numcar: num(r.NUMCAR),
      dia: String(r.DIA),
      horasFolga: r.HORAS_FOLGA == null ? null : Number(r.HORAS_FOLGA),
    })),
    rupturas: rupturas.map((r) => ({
      data: String(r.DT),
      produto: num(r.PRODUTO),
      descricao: descricoes.get(num(r.PRODUTO)) ?? null,
      caixas: num(r.CX),
      unidades: num(r.UN),
    })),
    abastecimentosReativos: num(reativos[0]?.REATIVOS),
    movimentoPiso: {
      total: movTotalNum,
      vertical: movVerticalNum,
      horizontal: movTotalNum - movVerticalNum,
      dias: movDias
        .map((r) => ({ dia: String(r.DIA), total: num(r.TOTAL), vertical: num(r.VERTICAL) }))
        .sort((a, b) => a.dia.localeCompare(b.dia)),
      porPessoaDia: movPessoasDia.map((r) => ({
        dia: String(r.DIA),
        usuario: num(r.USU),
        nome: r.NOME ?? null,
        departamento: r.DEPTO ?? null,
        total: num(r.TOTAL),
        vertical: num(r.VERTICAL),
      })),
      porHoraDia: movHoraDia.map((r) => ({ dia: String(r.DIA), hora: Number(r.HORA), total: num(r.TOTAL) })),
      produtosTop: movProdutos.map((r) => ({
        produto: num(r.PRODUTO),
        descricao: descricoes.get(num(r.PRODUTO)) ?? null,
        total: num(r.TOTAL),
      })),
    },
    convocacoes: convocacoesRaw.map((r) => ({
      dia: String(r.DIA),
      operador: num(r.OPERADOR),
      nome: r.NOME ?? null,
      minutosResposta: r.MIN_RESPOSTA == null ? null : Number(r.MIN_RESPOSTA),
      minutosExecucao: r.MIN_EXECUCAO == null ? null : Number(r.MIN_EXECUCAO),
      finalizada: num(r.FINALIZADA) === 1,
      rejeitada: num(r.REJEITADA) === 1,
    })),
  };
}

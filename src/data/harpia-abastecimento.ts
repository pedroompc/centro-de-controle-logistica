import { queryWinthor } from "@/lib/oracle/client";
import { inicioFimDoMes } from "@/domain/periodo";
import { filialIn } from "./filiais";

/**
 * Abastecimento de picking no Harpia (esquema HARPIAW2, mesmo Oracle do
 * Winthor): `PREPARA_ABAST_809` (cabeçalho, quem/quando preparou — é o
 * FATURAMENTO, não quem executa), `PREPARA_ABAST_GUIAS_1360` (carregamento
 * atendido) e `PREPARA_ABAST_MERC_1361` (produto/quantidade). Rupturas de
 * picking (estoque negativo no endereço) ficam em `HIST_ABAST_NEG_848`.
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
  abastecimentos: number;
  caixas: number;
  unidades: number;
}

export interface CargaAntecedencia {
  numcar: number;
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

export interface MovimentoEndereco {
  total: number;
  vertical: number; // mudou de nível (altura) no rack
  horizontal: number; // mesmo nível, outra posição
}

export interface DadosHarpiaAbastecimento {
  dias: DiaAbastecimento[];
  produtos: ProdutoGiro[];
  cargas: CargaAntecedencia[];
  rupturas: RupturaAbastecimento[];
  /** Vertical/horizontal só é registrado pela rotina 3411 (transferência manual de endereço) — a maioria dos abastecimentos não passa por ela. */
  movimento: MovimentoEndereco;
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
const SQL_PRODUTOS = `
SELECT * FROM (
  SELECT m.MERC_FK_1361 AS PRODUTO, COUNT(*) AS QTD, SUM(m.QTD_SEP_CX_1361) AS CX, SUM(m.QTD_SEP_UN_1361) AS UN
    FROM HARPIAW2.PREPARA_ABAST_MERC_1361 m
    JOIN HARPIAW2.PREPARA_ABAST_809 p ON p.ID_NUM_ABAST_PK_809 = m.NUM_ABAST_FK_1361
   WHERE p.PREP_DTHR_809 >= TO_DATE(:ini, 'YYYY-MM-DD') AND p.PREP_DTHR_809 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   GROUP BY m.MERC_FK_1361
   ORDER BY COUNT(*) DESC
) WHERE ROWNUM <= 20`;

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
SELECT a.NUMCAR, (s.DT_SEP - a.DT_ABAST) * 24 AS HORAS_FOLGA
  FROM abast a
  LEFT JOIN sep s ON s.NUMCAR = a.NUMCAR`;

// Movimentação de endereço: só a rotina 3411 (transferência manual) grava
// origem/destino — a maioria dos abastecimentos não passa por ela (ver nota
// em MovimentoEndereco). Endereço = RUA(2)+PREDIO(2)+NIVEL(2)+APTO(3);
// nível em SUBSTR(col,5,2), validado contra a faixa real de uso (00-05).
const SQL_MOVIMENTO = `
SELECT COUNT(*) AS TOTAL,
       SUM(CASE WHEN SUBSTR(END_PF_502, 5, 2) <> SUBSTR(END_DESTINO_FK_502, 5, 2) THEN 1 ELSE 0 END) AS VERTICAL
  FROM HARPIAW2.MOVIMENT_END_502
 WHERE NUM_ABAST_FK_502 IS NOT NULL
   AND DT_MOVIMENT_502 >= TO_DATE(:ini, 'YYYY-MM-DD') AND DT_MOVIMENT_502 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   AND LENGTH(END_PF_502) = 9 AND LENGTH(END_DESTINO_FK_502) = 9`;

const SQL_RUPTURAS = `
SELECT TO_CHAR(h.DT_HIST_PK_848, 'YYYY-MM-DD HH24:MI') AS DT, h.MERC_PF_848 AS PRODUTO,
       h.TOTAL_CX_848 AS CX, h.TOTAL_UN_848 AS UN
  FROM HARPIAW2.HIST_ABAST_NEG_848 h
 WHERE h.DT_HIST_PK_848 >= TO_DATE(:ini, 'YYYY-MM-DD') AND h.DT_HIST_PK_848 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
 ORDER BY h.DT_HIST_PK_848 DESC`;

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

/** Lê o abastecimento do mês no Harpia. Lança erro (ex.: sem permissão) — quem chama mostra. */
export async function lerAbastecimentoHarpia(mes: string): Promise<DadosHarpiaAbastecimento> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const binds = { ini: inicio, fim };
  const [dias, prods, cargas, rupturas, movimento] = await Promise.all([
    queryWinthor<Record<string, unknown>>(SQL_DIAS, binds),
    queryWinthor<Record<string, unknown>>(SQL_PRODUTOS, binds),
    queryWinthor<{ NUMCAR: number; HORAS_FOLGA: number | null }>(SQL_CARGAS, binds),
    queryWinthor<{ DT: string; PRODUTO: number; CX: number; UN: number }>(SQL_RUPTURAS, binds),
    queryWinthor<{ TOTAL: number; VERTICAL: number }>(SQL_MOVIMENTO, binds),
  ]);
  const descricoes = await descricoesProdutos([...prods.map((r) => num(r.PRODUTO)), ...rupturas.map((r) => r.PRODUTO)]);
  return {
    dias: dias
      .map((r) => ({ dia: String(r.DIA), abastecimentos: num(r.ABASTS), caixas: num(r.CX), unidades: num(r.UN), skus: num(r.SKUS) }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
    produtos: prods.map((r) => ({
      produto: num(r.PRODUTO),
      descricao: descricoes.get(num(r.PRODUTO)) ?? null,
      abastecimentos: num(r.QTD),
      caixas: num(r.CX),
      unidades: num(r.UN),
    })),
    cargas: cargas.map((r) => ({
      numcar: num(r.NUMCAR),
      horasFolga: r.HORAS_FOLGA == null ? null : Number(r.HORAS_FOLGA),
    })),
    rupturas: rupturas.map((r) => ({
      data: String(r.DT),
      produto: num(r.PRODUTO),
      descricao: descricoes.get(num(r.PRODUTO)) ?? null,
      caixas: num(r.CX),
      unidades: num(r.UN),
    })),
    movimento: {
      total: num(movimento[0]?.TOTAL),
      vertical: num(movimento[0]?.VERTICAL),
      horizontal: num(movimento[0]?.TOTAL) - num(movimento[0]?.VERTICAL),
    },
  };
}

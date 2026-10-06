import { queryWinthor } from "@/lib/oracle/client";
import { inicioFimDoMes } from "@/domain/periodo";

/**
 * Separação no Harpia (WMS, esquema HARPIAW2 no mesmo Oracle do Winthor).
 *
 * Sem coletor, o Harpia não sabe QUEM separou nem em quanto tempo. O que ele
 * grava, item a item, é a CONFERÊNCIA do mapa (`PLAN_SEP_MAPA_AVERIG_1197`):
 * quem conferiu, quando e quantas caixas/unidades. Tudo que foi conferido foi
 * separado — então a conferência é a medida da produção do dia. E a
 * divergência que trava a conferência (bipado ≠ carga) fica em
 * `PLAN_SEP_MAPA_MERC_ERRO_1199`: é o erro de separação pego na doca.
 */

export interface DiaSeparacao {
  dia: string; // "yyyy-mm-dd"
  caixas: number;
  unidades: number; // total em unidades (caixas convertidas + avulsas)
  itens: number; // linhas conferidas (produto × pedido)
  pedidos: number;
  clientes: number;
  mapas: number;
}

export interface ConferenteDia {
  dia: string;
  usuario: number; // id do usuário no Harpia
  caixas: number;
  unidades: number;
  itens: number;
  pedidos: number;
  horas: number; // da 1ª à última conferência do dia (aproximação do tempo conferindo)
}

export interface ErroDia {
  dia: string;
  erros: number;
  unidadesDivergentes: number;
}

export interface ErroProduto {
  produto: number; // código da mercadoria no Harpia
  descricao: string | null;
  erros: number;
  unidadesDivergentes: number;
}

export interface DadosHarpiaSeparacao {
  dias: DiaSeparacao[];
  conferentes: ConferenteDia[];
  erros: ErroDia[];
  produtosComErro: ErroProduto[];
}

const AVERIG = "HARPIAW2.PLAN_SEP_MAPA_AVERIG_1197";
const ERRO = "HARPIAW2.PLAN_SEP_MAPA_MERC_ERRO_1199";
// Intervalo do mês: [ini, fim+1) para pegar o último dia inteiro.
const JANELA = (col: string) => `${col} >= TO_DATE(:ini, 'YYYY-MM-DD') AND ${col} < TO_DATE(:fim, 'YYYY-MM-DD') + 1`;

const SQL_DIAS = `
SELECT TO_CHAR(TRUNC(a.DTHR_AVERIG_1197), 'YYYY-MM-DD') AS DIA,
       SUM(NVL(a.QTD_AVERIG_CX_1197, 0)) AS CX,
       SUM(NVL(a.QTD_AVERIG_TOTAL_UN_1197, 0)) AS UN,
       COUNT(*) AS ITENS,
       COUNT(DISTINCT a.NUM_PEDCONF_FK_1197) AS PEDIDOS,
       COUNT(DISTINCT NULLIF(a.CLI_FK_1197, 0)) AS CLIENTES,
       COUNT(DISTINCT a.SEQ_PLANILHA_PF_1197) AS MAPAS
  FROM ${AVERIG} a
 WHERE ${JANELA("a.DTHR_AVERIG_1197")}
 GROUP BY TRUNC(a.DTHR_AVERIG_1197)`;

const SQL_CONFERENTES = `
SELECT TO_CHAR(TRUNC(a.DTHR_AVERIG_1197), 'YYYY-MM-DD') AS DIA,
       a.USU_AVERIG_1197 AS USU,
       SUM(NVL(a.QTD_AVERIG_CX_1197, 0)) AS CX,
       SUM(NVL(a.QTD_AVERIG_TOTAL_UN_1197, 0)) AS UN,
       COUNT(*) AS ITENS,
       COUNT(DISTINCT a.NUM_PEDCONF_FK_1197) AS PEDIDOS,
       (MAX(a.DTHR_AVERIG_1197) - MIN(a.DTHR_AVERIG_1197)) * 24 AS HORAS
  FROM ${AVERIG} a
 WHERE ${JANELA("a.DTHR_AVERIG_1197")}
 GROUP BY TRUNC(a.DTHR_AVERIG_1197), a.USU_AVERIG_1197`;

const SQL_ERROS = `
SELECT TO_CHAR(TRUNC(e.DT_HR_BLOQUEIO_1199), 'YYYY-MM-DD') AS DIA,
       COUNT(*) AS ERROS,
       SUM(ABS(NVL(e.QTD_CARGA_UN_1199, 0) - NVL(e.QTD_BIPADA_UN_1199, 0))) AS DIF
  FROM ${ERRO} e
 WHERE ${JANELA("e.DT_HR_BLOQUEIO_1199")}
 GROUP BY TRUNC(e.DT_HR_BLOQUEIO_1199)`;

// ROWNUM (e não FETCH FIRST) para funcionar também em Oracle anterior ao 12c.
const SQL_PRODUTOS = `
SELECT * FROM (
  SELECT e.MERC_PF_1199 AS PRODUTO,
         COUNT(*) AS ERROS,
         SUM(ABS(NVL(e.QTD_CARGA_UN_1199, 0) - NVL(e.QTD_BIPADA_UN_1199, 0))) AS DIF
    FROM ${ERRO} e
   WHERE ${JANELA("e.DT_HR_BLOQUEIO_1199")}
   GROUP BY e.MERC_PF_1199
   ORDER BY COUNT(*) DESC
) WHERE ROWNUM <= 15`;

const num = (v: unknown) => Number(v) || 0;

/** Lê a separação do mês no Harpia. Lança erro (ex.: sem permissão) — quem chama mostra. */
export async function lerSeparacaoHarpia(mes: string): Promise<DadosHarpiaSeparacao> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const binds = { ini: inicio, fim };
  const [dias, conf, erros, prods] = await Promise.all([
    queryWinthor<Record<string, unknown>>(SQL_DIAS, binds),
    queryWinthor<Record<string, unknown>>(SQL_CONFERENTES, binds),
    queryWinthor<Record<string, unknown>>(SQL_ERROS, binds),
    queryWinthor<Record<string, unknown>>(SQL_PRODUTOS, binds),
  ]);
  // Descrição dos produtos com erro: tenta o cadastro do Winthor (o código do
  // Harpia costuma ser o CODPROD). Se não bater, fica só o código.
  const codigos = prods.map((r) => num(r.PRODUTO)).filter((c) => c > 0);
  const descricoes = new Map<number, string>();
  if (codigos.length) {
    try {
      const rows = await queryWinthor<{ CODPROD: number; DESCRICAO: string }>(
        `SELECT CODPROD, DESCRICAO FROM PCPRODUT WHERE CODPROD IN (${codigos.map((_, i) => `:c${i}`).join(",")})`,
        Object.fromEntries(codigos.map((c, i) => [`c${i}`, c])),
      );
      for (const r of rows) descricoes.set(num(r.CODPROD), String(r.DESCRICAO));
    } catch {
      // sem descrição; segue com o código
    }
  }
  return {
    dias: dias
      .map((r) => ({
        dia: String(r.DIA),
        caixas: num(r.CX),
        unidades: num(r.UN),
        itens: num(r.ITENS),
        pedidos: num(r.PEDIDOS),
        clientes: num(r.CLIENTES),
        mapas: num(r.MAPAS),
      }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
    conferentes: conf.map((r) => ({
      dia: String(r.DIA),
      usuario: num(r.USU),
      caixas: num(r.CX),
      unidades: num(r.UN),
      itens: num(r.ITENS),
      pedidos: num(r.PEDIDOS),
      horas: num(r.HORAS),
    })),
    erros: erros.map((r) => ({ dia: String(r.DIA), erros: num(r.ERROS), unidadesDivergentes: num(r.DIF) })),
    produtosComErro: prods.map((r) => ({
      produto: num(r.PRODUTO),
      descricao: descricoes.get(num(r.PRODUTO)) ?? null,
      erros: num(r.ERROS),
      unidadesDivergentes: num(r.DIF),
    })),
  };
}

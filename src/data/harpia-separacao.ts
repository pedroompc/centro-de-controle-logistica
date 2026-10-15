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
  nome: string | null; // nome do usuário no Harpia (USUARIO_754), não do cadastro
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

/** Erro atribuído a quem conferiu o item (mapa + pedido + produto) — dá o turno. */
export interface ErroConferenteDia {
  dia: string;
  usuario: number;
  erros: number;
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
  errosPorConferente: ErroConferenteDia[];
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
       MAX(u.DESCR_COMPLETO_754) AS NOME,
       SUM(NVL(a.QTD_AVERIG_CX_1197, 0)) AS CX,
       SUM(NVL(a.QTD_AVERIG_TOTAL_UN_1197, 0)) AS UN,
       COUNT(*) AS ITENS,
       COUNT(DISTINCT a.NUM_PEDCONF_FK_1197) AS PEDIDOS,
       (MAX(a.DTHR_AVERIG_1197) - MIN(a.DTHR_AVERIG_1197)) * 24 AS HORAS
  FROM ${AVERIG} a
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = a.USU_AVERIG_1197
 WHERE ${JANELA("a.DTHR_AVERIG_1197")}
 GROUP BY TRUNC(a.DTHR_AVERIG_1197), a.USU_AVERIG_1197`;

// O erro não grava usuário; o conferente é quem conferiu o mesmo item (mapa +
// pedido + produto). ~99,8% casam; item com 2+ conferentes fica com um deles.
// A conferência começa antes do bloqueio, daí a janela 7 dias mais cedo.
const SQL_ERROS_CONFERENTE = `
SELECT TO_CHAR(TRUNC(e.DT_HR_BLOQUEIO_1199), 'YYYY-MM-DD') AS DIA, x.USU, COUNT(*) AS ERROS
  FROM ${ERRO} e
  JOIN (SELECT EMPRESA_PF_1197 AS EMP, SEQ_PLANILHA_PF_1197 AS SEQ, MERC_PF_1197 AS MERC,
               NUM_PEDCONF_FK_1197 AS PED, MAX(USU_AVERIG_1197) AS USU
          FROM ${AVERIG}
         WHERE DTHR_AVERIG_1197 >= TO_DATE(:ini, 'YYYY-MM-DD') - 7 AND DTHR_AVERIG_1197 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
         GROUP BY EMPRESA_PF_1197, SEQ_PLANILHA_PF_1197, MERC_PF_1197, NUM_PEDCONF_FK_1197) x
    ON x.EMP = e.EMPRESA_PF_1199 AND x.SEQ = e.SEQ_PLANILHA_PF_1199
   AND x.MERC = e.MERC_PF_1199 AND x.PED = e.NUM_PEDCONF_FK_1199
 WHERE ${JANELA("e.DT_HR_BLOQUEIO_1199")}
 GROUP BY TRUNC(e.DT_HR_BLOQUEIO_1199), x.USU`;

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
  const [dias, conf, erros, prods, errosConf] = await Promise.all([
    queryWinthor<Record<string, unknown>>(SQL_DIAS, binds),
    queryWinthor<Record<string, unknown>>(SQL_CONFERENTES, binds),
    queryWinthor<Record<string, unknown>>(SQL_ERROS, binds),
    queryWinthor<Record<string, unknown>>(SQL_PRODUTOS, binds),
    queryWinthor<Record<string, unknown>>(SQL_ERROS_CONFERENTE, binds),
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
      nome: r.NOME == null ? null : String(r.NOME),
      caixas: num(r.CX),
      unidades: num(r.UN),
      itens: num(r.ITENS),
      pedidos: num(r.PEDIDOS),
      horas: num(r.HORAS),
    })),
    erros: erros.map((r) => ({ dia: String(r.DIA), erros: num(r.ERROS), unidadesDivergentes: num(r.DIF) })),
    errosPorConferente: errosConf.map((r) => ({ dia: String(r.DIA), usuario: num(r.USU), erros: num(r.ERROS) })),
    produtosComErro: prods.map((r) => ({
      produto: num(r.PRODUTO),
      descricao: descricoes.get(num(r.PRODUTO)) ?? null,
      erros: num(r.ERROS),
      unidadesDivergentes: num(r.DIF),
    })),
  };
}

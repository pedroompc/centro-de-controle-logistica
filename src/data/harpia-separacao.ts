import { queryWinthor } from "@/lib/oracle/client";
import { inicioFimDoMes } from "@/domain/periodo";
import { CORTE_DIA_OPERACIONAL as C, sqlDiaOperacional, sqlJanelaOperacional, sqlTurnoDaHora, type TurnoSep } from "@/domain/turnos-separacao";
import type { DiaSep, ErroSep, LinhaSep, MapaSep, PaginaSep, ProdutoTurnoSep } from "@/domain/separacao";

/**
 * Separação no Harpia (WMS, esquema HARPIAW2 no mesmo Oracle do Winthor).
 * Fórmulas e consultas de validação: docs/bi-separacao/indicadores.md.
 *
 * O MAPA entra no dia operacional da sua 1ª conferência (− 07h): de dia o mapa
 * é conferido logo que a separação termina; à noite, separação e conferência
 * acontecem na mesma madrugada. Fontes:
 * - linhas: PLAN_SEP_MAPA_MERC_1196 — cada linha é um ENDEREÇO VISITADO (como a
 *   operação chama): mapa × página × endereço (PORTA_PALLET) é único na tabela
 * - separador: PLAN_SEP_MAPA_PAGINA_OS_1236 (quem separou cada página, início/fim)
 *   — só parte das páginas tem nome (a noite não registra); o resto fica sem separador
 * - pedidos/clientes: PLAN_SEP_MAPA_GUIAS_1198; carga: PLAN_SEP_MAPA_1195
 * - erro: PLAN_SEP_MAPA_MERC_ERRO_1199 (ORIGEM_ERRO S = separador, C = conferente)
 * - peso: unidades × PCPRODUT.PESOBRUTO (o Harpia não pesa)
 */

const AVERIG = "HARPIAW2.PLAN_SEP_MAPA_AVERIG_1197";
const MERC = "HARPIAW2.PLAN_SEP_MAPA_MERC_1196";
const PAGINA = "HARPIAW2.PLAN_SEP_MAPA_PAGINA_OS_1236";
const GUIAS = "HARPIAW2.PLAN_SEP_MAPA_GUIAS_1198";
const MAPA = "HARPIAW2.PLAN_SEP_MAPA_1195";
const ERRO = "HARPIAW2.PLAN_SEP_MAPA_MERC_ERRO_1199";

// Mapas do período: 1ª conferência dentro dos dias operacionais [:ini, :fim].
// Lê 7 dias antes para o MIN não pegar um mapa que começou antes da janela
// (há mapa com conferência de mais de 24h; o script de validação checa > 7 dias).
const CTE_MAPA = `
mapa AS (
  SELECT a.SEQ_PLANILHA_PF_1197 AS MAPA, MIN(a.DTHR_AVERIG_1197) AS CONF_INI
    FROM ${AVERIG} a
   WHERE a.DTHR_AVERIG_1197 >= TO_DATE(:ini, 'YYYY-MM-DD') + ${C}/24 - 7
     AND a.DTHR_AVERIG_1197 < TO_DATE(:fim, 'YYYY-MM-DD') + 1 + ${C}/24
   GROUP BY a.SEQ_PLANILHA_PF_1197
  HAVING ${sqlJanelaOperacional("MIN(a.DTHR_AVERIG_1197)")}
)`;

const DIA = `TO_CHAR(${sqlDiaOperacional("mp.CONF_INI")}, 'YYYY-MM-DD')`;
const UNIDADES = `(NVL(x.QTD_FATURADA_CX_1196, 0) * NVL(pr.QTUNITCX, 1) + NVL(x.QTD_FATURADA_UN_1196, 0))`;
// Página com separador: chave (mapa, nº da OS da página) é única na 1236.
const JOIN_PAGINA = `LEFT JOIN ${PAGINA} pg ON pg.SEQ_PLANILHA_PF_1236 = x.SEQ_PLANILHA_PF_1196 AND pg.N_OS_PAGINA_1236 = x.N_OS_PAGINA_1196 AND pg.USU_SEP_FK_1236 IS NOT NULL`;
const HORA_REF = `TO_NUMBER(TO_CHAR(NVL(pg.DT_HR_INI_SEP_1236, mp.CONF_INI), 'HH24'))`;

export const SQL_LINHAS = `
WITH ${CTE_MAPA}
SELECT mp.MAPA, ${DIA} AS DIA, pg.USU_SEP_FK_1236 AS USU, ${HORA_REF} AS HORA,
       COUNT(*) AS LINHAS,
       SUM(NVL(x.QTD_FATURADA_CX_1196, 0)) AS CX,
       SUM(${UNIDADES}) AS UN,
       SUM(${UNIDADES} * NVL(pr.PESOBRUTO, 0)) AS KG
  FROM mapa mp
  JOIN ${MERC} x ON x.SEQ_PLANILHA_PF_1196 = mp.MAPA
  ${JOIN_PAGINA}
  LEFT JOIN PCPRODUT pr ON pr.CODPROD = x.MERC_PF_1196
 GROUP BY mp.MAPA, ${sqlDiaOperacional("mp.CONF_INI")}, pg.USU_SEP_FK_1236, ${HORA_REF}`;

export const SQL_MAPAS = `
WITH ${CTE_MAPA}
SELECT mp.MAPA, ${DIA} AS DIA, MAX(m.TIPO_SEPARACAO_1195) AS TIPO,
       COUNT(DISTINCT g.NUM_PEDCONF_FK_1198) AS PEDIDOS,
       COUNT(DISTINCT NULLIF(g.CLI_FK_1198, 0)) AS CLIENTES
  FROM mapa mp
  JOIN ${MAPA} m ON m.SEQ_PLANILHA_PK_1195 = mp.MAPA
  LEFT JOIN ${GUIAS} g ON g.SEQ_PLANILHA_PF_1198 = mp.MAPA
 GROUP BY mp.MAPA, ${sqlDiaOperacional("mp.CONF_INI")}`;

// Distintos por dia e no mês (linha com DIA nulo = total do mês).
// Carga de venda balcão (mapa tipo 3) é carga de sistema, não carregamento: fica fora.
export const SQL_DIAS = `
WITH ${CTE_MAPA}
SELECT CASE WHEN GROUPING(${sqlDiaOperacional("mp.CONF_INI")}) = 1 THEN NULL ELSE ${DIA} END AS DIA,
       COUNT(DISTINCT g.NUM_PEDCONF_FK_1198) AS PEDIDOS,
       COUNT(DISTINCT NULLIF(g.CLI_FK_1198, 0)) AS CLIENTES,
       COUNT(DISTINCT CASE WHEN m.TIPO_SEPARACAO_1195 <> 3 THEN m.CARGA_1195 END) AS CARGAS,
       COUNT(DISTINCT mp.MAPA) AS MAPAS
  FROM mapa mp
  JOIN ${MAPA} m ON m.SEQ_PLANILHA_PK_1195 = mp.MAPA
  LEFT JOIN ${GUIAS} g ON g.SEQ_PLANILHA_PF_1198 = mp.MAPA
 GROUP BY GROUPING SETS ((${sqlDiaOperacional("mp.CONF_INI")}), ())`;

export const SQL_SKUS = `
WITH ${CTE_MAPA}
SELECT COUNT(DISTINCT x.MERC_PF_1196) AS SKUS
  FROM mapa mp JOIN ${MERC} x ON x.SEQ_PLANILHA_PF_1196 = mp.MAPA`;

// Produto distinto por (dia, separador, turno pela hora): o servidor resolve o
// turno (cadastro do separador vence a hora) e conta os SKUs de cada dia × turno.
export const SQL_PRODUTOS_TURNO = `
WITH ${CTE_MAPA}
SELECT DISTINCT ${DIA} AS DIA, pg.USU_SEP_FK_1236 AS USU, ${sqlTurnoDaHora(HORA_REF)} AS TURNO, x.MERC_PF_1196 AS PRODUTO
  FROM mapa mp
  JOIN ${MERC} x ON x.SEQ_PLANILHA_PF_1196 = mp.MAPA
  ${JOIN_PAGINA}`;

// Erro → linha (mapa × produto × pedido) → página → separador. Só atribui
// quando TODAS as linhas da chave são do mesmo separador registrado.
export const SQL_ERROS = `
WITH ${CTE_MAPA},
lin AS (
  SELECT x.SEQ_PLANILHA_PF_1196 AS MAPA, x.MERC_PF_1196 AS MERC, x.NUM_PEDCONF_FK_1196 AS PED,
         COUNT(*) AS N, COUNT(pg.USU_SEP_FK_1236) AS NU,
         MIN(pg.USU_SEP_FK_1236) AS U1, MAX(pg.USU_SEP_FK_1236) AS U2, MIN(pg.DT_HR_INI_SEP_1236) AS PINI
    FROM mapa mp
    JOIN ${MERC} x ON x.SEQ_PLANILHA_PF_1196 = mp.MAPA
    ${JOIN_PAGINA}
   GROUP BY x.SEQ_PLANILHA_PF_1196, x.MERC_PF_1196, x.NUM_PEDCONF_FK_1196
), item AS (
  -- 1 linha por item (mapa × produto × pedido) e origem: assim o item com
  -- bloqueio de falta E de sobra conta 1 vez nos itens.
  SELECT e.SEQ_PLANILHA_PF_1199 AS MAPA, e.MERC_PF_1199 AS MERC, e.NUM_PEDCONF_FK_1199 AS PED,
         CASE e.ORIGEM_ERRO_1199 WHEN 'S' THEN 'separador' WHEN 'C' THEN 'conferente' ELSE 'sem_origem' END AS ORIGEM,
         COUNT(*) AS OCORR,
         SUM(CASE WHEN NVL(e.QTD_CARGA_UN_1199, 0) > NVL(e.QTD_BIPADA_UN_1199, 0) THEN 1 ELSE 0 END) AS FALTA,
         SUM(CASE WHEN NVL(e.QTD_CARGA_UN_1199, 0) < NVL(e.QTD_BIPADA_UN_1199, 0) THEN 1 ELSE 0 END) AS SOBRA,
         SUM(ABS(NVL(e.QTD_CARGA_UN_1199, 0) - NVL(e.QTD_BIPADA_UN_1199, 0))) AS UN
    FROM ${ERRO} e
   WHERE e.SEQ_PLANILHA_PF_1199 IN (SELECT MAPA FROM mapa)
   GROUP BY e.SEQ_PLANILHA_PF_1199, e.MERC_PF_1199, e.NUM_PEDCONF_FK_1199,
            CASE e.ORIGEM_ERRO_1199 WHEN 'S' THEN 'separador' WHEN 'C' THEN 'conferente' ELSE 'sem_origem' END
), e AS (
  SELECT i.*, mp.CONF_INI,
         CASE WHEN l.N = l.NU AND l.U1 = l.U2 THEN l.U1 END AS USU,
         CASE WHEN l.N = l.NU AND l.U1 = l.U2 THEN l.PINI ELSE mp.CONF_INI END AS REF
    FROM item i
    JOIN mapa mp ON mp.MAPA = i.MAPA
    LEFT JOIN lin l ON l.MAPA = i.MAPA AND l.MERC = i.MERC AND l.PED = i.PED
)
SELECT e.MAPA, TO_CHAR(${sqlDiaOperacional("e.CONF_INI")}, 'YYYY-MM-DD') AS DIA,
       e.USU, TO_NUMBER(TO_CHAR(e.REF, 'HH24')) AS HORA, e.ORIGEM,
       SUM(e.OCORR) AS OCORR, COUNT(*) AS ITENS, SUM(e.UN) AS UN, SUM(e.FALTA) AS FALTA, SUM(e.SOBRA) AS SOBRA
  FROM e
 GROUP BY e.MAPA, ${sqlDiaOperacional("e.CONF_INI")}, e.USU, TO_NUMBER(TO_CHAR(e.REF, 'HH24')), e.ORIGEM`;

// ROWNUM (e não FETCH FIRST): o Oracle de produção não aceita a sintaxe ANSI.
const SQL_PRODUTOS = `
WITH ${CTE_MAPA}
SELECT * FROM (
  SELECT e.MERC_PF_1199 AS PRODUTO, COUNT(*) AS OCORR,
         COUNT(DISTINCT e.SEQ_PLANILHA_PF_1199 || '-' || e.NUM_PEDCONF_FK_1199) AS ITENS,
         SUM(ABS(NVL(e.QTD_CARGA_UN_1199, 0) - NVL(e.QTD_BIPADA_UN_1199, 0))) AS UN
    FROM ${ERRO} e JOIN mapa mp ON mp.MAPA = e.SEQ_PLANILHA_PF_1199
   WHERE e.ORIGEM_ERRO_1199 = 'S'
   GROUP BY e.MERC_PF_1199
   ORDER BY COUNT(*) DESC
) WHERE ROWNUM <= 15`;

// Endereços (PORTA_PALLET = rua·prédio·nível·apto, 2+2+2+3 dígitos, mesmos graus da
// DEPOSIT_EMPRESA_END_179) × produto, pelas visitas no mês: os 10 mais e os 10 menos visitados.
const SQL_ENDERECOS = `
WITH ${CTE_MAPA},
e AS (
  SELECT x.PORTA_PALLET_1196 AS ENDERECO, x.MERC_PF_1196 AS PRODUTO, COUNT(*) AS VISITAS,
         SUM(NVL(x.QTD_FATURADA_CX_1196, 0)) AS CX, SUM(${UNIDADES}) AS UN
    FROM mapa mp
    JOIN ${MERC} x ON x.SEQ_PLANILHA_PF_1196 = mp.MAPA
    LEFT JOIN PCPRODUT pr ON pr.CODPROD = x.MERC_PF_1196
   GROUP BY x.PORTA_PALLET_1196, x.MERC_PF_1196
), r AS (
  SELECT e.*, ROW_NUMBER() OVER (ORDER BY e.VISITAS DESC, e.UN DESC, e.ENDERECO) AS RM,
         ROW_NUMBER() OVER (ORDER BY e.VISITAS, e.UN, e.ENDERECO) AS RN,
         COUNT(*) OVER () AS TOTAL, COUNT(CASE WHEN e.VISITAS = 1 THEN 1 END) OVER () AS UMA
    FROM e
)
SELECT * FROM r WHERE RM <= 10 OR RN <= 10`;

// Páginas com separador dos mapas do período (intervalos em ms, horário local).
const SQL_PAGINAS = `
WITH ${CTE_MAPA}
SELECT pg.USU_SEP_FK_1236 AS USU, TO_CHAR(${sqlDiaOperacional("pg.DT_HR_INI_SEP_1236")}, 'YYYY-MM-DD') AS DIA,
       (pg.DT_HR_INI_SEP_1236 - DATE '1970-01-01') * 86400000 AS INI,
       (pg.DT_HR_FIM_SEP_1236 - DATE '1970-01-01') * 86400000 AS FIM
  FROM mapa mp
  JOIN ${PAGINA} pg ON pg.SEQ_PLANILHA_PF_1236 = mp.MAPA
 WHERE pg.USU_SEP_FK_1236 IS NOT NULL AND pg.DT_HR_INI_SEP_1236 IS NOT NULL AND pg.DT_HR_FIM_SEP_1236 IS NOT NULL`;

// Conferência por conferente e dia operacional (horas = 1ª à última bipagem do dia).
const SQL_CONFERENTES = `
SELECT TO_CHAR(${sqlDiaOperacional("a.DTHR_AVERIG_1197")}, 'YYYY-MM-DD') AS DIA,
       a.USU_AVERIG_1197 AS USU,
       MAX(u.DESCR_COMPLETO_754) AS NOME,
       COUNT(*) AS BIPAGENS,
       SUM(NVL(a.QTD_AVERIG_TOTAL_UN_1197, 0)) AS UN,
       COUNT(DISTINCT a.SEQ_PLANILHA_PF_1197) AS MAPAS,
       (MAX(a.DTHR_AVERIG_1197) - MIN(a.DTHR_AVERIG_1197)) * 24 AS HORAS
  FROM ${AVERIG} a
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = a.USU_AVERIG_1197
 WHERE ${sqlJanelaOperacional("a.DTHR_AVERIG_1197")}
 GROUP BY ${sqlDiaOperacional("a.DTHR_AVERIG_1197")}, a.USU_AVERIG_1197`;

const SQL_NOMES = (n: number) =>
  `SELECT USU_PK_754 AS USU, DESCR_COMPLETO_754 AS NOME FROM HARPIAW2.USUARIO_754 WHERE USU_PK_754 IN (${Array.from({ length: n }, (_, i) => `:u${i}`).join(",")})`;

// Mês a mês (dia operacional), do início do histórico ao mês na tela.
const SQL_MESES = `
WITH ${CTE_MAPA},
lin AS (
  SELECT mp.MAPA, TRUNC(${sqlDiaOperacional("mp.CONF_INI")}, 'MM') AS MES, ${sqlDiaOperacional("mp.CONF_INI")} AS DIA,
         COUNT(*) AS LINHAS, SUM(${UNIDADES} * NVL(pr.PESOBRUTO, 0)) AS KG
    FROM mapa mp JOIN ${MERC} x ON x.SEQ_PLANILHA_PF_1196 = mp.MAPA
    LEFT JOIN PCPRODUT pr ON pr.CODPROD = x.MERC_PF_1196
   GROUP BY mp.MAPA, TRUNC(${sqlDiaOperacional("mp.CONF_INI")}, 'MM'), ${sqlDiaOperacional("mp.CONF_INI")}
), ped AS (
  SELECT g.SEQ_PLANILHA_PF_1198 AS MAPA, COUNT(DISTINCT g.NUM_PEDCONF_FK_1198) AS PEDIDOS
    FROM ${GUIAS} g WHERE g.SEQ_PLANILHA_PF_1198 IN (SELECT MAPA FROM mapa) GROUP BY g.SEQ_PLANILHA_PF_1198
)
SELECT TO_CHAR(lin.MES, 'YYYY-MM-DD') AS MES, SUM(lin.LINHAS) AS LINHAS, SUM(lin.KG) AS KG,
       SUM(NVL(ped.PEDIDOS, 0)) AS PEDIDOS, COUNT(DISTINCT lin.DIA) AS DIAS
  FROM lin LEFT JOIN ped ON ped.MAPA = lin.MAPA
 GROUP BY lin.MES`;

const num = (v: unknown) => Number(v) || 0;
const usu = (v: unknown) => (v == null ? null : num(v));

export interface ConferenteDia {
  dia: string;
  usuario: number;
  nome: string | null;
  bipagens: number;
  unidades: number;
  mapas: number;
  horas: number;
}

export interface ProdutoErro {
  produto: number;
  descricao: string | null;
  ocorrencias: number;
  itens: number;
  unidades: number;
}

export interface EnderecoVisitado {
  endereco: string; // "09.02.00.101"
  produto: number;
  descricao: string | null;
  visitas: number;
  caixas: number;
  unidades: number;
}

export interface MesProducao {
  mes: string;
  linhas: number;
  kg: number;
  pedidos: number;
  dias: number;
}

/** Produção agregada do mês — sem nada que identifique pessoa além do id do separador (o servidor agrega antes de mandar à tela). */
export interface DadosHarpiaSeparacao {
  linhas: LinhaSep[];
  mapas: MapaSep[];
  dias: DiaSep[];
  totalMes: { pedidos: number; clientes: number; cargas: number; mapas: number; skus: number };
  erros: ErroSep[];
  produtosComErro: ProdutoErro[];
  produtosTurno: ProdutoTurnoSep[];
  /** Endereço × produto no mês: total, quantos com 1 visita só e as duas pontas. */
  enderecos: { total: number; umaVisita: number; mais: EnderecoVisitado[]; menos: EnderecoVisitado[] };
  /** Separadores com página registrada e o nome no Harpia — SÓ para o servidor resolver o turno. */
  usuarios: { usuario: number; nome: string | null }[];
}

/** Só para admin: o que identifica e mede cada pessoa. */
export interface DadosIndividuaisHarpia {
  paginas: PaginaSep[];
  conferentes: ConferenteDia[];
}

const bindsDoMes = (mes: string) => {
  const { inicio, fim } = inicioFimDoMes(mes);
  return { ini: inicio, fim };
};

/** Produção, pedidos e erros do mês no Harpia. Lança erro (sem acesso, rede) — quem chama mostra. */
export async function lerSeparacaoHarpia(mes: string): Promise<DadosHarpiaSeparacao> {
  const binds = bindsDoMes(mes);
  const [lin, maps, dias, skus, erros, prods, ends, prodTurno] = await Promise.all([
    queryWinthor<Record<string, unknown>>(SQL_LINHAS, binds),
    queryWinthor<Record<string, unknown>>(SQL_MAPAS, binds),
    queryWinthor<Record<string, unknown>>(SQL_DIAS, binds),
    queryWinthor<Record<string, unknown>>(SQL_SKUS, binds),
    queryWinthor<Record<string, unknown>>(SQL_ERROS, binds),
    queryWinthor<Record<string, unknown>>(SQL_PRODUTOS, binds),
    queryWinthor<Record<string, unknown>>(SQL_ENDERECOS, binds),
    queryWinthor<Record<string, unknown>>(SQL_PRODUTOS_TURNO, binds),
  ]);
  const ids = [...new Set(lin.map((r) => usu(r.USU)).filter((u): u is number => u !== null))];
  const [descricoes, nomes] = await Promise.all([descricoesProdutos([...new Set([...prods, ...ends].map((r) => num(r.PRODUTO)).filter((c) => c > 0))]), nomesUsuarios(ids)]);
  const total = dias.find((r) => r.DIA == null);
  const endereco = (r: Record<string, unknown>): EnderecoVisitado => {
    const c = String(r.ENDERECO ?? "");
    return {
      endereco: c.length === 9 ? `${c.slice(0, 2)}.${c.slice(2, 4)}.${c.slice(4, 6)}.${c.slice(6)}` : c || "—",
      produto: num(r.PRODUTO),
      descricao: descricoes.get(num(r.PRODUTO)) ?? null,
      visitas: num(r.VISITAS),
      caixas: num(r.CX),
      unidades: num(r.UN),
    };
  };
  return {
    linhas: lin.map((r) => ({
      mapa: num(r.MAPA),
      dia: String(r.DIA),
      usuario: usu(r.USU),
      hora: num(r.HORA),
      linhas: num(r.LINHAS),
      caixas: num(r.CX),
      unidades: num(r.UN),
      kg: num(r.KG),
    })),
    mapas: maps.map((r) => ({ mapa: num(r.MAPA), dia: String(r.DIA), tipo: num(r.TIPO), pedidos: num(r.PEDIDOS), clientes: num(r.CLIENTES) })),
    dias: dias
      .filter((r) => r.DIA != null)
      .map((r) => ({ dia: String(r.DIA), pedidos: num(r.PEDIDOS), clientes: num(r.CLIENTES), cargas: num(r.CARGAS), mapas: num(r.MAPAS) }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
    totalMes: {
      pedidos: num(total?.PEDIDOS),
      clientes: num(total?.CLIENTES),
      cargas: num(total?.CARGAS),
      mapas: num(total?.MAPAS),
      skus: num(skus[0]?.SKUS),
    },
    erros: erros.map((r) => ({
      mapa: num(r.MAPA),
      dia: String(r.DIA),
      usuario: usu(r.USU),
      hora: num(r.HORA),
      origem: String(r.ORIGEM) as ErroSep["origem"],
      ocorrencias: num(r.OCORR),
      itens: num(r.ITENS),
      unidades: num(r.UN),
      falta: num(r.FALTA),
      sobra: num(r.SOBRA),
    })),
    produtosComErro: prods.map((r) => ({
      produto: num(r.PRODUTO),
      descricao: descricoes.get(num(r.PRODUTO)) ?? null,
      ocorrencias: num(r.OCORR),
      itens: num(r.ITENS),
      unidades: num(r.UN),
    })),
    produtosTurno: prodTurno.map((r) => ({ dia: String(r.DIA), usuario: usu(r.USU), turnoHora: String(r.TURNO) as TurnoSep, produto: num(r.PRODUTO) })),
    enderecos: {
      total: num(ends[0]?.TOTAL),
      umaVisita: num(ends[0]?.UMA),
      mais: ends.filter((r) => num(r.RM) <= 10).sort((a, b) => num(a.RM) - num(b.RM)).map(endereco),
      menos: ends.filter((r) => num(r.RN) <= 10).sort((a, b) => num(a.RN) - num(b.RN)).map(endereco),
    },
    usuarios: ids.map((u) => ({ usuario: u, nome: nomes.get(u) ?? null })),
  };
}

/** Páginas por separador, conferência por conferente e nomes do Harpia. CHAMAR SÓ PARA ADMIN. */
export async function lerIndividuaisHarpia(mes: string): Promise<DadosIndividuaisHarpia> {
  const binds = bindsDoMes(mes);
  const [pags, conf] = await Promise.all([
    queryWinthor<Record<string, unknown>>(SQL_PAGINAS, binds),
    queryWinthor<Record<string, unknown>>(SQL_CONFERENTES, binds),
  ]);
  return {
    paginas: pags.map((r) => ({ usuario: num(r.USU), dia: String(r.DIA), ini: num(r.INI), fim: num(r.FIM) })),
    conferentes: conf.map((r) => ({
      dia: String(r.DIA),
      usuario: num(r.USU),
      nome: r.NOME == null ? null : String(r.NOME),
      bipagens: num(r.BIPAGENS),
      unidades: num(r.UN),
      mapas: num(r.MAPAS),
      horas: num(r.HORAS),
    })),
  };
}

/** Mês anterior para a evolução individual (admin): só linhas, erros e páginas. */
export async function lerProducaoIndividualMes(mes: string): Promise<{ linhas: LinhaSep[]; erros: ErroSep[]; paginas: PaginaSep[] }> {
  const binds = bindsDoMes(mes);
  const [lin, erros, pags] = await Promise.all([
    queryWinthor<Record<string, unknown>>(SQL_LINHAS, binds),
    queryWinthor<Record<string, unknown>>(SQL_ERROS, binds),
    queryWinthor<Record<string, unknown>>(SQL_PAGINAS, binds),
  ]);
  return {
    linhas: lin.map((r) => ({ mapa: num(r.MAPA), dia: String(r.DIA), usuario: usu(r.USU), hora: num(r.HORA), linhas: num(r.LINHAS), caixas: num(r.CX), unidades: num(r.UN), kg: num(r.KG) })),
    erros: erros.map((r) => ({
      mapa: num(r.MAPA), dia: String(r.DIA), usuario: usu(r.USU), hora: num(r.HORA),
      origem: String(r.ORIGEM) as ErroSep["origem"],
      ocorrencias: num(r.OCORR), itens: num(r.ITENS), unidades: num(r.UN), falta: num(r.FALTA), sobra: num(r.SOBRA),
    })),
    paginas: pags.map((r) => ({ usuario: num(r.USU), dia: String(r.DIA), ini: num(r.INI), fim: num(r.FIM) })),
  };
}

/** Linhas, kg e pedidos por mês operacional, de `inicio` (yyyy-mm-01) ao fim de `ate`. */
export async function lerMesesSeparacaoHarpia(inicio: string, ate: string): Promise<MesProducao[]> {
  const { fim } = inicioFimDoMes(ate);
  const rows = await queryWinthor<Record<string, unknown>>(SQL_MESES, { ini: inicio, fim });
  return rows
    .map((r) => ({ mes: String(r.MES), linhas: num(r.LINHAS), kg: num(r.KG), pedidos: num(r.PEDIDOS), dias: num(r.DIAS) }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

async function nomesUsuarios(ids: number[]): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  if (!ids.length) return m;
  const rows = await queryWinthor<Record<string, unknown>>(SQL_NOMES(ids.length), Object.fromEntries(ids.map((u, i) => [`u${i}`, u])));
  for (const r of rows) if (r.NOME != null) m.set(num(r.USU), String(r.NOME));
  return m;
}

async function descricoesProdutos(codigos: number[]): Promise<Map<number, string>> {
  const m = new Map<number, string>();
  if (!codigos.length) return m;
  try {
    const rows = await queryWinthor<{ CODPROD: number; DESCRICAO: string }>(
      `SELECT CODPROD, DESCRICAO FROM PCPRODUT WHERE CODPROD IN (${codigos.map((_, i) => `:c${i}`).join(",")})`,
      Object.fromEntries(codigos.map((c, i) => [`c${i}`, c])),
    );
    for (const r of rows) m.set(num(r.CODPROD), String(r.DESCRICAO));
  } catch {
    // sem descrição; segue com o código
  }
  return m;
}

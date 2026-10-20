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
 * 2) `MOVIMENT_END_502` — a movimentação FÍSICA entre endereços (interna 'I' e
 *    abastecimento 'S'), executada pela equipe real de piso (depto LOGISTICA).
 *    É bem maior em volume que (1) e é a fonte certa pra "quem fez",
 *    descendente×ascendente×horizontal e horário.
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
  descendente: number;
  ascendente: number;
  caixas: number;
  peso: number; // kg
  caixasDesc: number; // só descendente (o que a A424 mede)
  pesoDesc: number;
  skus: number; // produtos distintos no dia
}

export interface LinhaHoraDia {
  dia: string;
  hora: number;
  total: number;
}

export interface DiaMovimentoPiso {
  dia: string;
  total: number;
  descendente: number;
  ascendente: number;
}

export interface ProdutoMovimentoPiso {
  produto: number;
  descricao: string | null;
  total: number;
}

/** Função da A424: 03 = reabastecimento de picking ("Movimentar" até o picking); 04 = operador de empilhadeira (baixar/subir palete e movimentação sem convocação). */
export type FuncaoA424 = "03" | "04";

export interface LinhaA424Dia {
  funcao: FuncaoA424;
  dia: string;
  usuario: number;
  nome: string | null;
  tarefas: number; // "TOTAL_MERC" da A424 — 1 por produto movimentado
  tarefasConvocacao: number; // das tarefas, quantas vieram da Convocação Ativa (o resto é da 502 direto)
  caixas: number; // "TOTAL_VOL" da A424
  peso: number; // kg REAL (unidades × peso do Winthor) — a A424 subestima (ver SQL_A424)
  skus: number;
}

export interface MovimentoPiso {
  total: number;
  descendente: number; // "baixar" do Harpia: nível de destino mais baixo (reserva → picking)
  ascendente: number; // "subir" do Harpia: nível de destino mais alto (picking → reserva)
  horizontal: number; // mesmo nível
  dias: DiaMovimentoPiso[]; // pro calendário
  porPessoaDia: LinhaPessoaDia[]; // agregação/filtro por dia é no domínio
  /** Usuários do Harpia que são empilhadores: operadores da Convocação Ativa + extras fixos. */
  empilhadores: number[];
  porHoraDia: LinhaHoraDia[]; // idem
  produtosTop: ProdutoMovimentoPiso[]; // top 50 do mês inteiro
  /** Produtividade pela regra da A424 (funções 03 e 04) — é o rendimento oficial dos empilhadores. */
  a424: LinhaA424Dia[];
  /** SKUs distintos no mês por função/usuário (não dá pra somar os do dia). */
  a424SkusMes: { funcao: FuncaoA424; usuario: number; skus: number }[];
}

/** Um protocolo de recepção de compra (rotina 229 do Harpia, "Recepção Realizada"). */
export interface RecepcaoProtocolo {
  dia: string; // data de entrada do pedido de compra
  protocolo: number;
  descricao: string | null; // "NF: 000302542 / CAMIL- PE"
  skus: number;
  volumes: number; // volumes conferidos
  peso: number; // kg — quantidade recebida × peso bruto do produto
}

export interface LinhaConvocacao {
  dia: string;
  operador: number;
  usuario: number | null; // usuário do Harpia por trás do operador (dá o turno)
  nome: string | null;
  minutosResposta: number | null; // aceite − solicitação
  minutosExecucao: number | null; // finalização − aceite
  finalizada: boolean;
  rejeitada: boolean;
}

export interface DadosHarpiaAbastecimento {
  dias: DiaAbastecimento[];
  produtos: ProdutoGiro[]; // top 20 geral ∪ top 20 de cada curva, do mais ao menos abastecido
  produtosDia: ProdutoGiroDia[]; // histórico diário só desses produtos (drill-down)
  curvas: CurvaAbast[];
  cargas: CargaAntecedencia[];
  rupturas: RupturaAbastecimento[];
  /** Abastecimentos (eventos) do mês que tiveram ruptura associada — o resto é preventivo. */
  abastecimentosReativos: number;
  /** Movimentação física de endereço (reserva → picking), pela equipe de piso. */
  movimentoPiso: MovimentoPiso;
  /** Recepção de compras: o que chega e SOBE pra reserva (ascendente do recebimento). */
  recepcao: RecepcaoProtocolo[];
  /** Convocação Ativa: solicitação→aceite→finalização por operador. Módulo ligado em 2026-10-13 — ainda com poucos dados. */
  convocacoes: LinhaConvocacao[];
}

const num = (v: unknown) => Number(v) || 0;

// Unidades = QTD_COMER_1361 (total: caixas fechadas × embalagem + avulsas).
// QTD_SEP_UN_1361 é só a parte avulsa e QTD_SEP_CX_1361 só as caixas fechadas.
// STATUS_809 = 5 ("Cancelado") é o fim normal desse fluxo (rotina 341x) — não filtrar.
const SQL_DIAS = `
SELECT TO_CHAR(TRUNC(p.PREP_DTHR_809), 'YYYY-MM-DD') AS DIA,
       COUNT(DISTINCT p.ID_NUM_ABAST_PK_809) AS ABASTS,
       SUM(m.QTD_SEP_CX_1361) AS CX,
       SUM(m.QTD_COMER_1361) AS UN,
       COUNT(DISTINCT m.MERC_FK_1361) AS SKUS
  FROM HARPIAW2.PREPARA_ABAST_809 p
  JOIN HARPIAW2.PREPARA_ABAST_MERC_1361 m ON m.NUM_ABAST_FK_1361 = p.ID_NUM_ABAST_PK_809
 WHERE p.PREP_DTHR_809 >= TO_DATE(:ini, 'YYYY-MM-DD') AND p.PREP_DTHR_809 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
 GROUP BY TRUNC(p.PREP_DTHR_809)`;

// CLASSEVENDA do Winthor = proxy da curva ABC (classificação por venda).
// Top 20 geral + top 20 de CADA curva (pro clique na curva), num só SELECT
// via ROW_NUMBER (sem FETCH FIRST, por compatibilidade com Oracle < 12c).
const TOP_GIRO = 20;
const SQL_PRODUTOS = `
SELECT PRODUTO, CURVA, QTD, CX, UN FROM (
  SELECT m.MERC_FK_1361 AS PRODUTO, pr.CLASSEVENDA AS CURVA, COUNT(*) AS QTD,
         SUM(m.QTD_SEP_CX_1361) AS CX, SUM(m.QTD_COMER_1361) AS UN,
         ROW_NUMBER() OVER (ORDER BY COUNT(*) DESC, m.MERC_FK_1361) AS RN_GERAL,
         ROW_NUMBER() OVER (PARTITION BY NVL(pr.CLASSEVENDA, '?') ORDER BY COUNT(*) DESC, m.MERC_FK_1361) AS RN_CURVA
    FROM HARPIAW2.PREPARA_ABAST_MERC_1361 m
    JOIN HARPIAW2.PREPARA_ABAST_809 p ON p.ID_NUM_ABAST_PK_809 = m.NUM_ABAST_FK_1361
    LEFT JOIN PCPRODUT pr ON pr.CODPROD = m.MERC_FK_1361
   WHERE p.PREP_DTHR_809 >= TO_DATE(:ini, 'YYYY-MM-DD') AND p.PREP_DTHR_809 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   GROUP BY m.MERC_FK_1361, pr.CLASSEVENDA
) WHERE RN_GERAL <= ${TOP_GIRO} OR RN_CURVA <= ${TOP_GIRO}
ORDER BY QTD DESC, PRODUTO`;

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

// Movimentação física entre endereços reais (reserva M, picking C/P), nos dois
// sentidos: interna (I) e abastecimento (S). Fica de fora a recepção (E, que
// grava origem = destino) e os endereços fictícios (T/A, 999999999/888888888).
// Endereço = RUA(2)+PREDIO(2)+NIVEL(2)+APTO(3); nível em SUBSTR(col,5,2),
// validado contra a faixa real de uso (00-05, ver convocação ativa 1022) —
// nível fora dela (ex.: rua 91) não conta como vertical.
//
// Sentido = as ações da Convocação Ativa do Harpia (ACAO_TIPO_1028):
//   descendente = "Necessita Baixar" — reserva → picking, o abastecimento;
//   ascendente  = "Necessita Subir"  — picking → reserva (sobra volta pro pulmão)
//                 ou reserva → reserva mais alta.
const FILTRO_PISO = `m.STATUS_502 = 2 AND m.TIPO_MOVIMENT_502 IN ('I', 'S') AND m.TIPO_END_502 IN ('M', 'C', 'P') AND m.TIPO_END_DESTINO_502 IN ('M', 'C', 'P') AND LENGTH(m.END_PF_502) = 9 AND LENGTH(m.END_DESTINO_FK_502) = 9`;
const NIVEIS_VALIDOS = `SUBSTR(m.END_PF_502, 5, 2) BETWEEN '00' AND '05' AND SUBSTR(m.END_DESTINO_FK_502, 5, 2) BETWEEN '00' AND '05'`;
const DESCE_COND = `${NIVEIS_VALIDOS} AND SUBSTR(m.END_PF_502, 5, 2) > SUBSTR(m.END_DESTINO_FK_502, 5, 2)`;
const DESCE_PISO = `CASE WHEN ${DESCE_COND} THEN 1 ELSE 0 END`;
const SOBE_PISO = `CASE WHEN ${NIVEIS_VALIDOS} AND SUBSTR(m.END_PF_502, 5, 2) < SUBSTR(m.END_DESTINO_FK_502, 5, 2) THEN 1 ELSE 0 END`;
const SENTIDO_PISO = `SUM(${DESCE_PISO}) AS DESCE, SUM(${SOBE_PISO}) AS SOBE`;
// Só conta movimentação EFETIVADA (STATUS_502 = 2: 1 = só impressa, 9 =
// cancelada) e credita a quem EXECUTOU (USU_EFETIV_FK_502). USU_FK_502 é quem
// pediu — no abastecimento 'S' costuma ser o faturamento.
const USU_PISO = `NVL(m.USU_EFETIV_FK_502, m.USU_FK_502)`;
// Quantidade: no abastecimento 'S' o QTD_502 vem em CAIXAS (unidades = QTD ×
// INVOL_PADRAO); na interna 'I' vem em UNIDADES (caixas = QTD ÷ INVOL_PADRAO,
// exato em 100% das linhas de out/2026). Peso = unidades × PESOBRUTO do Winthor.
const INVOL_PISO = `NVL(NULLIF(m.INVOL_PADRAO_MERC_502, 0), 1)`;
const CAIXAS_PISO = `CASE WHEN m.TIPO_MOVIMENT_502 = 'S' THEN m.QTD_502 ELSE m.QTD_502 / ${INVOL_PISO} END`;
const PESO_PISO = `CASE WHEN m.TIPO_MOVIMENT_502 = 'S' THEN m.QTD_502 * ${INVOL_PISO} ELSE m.QTD_502 END * NVL(pr.PESOBRUTO, 0)`;

const SQL_MOVIMENTO_TOTAL = `
SELECT COUNT(*) AS TOTAL, ${SENTIDO_PISO}
  FROM HARPIAW2.MOVIMENT_END_502 m
 WHERE m.DT_MOVIMENT_502 >= TO_DATE(:ini, 'YYYY-MM-DD') AND m.DT_MOVIMENT_502 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   AND ${FILTRO_PISO}`;

// Por pessoa E por dia (não pré-agregado) — dá pro BI filtrar por dia e abrir histórico por pessoa.
const SQL_MOVIMENTO_PESSOAS_DIA = `
SELECT TO_CHAR(TRUNC(m.DT_MOVIMENT_502), 'YYYY-MM-DD') AS DIA, ${USU_PISO} AS USU,
       u.DESCR_COMPLETO_754 AS NOME, d.DESCR_176 AS DEPTO,
       COUNT(*) AS TOTAL, ${SENTIDO_PISO},
       SUM(${CAIXAS_PISO}) AS CAIXAS, SUM(${PESO_PISO}) AS PESO,
       SUM(CASE WHEN ${DESCE_COND} THEN ${CAIXAS_PISO} ELSE 0 END) AS CAIXAS_DESC,
       SUM(CASE WHEN ${DESCE_COND} THEN ${PESO_PISO} ELSE 0 END) AS PESO_DESC,
       COUNT(DISTINCT m.MERC_PF_502) AS SKUS
  FROM HARPIAW2.MOVIMENT_END_502 m
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = ${USU_PISO}
  LEFT JOIN HARPIAW2.DEPART_176 d ON d.DEPART_PK_176 = u.DEPART_FK_754
  LEFT JOIN PCPRODUT pr ON pr.CODPROD = m.MERC_PF_502
 WHERE m.DT_MOVIMENT_502 >= TO_DATE(:ini, 'YYYY-MM-DD') AND m.DT_MOVIMENT_502 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   AND ${FILTRO_PISO}
 GROUP BY TRUNC(m.DT_MOVIMENT_502), ${USU_PISO}, u.DESCR_COMPLETO_754, d.DESCR_176`;

// Produtividade dos empilhadores = rotina A424 do Harpia ("Remuneração por
// Produtividade Geral"), funções 03 (REABASTECIMENTO) e 04 (OPERADOR DE
// EMPILHADEIRA). Regra copiada do SQL que a própria A424 exporta; validado
// contra o export de 01–20/10/2026: tarefas e caixas batem exatos por usuário.
//
// Na Convocação Ativa uma movimentação da 502 vira até 3 tarefas na 1028, cada
// uma com operador e hora próprios (ACAO_TIPO_1028):
//   1 Baixar     — desce o palete inteiro (QTD + sobra)       → 04
//   2 Movimentar — leva até o picking (QTD)                     → 03
//   3 Subir      — devolve a sobra pra reserva (SALDO_FINAL)    → 04
// O crédito é do operador da tarefa, na data de FINALIZAÇÃO (a 502 guarda a
// data do pedido e quem pediu). Movimentação sem convocação finalizada cai da
// 502 creditada a USU_FK_502, como a A424 faz.
//
// Única diferença proposital: o peso. A A424 multiplica CAIXAS pelo peso da
// UNIDADE no trecho sem convocação (subestima até 24× em caixa de 24); aqui é
// unidades × PESOBRUTO do Winthor, que bate ±4% com o PESO_502 do Harpia.
const LINHAS_A424 = `
  SELECT CASE WHEN c.ACAO_TIPO_1028 = '2' AND NVL(m.CARREG_PULMAO_DOCA_502, 0) = 0 AND NVL(m.SEQ_INVENT_502, 0) = 0 THEN '03'
              WHEN c.ACAO_TIPO_1028 IN ('2', '4') AND NVL(m.CARREG_PULMAO_DOCA_502, 0) = 0 THEN NULL
              ELSE '04' END AS FUNCAO,
         1 AS CONV, c.DT_HR_FINALIZACAO_1028 AS DT, op.USU_FK_1023 AS USU, m.MERC_PF_502 AS MERC, m.TIPO_MOVIMENT_502 AS TIPO,
         CASE c.ACAO_TIPO_1028 WHEN '1' THEN m.QTD_502 + NVL(m.SALDO_FINAL_END_502, 0) WHEN '3' THEN NVL(m.SALDO_FINAL_END_502, 0) ELSE m.QTD_502 END AS QTD,
         m.INVOL_PADRAO_MERC_502 AS INVOL
    FROM HARPIAW2.CONV_ATIVA_CONVOCACAO_1028 c
    JOIN HARPIAW2.CONV_ATIVA_OPERADORES_1023 op ON op.EMPRESA_PF_1023 = c.EMPRESA_PF_1028 AND op.OPERADOR_PK_1023 = c.OPERADOR_FK_1028
    JOIN HARPIAW2.CONV_ATIVA_OPERADOR_AGENT_1024 oa ON oa.AGENTE_PF_1024 = c.AGENTE_FK_1028 AND oa.EMPRESA_PF_1024 = op.EMPRESA_PF_1023 AND oa.OPERADOR_PF_1024 = op.OPERADOR_PK_1023
    JOIN HARPIAW2.CONV_ATIVA_AGENTES_1021 ag ON ag.AGENTE_PK_1021 = oa.AGENTE_PF_1024
    JOIN HARPIAW2.MOVIMENT_END_502 m ON m.EMPRESA_PF_502 = c.EMPRESA_PF_1028 AND m.SEQ_CONVOCACAO_ATIVA_502 = c.SEQ_CONVOCACAO_ATIVA_FK_1028
    JOIN HARPIAW2.MERC_EMPRESA_468 me ON me.EMPRESA_PF_468 = m.EMPRESA_PF_502 AND me.MERC_PF_468 = m.MERC_PF_502
   WHERE c.DT_HR_FINALIZACAO_1028 >= TO_DATE(:ini, 'YYYY-MM-DD') AND c.DT_HR_FINALIZACAO_1028 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
     AND c.STATUS_1028 = '3' AND c.EMPRESA_PF_1028 = 1
  UNION ALL
  SELECT '04', 0, m.DT_MOVIMENT_502, m.USU_FK_502, m.MERC_PF_502, m.TIPO_MOVIMENT_502, m.QTD_502, m.INVOL_PADRAO_MERC_502
    FROM HARPIAW2.MOVIMENT_END_502 m
   WHERE m.DT_MOVIMENT_502 >= TO_DATE(:ini, 'YYYY-MM-DD') AND m.DT_MOVIMENT_502 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
     AND m.EMPRESA_PF_502 = 1 AND m.TIPO_MOVIMENT_502 IN ('S', 'I', 'D', 'E') AND m.STATUS_502 = '2'
     AND (m.TIPO_END_502 = 'M' OR m.TIPO_END_DESTINO_502 = 'M') AND NVL(m.SEQ_INVENT_502, 0) = 0
     AND NOT EXISTS (SELECT 1 FROM HARPIAW2.CONV_ATIVA_CONVOCACAO_1028 c WHERE c.EMPRESA_PF_1028 = m.EMPRESA_PF_502 AND c.SEQ_CONVOCACAO_ATIVA_FK_1028 = m.SEQ_CONVOCACAO_ATIVA_502 AND c.STATUS_1028 = '3')
  UNION ALL
  SELECT '03', 0, m.DT_MOVIMENT_502, m.USU_FK_502, m.MERC_PF_502, m.TIPO_MOVIMENT_502, m.QTD_502, m.INVOL_PADRAO_MERC_502
    FROM HARPIAW2.MOVIMENT_END_502 m
   WHERE m.DT_MOVIMENT_502 >= TO_DATE(:ini, 'YYYY-MM-DD') AND m.DT_MOVIMENT_502 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
     AND m.EMPRESA_PF_502 = 1 AND m.TIPO_MOVIMENT_502 IN ('S', 'I') AND m.TIPO_END_502 = 'M' AND m.TIPO_END_DESTINO_502 = 'C' AND m.STATUS_502 = '2'
     AND NVL(m.CARREG_PULMAO_DOCA_502, 0) = 0 AND NVL(m.SEQ_INVENT_502, 0) = 0
     AND NOT EXISTS (SELECT 1 FROM HARPIAW2.CONV_ATIVA_CONVOCACAO_1028 c WHERE c.EMPRESA_PF_1028 = m.EMPRESA_PF_502 AND c.SEQ_CONVOCACAO_ATIVA_FK_1028 = m.SEQ_CONVOCACAO_ATIVA_502 AND c.ACAO_TIPO_1028 = '2' AND c.STATUS_1028 = '3')`;
// "S" grava QTD em caixas; o resto em unidades.
const CAIXAS_A424 = `CASE WHEN l.TIPO = 'S' THEN l.QTD ELSE l.QTD / NVL(NULLIF(l.INVOL, 0), 1) END`;
const PESO_A424 = `CASE WHEN l.TIPO = 'S' THEN l.QTD * NVL(NULLIF(l.INVOL, 0), 1) ELSE l.QTD END * NVL(pr.PESOBRUTO, 0)`;

// Mesma pessoa com mais de um login no Harpia → login que vale no BI.
// 98 "EMP. THAY" = Gleidson (confirmado pelo Pedro em 20/10/2026): o operador 3
// da Convocação Ativa passou do 76 pro 98, mas é o mesmo empilhador.
const MESMA_PESSOA: Record<number, number> = { 98: 76 };
const usuCanonico = (col: string) =>
  `CASE ${col} ${Object.entries(MESMA_PESSOA).map(([de, para]) => `WHEN ${de} THEN ${para}`).join(" ")} ELSE ${col} END`;

const SQL_A424_DIA = `
WITH linhas AS (${LINHAS_A424})
SELECT l.FUNCAO, TO_CHAR(TRUNC(l.DT), 'YYYY-MM-DD') AS DIA, ${usuCanonico("l.USU")} AS USU, MAX(u.DESCR_COMPLETO_754) AS NOME,
       COUNT(*) AS TAREFAS, SUM(l.CONV) AS TAREFAS_CONV, SUM(${CAIXAS_A424}) AS CAIXAS, SUM(${PESO_A424}) AS PESO, COUNT(DISTINCT l.MERC) AS SKUS
  FROM linhas l
  LEFT JOIN PCPRODUT pr ON pr.CODPROD = l.MERC
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = ${usuCanonico("l.USU")}
 WHERE l.FUNCAO IS NOT NULL
 GROUP BY l.FUNCAO, TRUNC(l.DT), ${usuCanonico("l.USU")}`;

const SQL_A424_SKUS_MES = `
WITH linhas AS (${LINHAS_A424})
SELECT l.FUNCAO, ${usuCanonico("l.USU")} AS USU, COUNT(DISTINCT l.MERC) AS SKUS
  FROM linhas l
 WHERE l.FUNCAO IS NOT NULL
 GROUP BY l.FUNCAO, ${usuCanonico("l.USU")}`;

// Empilhador = operador cadastrado na Convocação Ativa (cada um preso a um
// agente "EMPILHADEIRA"). EMPILHADORES_EXTRA = usuários do Harpia que também
// são empilhadores mas ainda não estão (ou não estão mais) na Convocação Ativa.
// 76 = Gleidson, que também usa o 98 (ver MESMA_PESSOA).
// Luiz Gabriel (3) é da noite — fora por decisão do Pedro.
const EMPILHADORES_EXTRA: number[] = [76];
const SQL_EMPILHADORES = `
SELECT DISTINCT op.USU_FK_1023 AS USU
  FROM HARPIAW2.CONV_ATIVA_OPERADORES_1023 op
 WHERE op.USU_FK_1023 IS NOT NULL`;

const SQL_MOVIMENTO_DIAS = `
SELECT TO_CHAR(TRUNC(m.DT_MOVIMENT_502), 'YYYY-MM-DD') AS DIA, COUNT(*) AS TOTAL, ${SENTIDO_PISO}
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
       op.USU_FK_1023 AS USU,
       NVL(u.DESCR_COMPLETO_754, op.DESCRICAO_1023) AS NOME,
       (c.DT_HR_ACEITE_1028 - c.DT_HR_SOLICITACAO_1028) * 1440 AS MIN_RESPOSTA,
       (c.DT_HR_FINALIZACAO_1028 - c.DT_HR_ACEITE_1028) * 1440 AS MIN_EXECUCAO,
       CASE WHEN c.DT_HR_FINALIZACAO_1028 IS NOT NULL THEN 1 ELSE 0 END AS FINALIZADA,
       CASE WHEN c.DT_HR_REJEICAO_1028 IS NOT NULL THEN 1 ELSE 0 END AS REJEITADA
  FROM HARPIAW2.CONV_ATIVA_CONVOCACAO_1028 c
  LEFT JOIN HARPIAW2.CONV_ATIVA_OPERADORES_1023 op ON op.OPERADOR_PK_1023 = c.OPERADOR_FK_1028 AND op.EMPRESA_PF_1023 = c.EMPRESA_PF_1028
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = op.USU_FK_1023
 WHERE c.DT_HR_SOLICITACAO_1028 >= TO_DATE(:ini, 'YYYY-MM-DD') AND c.DT_HR_SOLICITACAO_1028 < TO_DATE(:fim, 'YYYY-MM-DD') + 1`;

// Recepção de compras = rotina 229 do Harpia ("Relatório de Recepção
// Realizada", filtro Compras). Validado protocolo a protocolo contra o print
// da 229 (out/2026): SKUs, volumes e peso batem exatos.
//   protocolo = NUM_CARREG (PEDIDO_REPO_PLAN_*), descrição em NUM_CARREG_1140;
//   data      = DT_ENTR_572 do pedido de compra;
//   compras   = fornecedor ≠ 2 (o 2 agrupa devolução/coleta de motorista);
//   volumes   = QTD_VOL_580 (volumes conferidos);
//   peso      = QTD_ARRECAD_580 × PCPRODUT.PESOBRUTO (o Harpia não grava peso).
// Ressalva: no total de 01–16/10 a 229 somou 213.642 volumes e aqui deram
// ~170 mil (peso igual a 0,02%) — diferença ainda não explicada.
const SQL_RECEPCAO = `
WITH ped AS (
  SELECT o.EMPRESA_PF_572 AS EMP, o.NUM_PEDIDO_PK_572 AS PED, o.DT_ENTR_572 AS DT
    FROM HARPIAW2.PEDIDO_REPO_572 o
   WHERE o.DT_ENTR_572 >= TO_DATE(:ini, 'YYYY-MM-DD') AND o.DT_ENTR_572 < TO_DATE(:fim, 'YYYY-MM-DD') + 1
     AND o.FABRIC_FK_572 <> 2
), itens AS (
  SELECT l.EMPRESA_PF_580 AS EMP, l.NUM_CARREG_PK_580 AS PROT, MIN(ped.DT) AS DT,
         COUNT(DISTINCT l.MERC_PF_580) AS SKUS, SUM(l.QTD_VOL_580) AS VOL, SUM(l.QTD_ARRECAD_580 * p.PESOBRUTO) AS PESO
    FROM HARPIAW2.PEDIDO_REPO_PLAN_LT_FABRIC_580 l
    JOIN ped ON ped.EMP = l.EMPRESA_PF_580 AND ped.PED = l.NUM_PEDIDO_PF_580
    LEFT JOIN PCPRODUT p ON p.CODPROD = l.MERC_PF_580
   GROUP BY l.EMPRESA_PF_580, l.NUM_CARREG_PK_580
)
SELECT TO_CHAR(TRUNC(i.DT), 'YYYY-MM-DD') AS DIA, i.PROT,
       (SELECT MAX(c.DESCR_AGRUP_1140) FROM HARPIAW2.NUM_CARREG_1140 c WHERE c.EMPRESA_PF_1140 = i.EMP AND c.NUM_CARREG_PK_1140 = i.PROT) AS DESCR,
       i.SKUS, i.VOL, i.PESO
  FROM itens i`;

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

/** Histórico diário dos produtos do giro (drill-down do Giro). Vazio se não há produtos. */
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
  const [dias, prods, curvasRaw, cargas, rupturas, reativos, movTotal, movPessoasDia, movDias, movHoraDia, movProdutos, convocacoesRaw, recepcaoRaw, empilhadoresRaw, a424Raw, a424SkusRaw] = await Promise.all([
    queryWinthor<Record<string, unknown>>(SQL_DIAS, binds),
    queryWinthor<Record<string, unknown>>(SQL_PRODUTOS, binds),
    queryWinthor<{ CURVA: string; QTD: number; SKUS: number }>(SQL_CURVAS, binds),
    queryWinthor<{ NUMCAR: number; DIA: string; HORAS_FOLGA: number | null }>(SQL_CARGAS, binds),
    queryWinthor<{ DT: string; PRODUTO: number; CX: number; UN: number }>(SQL_RUPTURAS, binds),
    queryWinthor<{ REATIVOS: number }>(SQL_REATIVOS, binds),
    queryWinthor<{ TOTAL: number; DESCE: number; SOBE: number }>(SQL_MOVIMENTO_TOTAL, binds),
    queryWinthor<{ DIA: string; USU: number; NOME: string | null; DEPTO: string | null; TOTAL: number; DESCE: number; SOBE: number; CAIXAS: number; PESO: number; CAIXAS_DESC: number; PESO_DESC: number; SKUS: number }>(SQL_MOVIMENTO_PESSOAS_DIA, binds),
    queryWinthor<{ DIA: string; TOTAL: number; DESCE: number; SOBE: number }>(SQL_MOVIMENTO_DIAS, binds),
    queryWinthor<{ DIA: string; HORA: string; TOTAL: number }>(SQL_MOVIMENTO_HORA_DIA, binds),
    queryWinthor<{ PRODUTO: number; TOTAL: number }>(SQL_MOVIMENTO_PRODUTOS, binds),
    queryWinthor<{ DIA: string; OPERADOR: number; USU: number | null; NOME: string | null; MIN_RESPOSTA: number | null; MIN_EXECUCAO: number | null; FINALIZADA: number; REJEITADA: number }>(SQL_CONVOCACOES, binds),
    queryWinthor<{ DIA: string; PROT: number; DESCR: string | null; SKUS: number; VOL: number; PESO: number }>(SQL_RECEPCAO, binds),
    queryWinthor<{ USU: number }>(SQL_EMPILHADORES, {}),
    queryWinthor<{ FUNCAO: string; DIA: string; USU: number; NOME: string | null; TAREFAS: number; TAREFAS_CONV: number; CAIXAS: number; PESO: number; SKUS: number }>(SQL_A424_DIA, binds),
    queryWinthor<{ FUNCAO: string; USU: number; SKUS: number }>(SQL_A424_SKUS_MES, binds),
  ]);
  const [descricoes, produtosDia] = await Promise.all([
    descricoesProdutos([...prods.map((r) => num(r.PRODUTO)), ...rupturas.map((r) => r.PRODUTO), ...movProdutos.map((r) => r.PRODUTO)]),
    produtosDiaDoMes(prods.map((r) => num(r.PRODUTO)), binds),
  ]);
  const movTotalNum = num(movTotal[0]?.TOTAL);
  const movDesceNum = num(movTotal[0]?.DESCE);
  const movSobeNum = num(movTotal[0]?.SOBE);
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
      descendente: movDesceNum,
      ascendente: movSobeNum,
      horizontal: movTotalNum - movDesceNum - movSobeNum,
      dias: movDias
        .map((r) => ({ dia: String(r.DIA), total: num(r.TOTAL), descendente: num(r.DESCE), ascendente: num(r.SOBE) }))
        .sort((a, b) => a.dia.localeCompare(b.dia)),
      porPessoaDia: movPessoasDia.map((r) => ({
        dia: String(r.DIA),
        usuario: num(r.USU),
        nome: r.NOME ?? null,
        departamento: r.DEPTO ?? null,
        total: num(r.TOTAL),
        descendente: num(r.DESCE),
        ascendente: num(r.SOBE),
        caixas: num(r.CAIXAS),
        peso: num(r.PESO),
        caixasDesc: num(r.CAIXAS_DESC),
        pesoDesc: num(r.PESO_DESC),
        skus: num(r.SKUS),
      })),
      empilhadores: [...new Set([...empilhadoresRaw.map((r) => num(r.USU)), ...EMPILHADORES_EXTRA].map((u) => MESMA_PESSOA[u] ?? u))],
      porHoraDia: movHoraDia.map((r) => ({ dia: String(r.DIA), hora: Number(r.HORA), total: num(r.TOTAL) })),
      produtosTop: movProdutos.map((r) => ({
        produto: num(r.PRODUTO),
        descricao: descricoes.get(num(r.PRODUTO)) ?? null,
        total: num(r.TOTAL),
      })),
      a424: a424Raw.map((r) => ({
        funcao: String(r.FUNCAO) as FuncaoA424,
        dia: String(r.DIA),
        usuario: num(r.USU),
        nome: r.NOME ?? null,
        tarefas: num(r.TAREFAS),
        tarefasConvocacao: num(r.TAREFAS_CONV),
        caixas: num(r.CAIXAS),
        peso: num(r.PESO),
        skus: num(r.SKUS),
      })),
      a424SkusMes: a424SkusRaw.map((r) => ({ funcao: String(r.FUNCAO) as FuncaoA424, usuario: num(r.USU), skus: num(r.SKUS) })),
    },
    recepcao: recepcaoRaw
      .map((r) => ({
        dia: String(r.DIA),
        protocolo: num(r.PROT),
        descricao: r.DESCR ?? null,
        skus: num(r.SKUS),
        volumes: num(r.VOL),
        peso: num(r.PESO),
      }))
      .sort((a, b) => a.dia.localeCompare(b.dia) || a.protocolo - b.protocolo),
    convocacoes: convocacoesRaw.map((r) => ({
      dia: String(r.DIA),
      operador: num(r.OPERADOR),
      usuario: r.USU == null ? null : num(r.USU),
      nome: r.NOME ?? null,
      minutosResposta: r.MIN_RESPOSTA == null ? null : Number(r.MIN_RESPOSTA),
      minutosExecucao: r.MIN_EXECUCAO == null ? null : Number(r.MIN_EXECUCAO),
      finalizada: num(r.FINALIZADA) === 1,
      rejeitada: num(r.REJEITADA) === 1,
    })),
  };
}

import { queryWinthor } from "@/lib/oracle/client";
import { lembrar } from "@/lib/cache-memoria";
import { filialIn } from "./filiais";
import type { PlanilhaAgrupamento, ProtocoloDevolucao } from "@/domain/devolucoes-protocolos";

/**
 * Protocolos de devolução no Harpia (HARPIAW2) — ver o mapa das etapas em
 * `@/domain/devolucoes-protocolos`. Fontes (todas gravadas sozinhas pelo sistema):
 *
 * - `LT_ESTOQ_444` (TIPO_LT 'G' = devolução): o protocolo. `DT_LT_INICIO` = criado
 *   na D1131; `LT_LIB`='S' + `DT_LIB`/`DT_LT_FIM` = finalizado na D1132.
 *   `WMS_NUM_LOTE_ERP` = NUMTRANSENT da nota de devolução no Winthor.
 * - `NUM_CARREG_1140`: agrupamento (PK) → protocolos (REF = NUM_CARREG_444).
 * - `MIRROR_447` (histórico dos itens): 1º registro da rotina B311 = início da conferência.
 * - `MIRROR_238` (histórico das reservas de endereço): 1º `CONTROL_DEP`='S' da
 *   216 = crachá impresso, mercadoria no endereço. Liga pelo agrupamento + NF.
 * - `LT_ESTOQ_MERC_447.QTD_DANIF`: avaria por item, gravada na 216.
 * - `PEDIDO_REPO_PLAN_MERC_581`: planilha da B311 por agrupamento (falta/sobra/
 *   divergência por mercadoria) — estado ATUAL; nos finalizados vem zerada.
 * - Winthor: PCNFENT → PCESTCOM (venda de origem) → PCNFSAID (pedido, carga) →
 *   PCCARREG (motorista).
 *
 * Abertos entram com até 1 ano (há restos de 2026-04..06 nunca finalizados);
 * finalizados, só os criados no período.
 */
const sqlProtocolos = `
WITH lt AS (
  SELECT l.EMPRESA_PF_444 emp, l.NUM_LT_PK_444 lt, l.NUM_CARREG_444 car, l.NF_444 nf,
         l.LT_LIB_444 lib, NVL(l.VLR_BRUT_444, 0) valor, l.DT_LT_INICIO_444 criado,
         NVL(l.DT_LIB_444, l.DT_LT_FIM_444) dt_fin,
         CASE WHEN REGEXP_LIKE(l.WMS_NUM_LOTE_ERP_444, '^[0-9]+$') THEN TO_NUMBER(l.WMS_NUM_LOTE_ERP_444) END transent,
         CASE WHEN l.DT_LT_INICIO_444 >= TO_DATE(:de, 'YYYY-MM-DD')
               AND l.DT_LT_INICIO_444 < TO_DATE(:ate, 'YYYY-MM-DD') + 1 THEN 1 ELSE 0 END no_periodo
  FROM HARPIAW2.LT_ESTOQ_444 l
  WHERE l.TIPO_LT_444 = 'G' AND ${filialIn("l.EMPRESA_PF_444")}
    AND ((NVL(l.LT_LIB_444, 'N') <> 'S' AND l.DT_MOVIMENT_444 >= SYSDATE - 365)
      OR (l.DT_LT_INICIO_444 >= TO_DATE(:de, 'YYYY-MM-DD') AND l.DT_LT_INICIO_444 < TO_DATE(:ate, 'YYYY-MM-DD') + 1))
),
grp AS (
  SELECT g.EMPRESA_PF_1140 emp, g.NUM_CARREG_REF_1140 car,
         MAX(g.NUM_CARREG_PK_1140) grupo, MAX(g.DESCR_AGRUP_1140) rotulo
  FROM HARPIAW2.NUM_CARREG_1140 g
  WHERE (g.EMPRESA_PF_1140, g.NUM_CARREG_REF_1140) IN (SELECT emp, car FROM lt)
  GROUP BY g.EMPRESA_PF_1140, g.NUM_CARREG_REF_1140
),
conf AS (
  SELECT m.EMPRESA_PF_447 emp, m.NUM_LT_PF_447 lt, MIN(m.DTHR_MIRROR) ini
  FROM HARPIAW2.MIRROR_447 m
  WHERE m.MODULO_MIRROR LIKE '%B311%' AND (m.EMPRESA_PF_447, m.NUM_LT_PF_447) IN (SELECT emp, lt FROM lt)
  GROUP BY m.EMPRESA_PF_447, m.NUM_LT_PF_447
),
arm AS (
  SELECT r.EMPRESA_PF_238 emp, r.NUM_CARREG_238 grupo, r.NF_238 nf, MIN(r.DTHR_MIRROR) ini
  FROM HARPIAW2.MIRROR_238 r
  WHERE r.CONTROL_DEP_238 = 'S' AND (r.EMPRESA_PF_238, r.NUM_CARREG_238) IN (SELECT emp, grupo FROM grp)
  GROUP BY r.EMPRESA_PF_238, r.NUM_CARREG_238, r.NF_238
),
av AS (
  SELECT i.EMPRESA_PF_447 emp, i.NUM_LT_PF_447 lt, COUNT(*) itens,
         SUM(CASE WHEN NVL(i.QTD_DANIF_447, 0) > 0 THEN 1 ELSE 0 END) itens_avaria,
         SUM(NVL(i.QTD_DANIF_447, 0)) qtd_avaria
  FROM HARPIAW2.LT_ESTOQ_MERC_447 i
  WHERE (i.EMPRESA_PF_447, i.NUM_LT_PF_447) IN (SELECT emp, lt FROM lt)
  GROUP BY i.EMPRESA_PF_447, i.NUM_LT_PF_447
),
venda AS (
  SELECT ec.NUMTRANSENT, MIN(ec.NUMTRANSVENDA) NUMTRANSVENDA
  FROM PCESTCOM ec WHERE ec.NUMTRANSENT IN (SELECT transent FROM lt)
  GROUP BY ec.NUMTRANSENT
)
SELECT lt.lt PROTOCOLO, grp.grupo GRUPO, grp.rotulo ROTULO, lt.valor VALOR,
       e.NUMNOTA NOTA_DEVOLUCAO, NVL(s.CODCLI, e.CODFORNEC) CODCLI, cl.CLIENTE,
       s.NUMPED PEDIDO, s.NUMCAR CARGA, car.CODMOTORISTA COD_MOTORISTA, emp.NOME MOTORISTA,
       TO_CHAR(lt.criado, 'YYYY-MM-DD HH24:MI') CRIADO,
       CASE WHEN lt.lib = 'S' THEN 1 ELSE 0 END FINALIZADO, lt.no_periodo NO_PERIODO,
       ROUND((SYSDATE - lt.criado) * 24, 2) H_ABERTO,
       ROUND((conf.ini - lt.criado) * 24, 2) H_CONF,
       ROUND((arm.ini - lt.criado) * 24, 2) H_END,
       CASE WHEN lt.lib = 'S' THEN ROUND((lt.dt_fin - lt.criado) * 24, 2) END H_FIN,
       NVL(av.itens, 0) ITENS, NVL(av.itens_avaria, 0) ITENS_AVARIA, NVL(av.qtd_avaria, 0) QTD_AVARIA
FROM lt
LEFT JOIN grp ON grp.emp = lt.emp AND grp.car = lt.car
LEFT JOIN conf ON conf.emp = lt.emp AND conf.lt = lt.lt
LEFT JOIN arm ON arm.emp = lt.emp AND arm.grupo = grp.grupo AND arm.nf = lt.nf
LEFT JOIN av ON av.emp = lt.emp AND av.lt = lt.lt
LEFT JOIN PCNFENT e ON e.NUMTRANSENT = lt.transent
LEFT JOIN venda v ON v.NUMTRANSENT = lt.transent
LEFT JOIN PCNFSAID s ON s.NUMTRANSVENDA = v.NUMTRANSVENDA
LEFT JOIN PCCARREG car ON car.NUMCAR = s.NUMCAR
LEFT JOIN PCEMPR emp ON emp.MATRICULA = car.CODMOTORISTA
LEFT JOIN PCCLIENT cl ON cl.CODCLI = NVL(s.CODCLI, e.CODFORNEC)`;

// Planilha da B311 dos agrupamentos com protocolo aberto (estado atual).
const sqlPlanilhas = `
SELECT p.NUM_CARREG_PK_581 GRUPO, COUNT(*) ITENS,
       SUM(CASE WHEN p.CONTROL_CONF_581 = 'S' THEN 1 ELSE 0 END) ITENS_CONF,
       SUM(CASE WHEN p.CONTROL_DIVERG_581 = 'S' THEN 1 ELSE 0 END) ITENS_DIV,
       SUM(CASE WHEN NVL(p.QTD_FALTA_581, 0) > 0 THEN 1 ELSE 0 END) ITENS_FALTA,
       SUM(CASE WHEN NVL(p.QTD_SOBRA_581, 0) > 0 THEN 1 ELSE 0 END) ITENS_SOBRA,
       SUM(NVL(p.QTD_FALTA_581, 0)) QTD_FALTA, SUM(NVL(p.QTD_SOBRA_581, 0)) QTD_SOBRA
FROM HARPIAW2.PEDIDO_REPO_PLAN_MERC_581 p
WHERE ${filialIn("p.EMPRESA_PF_581")}
  AND p.NUM_CARREG_PK_581 IN (
    SELECT g.NUM_CARREG_PK_1140
    FROM HARPIAW2.NUM_CARREG_1140 g
    JOIN HARPIAW2.LT_ESTOQ_444 l ON l.EMPRESA_PF_444 = g.EMPRESA_PF_1140 AND l.NUM_CARREG_444 = g.NUM_CARREG_REF_1140
    WHERE l.TIPO_LT_444 = 'G' AND NVL(l.LT_LIB_444, 'N') <> 'S' AND l.DT_MOVIMENT_444 >= SYSDATE - 365)
GROUP BY p.NUM_CARREG_PK_581`;

const n = (v: unknown): number => Number(v) || 0;
const nOuNulo = (v: unknown): number | null => (v == null ? null : Number(v));
const s = (v: unknown): string | null => (v == null ? null : String(v));

async function lerProtocolos(de: string, ate: string): Promise<ProtocoloDevolucao[]> {
  const rows = await queryWinthor<Record<string, unknown>>(sqlProtocolos, { de, ate });
  return rows.map((r) => ({
    protocolo: n(r.PROTOCOLO),
    grupo: nOuNulo(r.GRUPO),
    rotulo: s(r.ROTULO),
    notaDevolucao: nOuNulo(r.NOTA_DEVOLUCAO),
    valor: n(r.VALOR),
    codcli: nOuNulo(r.CODCLI),
    cliente: s(r.CLIENTE),
    pedido: nOuNulo(r.PEDIDO),
    carga: nOuNulo(r.CARGA),
    codMotorista: nOuNulo(r.COD_MOTORISTA),
    motorista: s(r.MOTORISTA),
    criado: s(r.CRIADO),
    finalizado: n(r.FINALIZADO) === 1,
    noPeriodo: n(r.NO_PERIODO) === 1,
    horasAberto: nOuNulo(r.H_ABERTO),
    horasAteConferir: nOuNulo(r.H_CONF),
    horasAteEndereco: nOuNulo(r.H_END),
    horasAteFinalizar: nOuNulo(r.H_FIN),
    itens: n(r.ITENS),
    itensAvaria: n(r.ITENS_AVARIA),
    qtdAvaria: n(r.QTD_AVARIA),
  }));
}

async function lerPlanilhas(): Promise<PlanilhaAgrupamento[]> {
  const rows = await queryWinthor<Record<string, unknown>>(sqlPlanilhas);
  return rows.map((r) => ({
    grupo: n(r.GRUPO),
    itens: n(r.ITENS),
    itensConferidos: n(r.ITENS_CONF),
    itensDivergentes: n(r.ITENS_DIV),
    itensFalta: n(r.ITENS_FALTA),
    itensSobra: n(r.ITENS_SOBRA),
    qtdFalta: n(r.QTD_FALTA),
    qtdSobra: n(r.QTD_SOBRA),
  }));
}

const TTL = 5 * 60_000; // o "em aberto" muda o dia todo: no máximo 5 min de atraso

/** Protocolos + planilhas (abertos de até 1 ano e criados no período). */
export function getProtocolosDevolucao(de: string, ate: string) {
  return lembrar(`protocolosDevolucao:${de}|${ate}`, TTL, async () => {
    const [protocolos, planilhas] = await Promise.all([lerProtocolos(de, ate), lerPlanilhas()]);
    return { protocolos, planilhas };
  });
}

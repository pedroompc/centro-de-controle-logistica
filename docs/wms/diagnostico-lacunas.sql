-- =====================================================================
-- Diagnóstico das lacunas da /galpao — SOMENTE LEITURA (HARPIAW2)
-- =====================================================================
-- A página abriu, mas 3 indicadores vieram vazios e 1 veio suspeito:
--   L1) Separação por carga: nenhuma carga com início de separação/conferência
--   L2) Abastecimentos: ~zero movimentos TIPO 'S' efetivados
--   L3) Linhas por hora: nenhuma tarefa de coletor
--   L4) Cargas: 4.195 em ago/26 — confirmado que um caminhão leva várias cargas;
--       o bloco L1 (coluna "placas") mostra se a placa vem preenchida p/ contar viagens
-- Rode cada bloco e mande o resultado.
-- =====================================================================


-- L1 + L4) O que está preenchido na CARREG_VEIC_38 em ago/26?
SELECT COUNT(*)                                   AS linhas,
       COUNT(DISTINCT TRUNC(DT_CARREG_PK_38))     AS dias,
       COUNT(DISTINCT PLACA_VEIC_FK_38)           AS placas,
       COUNT(NULLIF(PESO_CARREG_38, 0))           AS com_peso_carreg,
       COUNT(NULLIF(PESO_BRUTO_CARGA_38, 0))      AS com_peso_bruto,
       COUNT(NULLIF(PESO_VEIC_38, 0))             AS com_peso_veic,
       COUNT(NULLIF(VOL_CARREG_38, 0))            AS com_volumes,
       COUNT(DT_HR_INICIO_SEPARACAO_38)           AS com_ini_sep,
       COUNT(DT_HR_INICIO_CONFERENCIA_38)         AS com_ini_conf,
       COUNT(DT_HR_FECHAMENTO_CARGA_38)           AS com_fechamento,
       COUNT(FECH_DTHR_38)                        AS com_fech_dthr,
       COUNT(DT_SAIDA_38)                         AS com_dt_saida,
       COUNT(RESP_DTHR_38)                        AS com_resp_dthr
  FROM HARPIAW2.CARREG_VEIC_38
 WHERE EMPRESA_PF_38 = 1
   AND DT_CARREG_PK_38 >= DATE '2026-08-01' AND DT_CARREG_PK_38 < DATE '2026-09-01';

-- L4b) Distribuição por tipo/status/origem — revela o que é "carga" aqui.
SELECT STATUS_CARREG_38, TIPO_PLAN_38, ORIGEM_38, COUNT(*) AS qtd
  FROM HARPIAW2.CARREG_VEIC_38
 WHERE EMPRESA_PF_38 = 1
   AND DT_CARREG_PK_38 >= DATE '2026-08-01' AND DT_CARREG_PK_38 < DATE '2026-09-01'
 GROUP BY STATUS_CARREG_38, TIPO_PLAN_38, ORIGEM_38
 ORDER BY 4 DESC;

-- L1b) 10 cargas recentes com todas as datas/horas (para ver o que o Harpia grava).
SELECT CARREG_PK_38, DT_CARREG_PK_38, STATUS_CARREG_38, PLACA_VEIC_FK_38,
       PESO_CARREG_38, PESO_BRUTO_CARGA_38, VOL_CARREG_38,
       DT_HR_INICIO_SEPARACAO_38, DT_HR_INICIO_CONFERENCIA_38, DT_HR_FECHAMENTO_CARGA_38,
       FECH_DTHR_38, DT_SAIDA_38, RESP_DTHR_38, VEIC_CARREG_DTHR_38, DT_HR_RETORNO_ERP_38
  FROM (SELECT * FROM HARPIAW2.CARREG_VEIC_38
         WHERE EMPRESA_PF_38 = 1 AND DT_CARREG_PK_38 >= DATE '2026-08-01'
         ORDER BY DT_CARREG_PK_38 DESC)
 WHERE ROWNUM <= 10;


-- L2) Abastecimento: em que tipo/status os movimentos estão caindo?
SELECT TO_CHAR(TRUNC(NVL(DT_FIN_502, DT_MOVIMENT_502), 'MM'), 'YYYY-MM') AS mes,
       TIPO_MOVIMENT_502 AS tipo, STATUS_502 AS status, COUNT(*) AS qtd,
       COUNT(DT_FIN_502) AS com_dt_fin
  FROM HARPIAW2.MOVIMENT_END_502
 WHERE EMPRESA_PF_502 = 1
   AND NVL(DT_FIN_502, DT_MOVIMENT_502) >= DATE '2026-03-01'
 GROUP BY TO_CHAR(TRUNC(NVL(DT_FIN_502, DT_MOVIMENT_502), 'MM'), 'YYYY-MM'), TIPO_MOVIMENT_502, STATUS_502
 ORDER BY 1 DESC, 2, 3;

-- L2b) Abastecimento pelo lado da preparação (PREPARA_ABAST_809), por mês e status.
SELECT TO_CHAR(TRUNC(PREP_DTHR_809, 'MM'), 'YYYY-MM') AS mes, STATUS_809, COUNT(*) AS qtd
  FROM HARPIAW2.PREPARA_ABAST_809
 WHERE ID_EMP_PF_809 = 1 AND PREP_DTHR_809 >= DATE '2026-03-01'
 GROUP BY TO_CHAR(TRUNC(PREP_DTHR_809, 'MM'), 'YYYY-MM'), STATUS_809
 ORDER BY 1 DESC, 2;


-- L3) Coletor: existe separação por coletor? Em qual empresa? Até quando?
SELECT EMPRESA_PF_1275 AS empresa,
       TO_CHAR(TRUNC(DT_HR_SEP_INI_1275, 'MM'), 'YYYY-MM') AS mes,
       COUNT(*) AS tarefas,
       COUNT(DT_HR_SEP_FIM_1275) AS com_fim,
       COUNT(DT_HR_SEP_INI_1275) AS com_ini,
       MAX(LIST_DTHR_1275) AS ultima_listagem
  FROM HARPIAW2.PLAN_SEP_COLETOR_1275
 GROUP BY EMPRESA_PF_1275, TO_CHAR(TRUNC(DT_HR_SEP_INI_1275, 'MM'), 'YYYY-MM')
 ORDER BY 2 DESC NULLS FIRST, 1;

-- L3b) Tempo por item no coletor (1276 tem início/fim por item).
SELECT TO_CHAR(TRUNC(DT_HR_INI_1276, 'MM'), 'YYYY-MM') AS mes, COUNT(*) AS itens,
       COUNT(DT_HR_FIM_1276) AS com_fim
  FROM HARPIAW2.PLAN_SEP_COLETOR_MERC_1276
 WHERE DT_HR_INI_1276 >= DATE '2026-03-01'
 GROUP BY TO_CHAR(TRUNC(DT_HR_INI_1276, 'MM'), 'YYYY-MM')
 ORDER BY 1 DESC;

-- =====================================================================
-- Validação dos KPIs da página /galpao — SOMENTE LEITURA (HARPIAW2)
-- =====================================================================
-- Rode logado como o DB_USER do app. Compare com o que você conhece da
-- operação / com os relatórios do próprio Harpia. Cada bloco testa UMA
-- premissa da página; se alguma estiver errada, me mande o resultado.
-- =====================================================================


-- V1) Premissa: nível = 5º e 6º dígitos do endereço (RR PP NN AAA).
--     Esperado: níveis baixos (01, 02, 03...) com muito volume; se aparecer
--     88/99/77 com volume alto, são endereços virtuais que precisam sair.
SELECT SUBSTR(END_PF_502, 5, 2) AS nivel, COUNT(*) AS qtd
  FROM HARPIAW2.MOVIMENT_END_502
 WHERE EMPRESA_PF_502 = 1 AND STATUS_502 = '2'
   AND NVL(DT_FIN_502, DT_MOVIMENT_502) >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -3)
 GROUP BY SUBSTR(END_PF_502, 5, 2)
 ORDER BY 2 DESC;

-- V1b) Ruas marcadas como virtuais (devem ser as 77/88/99 da amostra).
SELECT PRIM_GRAU_END_PK_611, DESCR_611, SN_VIRTUAL_611
  FROM HARPIAW2.PRIM_GRAU_END_611
 WHERE EMPRESA_PF_611 = 1
 ORDER BY 1;


-- V2) Premissa: MOVIMENT_END_502 guarda o histórico (não é só o mês atual).
--     Esperado: volume parecido mês a mês desde 2025.
SELECT TO_CHAR(TRUNC(NVL(DT_FIN_502, DT_MOVIMENT_502), 'MM'), 'YYYY-MM') AS mes,
       TIPO_MOVIMENT_502 AS tipo, STATUS_502 AS status, COUNT(*) AS qtd
  FROM HARPIAW2.MOVIMENT_END_502
 WHERE EMPRESA_PF_502 = 1
 GROUP BY TO_CHAR(TRUNC(NVL(DT_FIN_502, DT_MOVIMENT_502), 'MM'), 'YYYY-MM'), TIPO_MOVIMENT_502, STATUS_502
 ORDER BY 1 DESC, 2, 3;


-- V3) Premissa: PESO_502 é o peso TOTAL da movimentação em kg.
--     Compara com quantidade × peso bruto do cadastro. Se PESO_502 bater com
--     QTD × PESO_BRUT, é kg total; se bater com PESO_BRUT, é unitário.
SELECT m.TIPO_MOVIMENT_502, m.QTD_502, m.INVOL_PADRAO_MERC_502, m.PESO_502,
       p.PESO_BRUT_461, p.PESO_LIQ_461,
       m.QTD_502 * p.PESO_BRUT_461 AS qtd_x_peso_brut
  FROM HARPIAW2.MOVIMENT_END_502 m
  JOIN HARPIAW2.MERCADORIA_461 p ON p.MERC_PK_461 = m.MERC_PF_502
 WHERE m.EMPRESA_PF_502 = 1 AND m.STATUS_502 = '2' AND ROWNUM <= 30;


-- V4) Premissa: CARREG_VEIC_38 = cargas de SAÍDA, uma linha por carga;
--     PESO_CARREG_38 em kg; datas de separação preenchidas.
--     Compare o peso do mês com o peso faturado do dashboard (WinThor).
SELECT TO_CHAR(TRUNC(DT_CARREG_PK_38, 'MM'), 'YYYY-MM') AS mes,
       STATUS_CARREG_38 AS status,
       COUNT(*) AS cargas,
       SUM(PESO_CARREG_38) AS peso_carreg,
       SUM(PESO_BRUTO_CARGA_38) AS peso_bruto,
       COUNT(DT_HR_INICIO_SEPARACAO_38) AS com_inicio_sep,
       COUNT(DT_HR_INICIO_CONFERENCIA_38) AS com_inicio_conf,
       COUNT(DT_HR_FECHAMENTO_CARGA_38) AS com_fechamento
  FROM HARPIAW2.CARREG_VEIC_38
 WHERE EMPRESA_PF_38 = 1 AND DT_CARREG_PK_38 >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -6)
 GROUP BY TO_CHAR(TRUNC(DT_CARREG_PK_38, 'MM'), 'YYYY-MM'), STATUS_CARREG_38
 ORDER BY 1 DESC, 2;


-- V5) Premissa: PLAN_SEP_MAPA_1195.CARGA_1195 = CARREG_VEIC_38.CARREG_PK_38.
--     Esperado: quase todas as planilhas recentes acham a carga.
SELECT COUNT(*) AS planilhas,
       COUNT(c.CARREG_PK_38) AS com_carga_encontrada
  FROM HARPIAW2.PLAN_SEP_MAPA_1195 p
  LEFT JOIN HARPIAW2.CARREG_VEIC_38 c
    ON c.EMPRESA_PF_38 = p.EMPRESA_PF_1195 AND c.CARREG_PK_38 = p.CARGA_1195
 WHERE p.EMPRESA_PF_1195 = 1
   AND p.SEQ_PLANILHA_PK_1195 > (SELECT MAX(SEQ_PLANILHA_PK_1195) - 2000 FROM HARPIAW2.PLAN_SEP_MAPA_1195);


-- V6) Cobertura do coletor: quanto da separação passa pelo coletor?
--     Se for pouco, "linhas por hora" representa só uma parte da equipe.
SELECT TO_CHAR(TRUNC(DT_HR_SEP_INI_1275, 'MM'), 'YYYY-MM') AS mes,
       ORIGEM_1275 AS origem, COUNT(*) AS tarefas,
       COUNT(DISTINCT USU_SEPARADOR_FK_1275) AS separadores,
       ROUND(MEDIAN((DT_HR_SEP_FIM_1275 - DT_HR_SEP_INI_1275) * 1440), 1) AS mediana_min
  FROM HARPIAW2.PLAN_SEP_COLETOR_1275
 WHERE EMPRESA_PF_1275 = 1 AND DT_HR_SEP_INI_1275 >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -3)
 GROUP BY TO_CHAR(TRUNC(DT_HR_SEP_INI_1275, 'MM'), 'YYYY-MM'), ORIGEM_1275
 ORDER BY 1 DESC, 2;

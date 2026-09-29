-- =====================================================================
-- Descoberta do WMS — RODADA 3: RECEBIMENTO + TURNO POR OPERADOR
-- =====================================================================
-- Objetivo: saber se o Harpia/WinThor grava os eventos do recebimento com
-- DATA E HORA (chegada, início/fim do descarrego, conferência, armazenagem)
-- e inferir o turno real de cada operador pelo horário em que ele trabalha.
-- Somente leitura. Rode bloco a bloco, exporte e mande de volta.
-- :emp = 1
-- =====================================================================


-- A) Tabelas do HARPIAW2 com cara de recebimento (nome OU comentário).
SELECT t.table_name, t.num_rows, tc.comments
  FROM all_tables t
  LEFT JOIN all_tab_comments tc ON tc.owner = t.owner AND tc.table_name = t.table_name
 WHERE t.owner = 'HARPIAW2'
   AND (REGEXP_LIKE(t.table_name, 'RECEB|ENTRAD|NF_?ENT|NOTA_ENT|CONF_?ENT|DOCA|PORTAR|AGEND|VEIC|ARMAZ|PALET|ETIQ|DESCARG|FORNEC', 'i')
        OR REGEXP_LIKE(tc.comments, 'receb|entrada|descarg|doca|portaria|agenda|armazen|fornecedor', 'i'))
 ORDER BY t.num_rows DESC NULLS LAST;


-- B) Colunas de DATA/HORA, PESO, PLACA e USUÁRIO dessas tabelas (com comentário).
--    É aqui que se descobre se existe "início do descarrego" / "fim da conferência".
SELECT c.table_name, c.column_name, c.data_type, cc.comments
  FROM all_tab_columns c
  LEFT JOIN all_col_comments cc
         ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
 WHERE c.owner = 'HARPIAW2'
   AND REGEXP_LIKE(c.table_name, 'RECEB|ENTRAD|NF_?ENT|NOTA_ENT|CONF_?ENT|DOCA|PORTAR|AGEND|DESCARG', 'i')
   AND (c.data_type = 'DATE' OR c.data_type LIKE 'TIMESTAMP%'
        OR REGEXP_LIKE(c.column_name, 'PESO|PLACA|VEIC|USU|STATUS|NF|NOTA|FORN', 'i'))
 ORDER BY c.table_name, c.column_id;


-- C) Integração WinThor → Harpia (schema HARPIAW): NF de entrada.
SELECT c.table_name, c.column_name, c.data_type
  FROM all_tab_columns c
 WHERE c.owner = 'HARPIAW' AND c.table_name LIKE 'HW_NFENT%'
 ORDER BY c.table_name, c.column_id;
SELECT * FROM HARPIAW.HW_NFENT WHERE ROWNUM <= 5;


-- D) A armazenagem (MOVIMENT_END_502 tipo 'E') aponta para a NF/recebimento?
--    Lista as FKs da 502 — se houver uma para recebimento, dá para medir
--    "fim do descarrego → produto endereçado" por NOTA.
SELECT a.constraint_name, a.column_name, c_pk.table_name AS tabela_referenciada
  FROM all_cons_columns a
  JOIN all_constraints c    ON c.owner = a.owner AND c.constraint_name = a.constraint_name
  JOIN all_constraints c_pk ON c_pk.owner = c.r_owner AND c_pk.constraint_name = c.r_constraint_name
 WHERE a.owner = 'HARPIAW2' AND a.table_name = 'MOVIMENT_END_502' AND c.constraint_type = 'R';


-- E) WinThor PCNFENT: quais colunas de data/hora, peso e veículo existem?
SELECT column_name, data_type
  FROM all_tab_columns
 WHERE table_name = 'PCNFENT'
   AND REGEXP_LIKE(column_name, 'DT|DATA|HORA|PESO|PLACA|VEIC|MOTOR|CONFER|FORNEC|ESPECIE|TIPODESCARGA', 'i')
 ORDER BY column_name;


-- F) TURNO REAL POR OPERADOR (não depende da planilha do RH).
--    "Dia operacional" começa às 07h (dt - 7/24) para o turno da noite não
--    ser partido na meia-noite. Para cada login: dias trabalhados, hora
--    mediana do 1º e do último movimento. Com isso o turno sai do próprio
--    dado: 1º mov. ~07h = Manhã, ~13h = Tarde, ~22h = Noite.
WITH d AS (
  SELECT NVL(m.USU_EFETIV_FK_502, m.USU_FK_502) USU,
         TRUNC(m.DT_FIN_502 - 7/24) DIA_OP,
         MIN(m.DT_FIN_502) PRIM,
         MAX(m.DT_FIN_502) ULT,
         COUNT(*) MOVS
    FROM HARPIAW2.MOVIMENT_END_502 m
   WHERE m.EMPRESA_PF_502 = 1
     AND m.STATUS_502 = '2'
     AND m.DT_FIN_502 >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -2)
     AND m.DT_FIN_502 <> TRUNC(m.DT_FIN_502)
   GROUP BY NVL(m.USU_EFETIV_FK_502, m.USU_FK_502), TRUNC(m.DT_FIN_502 - 7/24)
)
SELECT d.USU,
       MAX(NVL(TRIM(u.DESCR_COMPLETO_754), u.DESCR_754)) NOME,
       COUNT(*) DIAS,
       ROUND(AVG(d.MOVS)) MOVS_DIA,
       -- horas contadas a partir das 07h (0 = 07h, 6 = 13h, 15 = 22h)
       ROUND(MEDIAN((d.PRIM - (d.DIA_OP + 7/24)) * 24), 1) H_INICIO_DESDE_7H,
       ROUND(MEDIAN((d.ULT  - (d.DIA_OP + 7/24)) * 24), 1) H_FIM_DESDE_7H,
       ROUND(MEDIAN((d.ULT - d.PRIM) * 24), 1)              H_ATIVO_MEDIANA
  FROM d
  LEFT JOIN HARPIAW2.USUARIO_754 u ON u.USU_PK_754 = d.USU
 GROUP BY d.USU
 ORDER BY H_INICIO_DESDE_7H;


-- G) Mesma coisa para o SEPARADOR (coletor) — o setor de separação também tem turno.
WITH d AS (
  SELECT c.USU_FK_1275 USU, TRUNC(c.DT_HR_SEP_INI_1275 - 7/24) DIA_OP,
         MIN(c.DT_HR_SEP_INI_1275) PRIM, MAX(c.DT_HR_SEP_INI_1275) ULT, COUNT(*) TAREFAS
    FROM HARPIAW2.PLAN_SEP_COLETOR_1275 c
   WHERE c.DT_HR_SEP_INI_1275 >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -2)
   GROUP BY c.USU_FK_1275, TRUNC(c.DT_HR_SEP_INI_1275 - 7/24)
)
SELECT USU, COUNT(*) DIAS, ROUND(AVG(TAREFAS)) TAREFAS_DIA,
       ROUND(MEDIAN((PRIM - (DIA_OP + 7/24)) * 24), 1) H_INICIO_DESDE_7H,
       ROUND(MEDIAN((ULT  - (DIA_OP + 7/24)) * 24), 1) H_FIM_DESDE_7H
  FROM d GROUP BY USU ORDER BY H_INICIO_DESDE_7H;
-- ⚠️ Se USU_FK_1275 não existir, troque pelo nome real da coluna de usuário
--    (está na rodada 2, bloco A).

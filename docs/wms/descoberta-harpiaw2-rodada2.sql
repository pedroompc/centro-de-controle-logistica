-- =====================================================================
-- Descoberta do WMS — RODADA 2 (schema HARPIAW2, o de produção)
-- =====================================================================
-- A rodada 1 mostrou: HARPIAW2 = produção (2.082 tabelas, ~41 mi linhas);
-- HARPIAW = 7 tabelas de integração (HW_PDSAI etc.), fora do escopo.
-- Somente leitura. Exporte cada bloco e mande de volta.
-- =====================================================================


-- A) Colunas + comentários das tabelas candidatas (a mais importante).
--    Se o Harpia documentou as colunas, COMENTARIO já traz o significado.
SELECT c.table_name, c.column_id, c.column_name, c.data_type, c.data_length,
       cc.comments AS comentario
  FROM all_tab_columns c
  LEFT JOIN all_col_comments cc
         ON cc.owner = c.owner AND cc.table_name = c.table_name AND cc.column_name = c.column_name
 WHERE c.owner = 'HARPIAW2'
   AND c.table_name IN (
       -- movimentação de endereço (horizontal/vertical) e abastecimento
       'MOVIMENT_END_502', 'MIRROR_502', 'MOVIMENT_END_FUNC_503',
       'PREPARA_ABAST_809', 'PREPARA_ABAST_MERC_1361', 'MOV_ABAST_TEMP_863',
       -- endereço e seus níveis ("graus")
       'DEPOSIT_EMPRESA_END_179', 'GRAU_END_318', 'PRIM_GRAU_END_611',
       'SEG_GRAU_END_1141', 'TAM_END_719',
       -- produto / SKU / saldo
       'MERCADORIA_461', 'MERC_EMPRESA_468', 'LT_ESTOQ_MERC_447', 'MERC_EMPRESA_END_470',
       -- separação (mapa + coletor)
       'PLAN_SEP_MAPA_1195', 'PLAN_SEP_MAPA_MERC_1196',
       'PLAN_SEP_COLETOR_1275', 'PLAN_SEP_COLETOR_MERC_1276',
       -- carga e usuário
       'CARREG_VEIC_38', 'NUM_CARREG_1140', 'USUARIO_754', 'PRODUTIVIDADE_1263')
 ORDER BY c.table_name, c.column_id;


-- B) Comentários das tabelas (o que o Harpia diz que cada uma é).
SELECT table_name, comments
  FROM all_tab_comments
 WHERE owner = 'HARPIAW2'
   AND comments IS NOT NULL
   AND REGEXP_LIKE(table_name, 'MOVIMENT_END|MIRROR_502|ABAST|GRAU_END|DEPOSIT_EMPRESA_END|PLAN_SEP|MERCADORIA|MERC_EMPRESA|CARREG|PRODUTIV')
 ORDER BY table_name;


-- C) 5 linhas de amostra de cada tabela-chave (rodar uma por vez).
--    Serve para eu ver o formato real dos códigos de tipo e de endereço.
--    Se alguma coluna tiver nome de pessoa, pode apagar antes de mandar.
SELECT * FROM HARPIAW2.MOVIMENT_END_502        WHERE ROWNUM <= 5;
SELECT * FROM HARPIAW2.MIRROR_502              WHERE ROWNUM <= 5;
SELECT * FROM HARPIAW2.GRAU_END_318;                               -- 9 linhas, pode vir tudo
SELECT * FROM HARPIAW2.DEPOSIT_EMPRESA_END_179 WHERE ROWNUM <= 5;
SELECT * FROM HARPIAW2.PREPARA_ABAST_809       WHERE ROWNUM <= 5;
SELECT * FROM HARPIAW2.PLAN_SEP_MAPA_1195      WHERE ROWNUM <= 5;
SELECT * FROM HARPIAW2.PLAN_SEP_COLETOR_1275   WHERE ROWNUM <= 5;

-- =====================================================================
-- Descoberta do schema do WMS (HARPIAW / HARPIAW2) — SOMENTE LEITURA
-- =====================================================================
-- Rodar no mesmo cliente SQL do print, LOGADO COMO O USUÁRIO DO APP
-- (o mesmo DB_USER do .env.local). Se as consultas 1 e 2 voltarem vazias
-- para esse usuário, o app não enxerga o WMS e precisa de GRANT SELECT.
--
-- Exporte o resultado de cada bloco (CSV ou print) e mande de volta.
-- Nada aqui altera dados: só dicionário do Oracle + COUNT/MIN/MAX.
-- =====================================================================


-- 1) Qual dos dois schemas é o de produção?
--    O "vivo" tem mais tabelas com linhas e estatísticas recentes.
SELECT owner,
       COUNT(*)                      AS qtd_tabelas,
       SUM(NVL(num_rows, 0))         AS linhas_estimadas,
       MAX(last_analyzed)            AS ultima_estatistica
  FROM all_tables
 WHERE owner IN ('HARPIAW', 'HARPIAW2')
 GROUP BY owner;


-- 2) Tabelas do WMS, maiores primeiro (as de movimento costumam ser as maiores).
SELECT owner, table_name, num_rows, last_analyzed
  FROM all_tables
 WHERE owner IN ('HARPIAW', 'HARPIAW2')
 ORDER BY num_rows DESC NULLS LAST;


-- 3) Candidatas por nome: movimentação, endereço, separação, onda, tarefa,
--    estoque, produto, pedido/carga, operador.
SELECT owner, table_name, num_rows
  FROM all_tables
 WHERE owner IN ('HARPIAW', 'HARPIAW2')
   AND REGEXP_LIKE(table_name,
       'MOV|ENDER|END_|LOCAL|SEPAR|PICK|ONDA|TAREFA|TASK|ORDEM|OS_|ESTOQ|SALDO|PROD|SKU|ITEM|PEDID|CARGA|CARREG|EXPED|CONFER|REABAST|ARMAZ|TRANSF|OPERAD|USUAR|FUNC')
 ORDER BY owner, num_rows DESC NULLS LAST;


-- 4) Colunas das tabelas candidatas. Troque a lista pelo que aparecer no bloco 3.
--    O que procuro: datas/horas (início e fim), tipo de movimento, endereço
--    origem/destino, nível/andar, código do produto, quantidade, peso, operador.
SELECT table_name, column_id, column_name, data_type, data_length, nullable
  FROM all_tab_columns
 WHERE owner = 'HARPIAW'                        -- ou HARPIAW2, conforme o bloco 1
   AND table_name IN ('TROCAR_TABELA_1', 'TROCAR_TABELA_2')
 ORDER BY table_name, column_id;


-- 5) Colunas de DATA em todo o schema: onde tem timestamp, tem tempo de separação.
SELECT table_name, column_name, data_type
  FROM all_tab_columns
 WHERE owner = 'HARPIAW'
   AND data_type IN ('DATE', 'TIMESTAMP(6)', 'TIMESTAMP(3)')
 ORDER BY table_name, column_name;


-- 6) Colunas que parecem "tipo de movimento" ou "nível do endereço".
--    Movimento vertical × horizontal é definido por uma delas.
SELECT table_name, column_name, data_type
  FROM all_tab_columns
 WHERE owner = 'HARPIAW'
   AND REGEXP_LIKE(column_name, 'TIPO|TP_|NIVEL|ANDAR|ALTURA|RUA|PREDIO|APTO|ORIGEM|DESTINO|STATUS|SITUAC')
 ORDER BY table_name, column_name;


-- 7) Tabelas que o usuário do app PODE ler (se vazio → pedir GRANT ao DBA).
SELECT table_schema, table_name, privilege
  FROM all_tab_privs
 WHERE table_schema IN ('HARPIAW', 'HARPIAW2')
 ORDER BY table_schema, table_name;


-- 8) Depois de achar a tabela de movimentação, rode isto nela para ver
--    os tipos de movimento que existem e o volume de cada um por mês:
-- SELECT TRUNC(<coluna_data>, 'MM') AS mes, <coluna_tipo> AS tipo, COUNT(*) AS qtd
--   FROM HARPIAW.<tabela_mov>
--  WHERE <coluna_data> >= ADD_MONTHS(TRUNC(SYSDATE, 'MM'), -6)
--  GROUP BY TRUNC(<coluna_data>, 'MM'), <coluna_tipo>
--  ORDER BY 1, 3 DESC;

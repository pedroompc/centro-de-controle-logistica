-- =====================================================================
-- Descoberta do CICLO DO PEDIDO — SOMENTE LEITURA (WinThor + Harpia)
-- =====================================================================
-- Objetivo: saber quais eventos do pedido têm DATA E HORA gravadas, para
-- montar a linha do tempo pedido → liberação → carga → WMS → nota → saída.
-- Rode logado como o DB_USER do app. Se algum bloco der ORA-00904
-- (coluna inválida), apague a coluna citada no erro e rode de novo.
-- =====================================================================


-- C1) Colunas de data nas tabelas do ciclo (WinThor + Harpia).
SELECT owner, table_name, column_name, data_type
  FROM all_tab_columns
 WHERE table_name IN ('PCPEDC', 'PCCARREG', 'PCNFSAID', 'CARREG_VEIC_38', 'HW_PDSAI',
                      'PED_CARGA_LIB_FAT_ERP_1333')
   AND (data_type LIKE 'DATE%' OR data_type LIKE 'TIMESTAMP%'
        OR column_name LIKE '%HORA%' OR column_name LIKE '%MINUTO%')
 ORDER BY table_name, column_name;


-- C2) PCPEDC: quanto está preenchido e se as datas têm hora (ago/26).
--     "*_com_hora" > 0 = a coluna grava hora; = 0 = só data (não mede horas).
SELECT COUNT(*)                                                    AS pedidos,
       COUNT(DTLIBERA)                                             AS com_dtlibera,
       SUM(CASE WHEN DATA     <> TRUNC(DATA)     THEN 1 ELSE 0 END) AS data_com_hora,
       SUM(CASE WHEN DTLIBERA <> TRUNC(DTLIBERA) THEN 1 ELSE 0 END) AS dtlibera_com_hora,
       SUM(CASE WHEN DTFAT    <> TRUNC(DTFAT)    THEN 1 ELSE 0 END) AS dtfat_com_hora,
       COUNT(NUMCAR)                                               AS com_numcar,
       COUNT(HORA)                                                 AS com_campo_hora,
       COUNT(MINUTO)                                               AS com_campo_minuto
  FROM PCPEDC
 WHERE DATA >= DATE '2026-08-01' AND DATA < DATE '2026-09-01';


-- C3) PCCARREG: datas da carga (ago/26).
SELECT COUNT(*)                                                     AS cargas,
       COUNT(DATAMON)                                               AS com_datamon,
       SUM(CASE WHEN DATAMON <> TRUNC(DATAMON) THEN 1 ELSE 0 END)   AS datamon_com_hora,
       COUNT(DTSAIDA)                                               AS com_dtsaida,
       SUM(CASE WHEN DTSAIDA <> TRUNC(DTSAIDA) THEN 1 ELSE 0 END)   AS dtsaida_com_hora,
       COUNT(DTFAT)                                                 AS com_dtfat,
       COUNT(DTRETORNO)                                             AS com_dtretorno
  FROM PCCARREG
 WHERE DTSAIDA >= DATE '2026-08-01' AND DTSAIDA < DATE '2026-09-01';


-- C4) PCNFSAID: entrega e canhoto (ago/26).
SELECT COUNT(*)                   AS notas,
       COUNT(DTHORAAUTORIZACAOSEFAZ) AS com_autorizacao,
       COUNT(DTENTREGA)           AS com_dtentrega,
       COUNT(DTCANHOTO)           AS com_dtcanhoto
  FROM PCNFSAID
 WHERE DTSAIDA >= DATE '2026-08-01' AND DTSAIDA < DATE '2026-09-01';


-- C5) Harpia: a carga do WMS é o mesmo número do carregamento do WinThor?
--     Se casar, dá para ligar o tempo do armazém ao pedido e à nota.
SELECT COUNT(*)                AS cargas_wms,
       COUNT(p.NUMCAR)         AS casam_com_pccarreg
  FROM HARPIAW2.CARREG_VEIC_38 c
  LEFT JOIN PCCARREG p ON p.NUMCAR = c.CARREG_PK_38
 WHERE c.EMPRESA_PF_38 = 1
   AND c.DT_CARREG_PK_38 >= DATE '2026-08-01' AND c.DT_CARREG_PK_38 < DATE '2026-09-01';


-- C6) Harpia: eventos da carga com hora (ago/26).
SELECT COUNT(*)                            AS cargas,
       COUNT(DT_INTERNALIZACAO_CARGA_38)   AS com_entrada_wms,
       COUNT(DT_HR_INICIO_SEPARACAO_38)    AS com_ini_separacao,
       COUNT(DT_HR_INICIO_CONFERENCIA_38)  AS com_ini_conferencia,
       COUNT(DT_HR_FECHAMENTO_CARGA_38)    AS com_fechamento,
       COUNT(DT_HR_RETORNO_ERP_38)         AS com_retorno_erp,
       COUNT(DT_SAIDA_38)                  AS com_saida,
       COUNT(VEIC_CARREG_DTHR_38)          AS com_carregamento_veiculo
  FROM HARPIAW2.CARREG_VEIC_38
 WHERE EMPRESA_PF_38 = 1
   AND DT_CARREG_PK_38 >= DATE '2026-08-01' AND DT_CARREG_PK_38 < DATE '2026-09-01';


-- C7) 20 pedidos faturados em ago/26 com a linha do tempo completa lado a lado.
--     É o teste de verdade: olhando essas linhas dá para ver quais etapas existem.
SELECT * FROM (
  SELECT ped.NUMPED,
         TO_CHAR(ped.DATA, 'DD/MM HH24:MI')               AS pedido,
         ped.HORA || ':' || ped.MINUTO                    AS hora_min_pedido,
         TO_CHAR(ped.DTLIBERA, 'DD/MM HH24:MI')           AS liberado,
         ped.NUMCAR,
         TO_CHAR(car.DATAMON, 'DD/MM HH24:MI')            AS carga_montada,
         TO_CHAR(w.DT_INTERNALIZACAO_CARGA_38, 'DD/MM HH24:MI') AS entrou_wms,
         TO_CHAR(w.DT_HR_FECHAMENTO_CARGA_38, 'DD/MM HH24:MI')  AS fechou_wms,
         TO_CHAR(w.DT_HR_RETORNO_ERP_38, 'DD/MM HH24:MI') AS voltou_erp,
         TO_CHAR(nf.DTHORAAUTORIZACAOSEFAZ, 'DD/MM HH24:MI') AS nota_autorizada,
         TO_CHAR(car.DTSAIDA, 'DD/MM HH24:MI')            AS saida_carga
    FROM PCPEDC ped
    JOIN PCNFSAID nf ON nf.NUMPED = ped.NUMPED
    LEFT JOIN PCCARREG car ON car.NUMCAR = ped.NUMCAR
    LEFT JOIN HARPIAW2.CARREG_VEIC_38 w ON w.EMPRESA_PF_38 = 1 AND w.CARREG_PK_38 = ped.NUMCAR
   WHERE ped.DTFAT >= DATE '2026-08-18' AND ped.DTFAT < DATE '2026-08-20'
   ORDER BY ped.NUMPED DESC
) WHERE ROWNUM <= 20;

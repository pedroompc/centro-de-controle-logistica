-- =====================================================================
-- Validação da aba Produtos (/galpao?aba=produtos)
-- Somente leitura. Rode e confira antes de confiar nos números.
-- =====================================================================

-- V1) Código do WMS = código do WinThor?  Compara a descrição dos dois lados.
--     Se as descrições NÃO baterem, a aba está mostrando o nome errado.
SELECT m.MERC_PK_461, p.CODPROD, p.DESCRICAO
  FROM HARPIAW2.MERCADORIA_461 m
  LEFT JOIN PCPRODUT p ON p.CODPROD = m.MERC_PK_461
 WHERE ROWNUM <= 20;
-- e as colunas da 461 (procure descrição, código ERP, lastro/camada/norma):
SELECT column_name, data_type FROM all_tab_columns
 WHERE owner = 'HARPIAW2' AND table_name IN ('MERCADORIA_461', 'MERC_EMPRESA_468', 'MERC_EMPRESA_END_470')
 ORDER BY table_name, column_id;

-- V2) Paletização de cadastro no WinThor existe e está preenchida?
SELECT COUNT(*) produtos,
       COUNT(NULLIF(LASTROPAL, 0)) com_lastro,
       COUNT(NULLIF(ALTURAPAL, 0)) com_camadas,
       COUNT(NULLIF(QTTOTPAL, 0))  com_total
  FROM PCPRODUT WHERE DTEXCLUSAO IS NULL;

-- V3) Unidade da QTD_502 numa armazenagem: caixa ou unidade?
--     Compare QTD com QTUNITCX (unidades por caixa) e QTTOTPAL de um produto que você conhece.
SELECT m.MERC_PF_502, m.QTD_502, m.INVOL_PADRAO_MERC_502, p.QTUNITCX, p.LASTROPAL, p.ALTURAPAL, p.QTTOTPAL
  FROM HARPIAW2.MOVIMENT_END_502 m
  JOIN PCPRODUT p ON p.CODPROD = m.MERC_PF_502
 WHERE m.EMPRESA_PF_502 = 1 AND m.STATUS_502 = '2' AND m.TIPO_MOVIMENT_502 = 'E'
   AND m.DT_FIN_502 >= TRUNC(SYSDATE) - 7 AND ROWNUM <= 30;

-- V4) Picking "inferido" (destino mais comum do abastecimento) × picking cadastrado no WMS.
--     Se a 470 guardar o picking fixo, trocamos a inferência pelo cadastro.
SELECT * FROM HARPIAW2.MERC_EMPRESA_END_470 WHERE ROWNUM <= 10;

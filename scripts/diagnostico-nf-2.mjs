// Diagnóstico 2 da NF-e: confirma COMO a tabela do XML (PCDOCELETRONICO) se liga
// à nota de saída (PCNFSAID) e se o XML autorizado tem conteúdo. Fecha o que
// falta para gerar o DANFE em PDF a partir do banco.
//
// 100% SOMENTE LEITURA.
//
// Rodar:  node --env-file=.env.local scripts/diagnostico-nf-2.mjs
// Copie TODA a saída e mande de volta.
import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const { DB_HOST, DB_PORT, DB_SERVICE, DB_USER, DB_PASSWORD } = process.env;
if (!DB_HOST || !DB_PORT || !DB_SERVICE || !DB_USER || !DB_PASSWORD) {
  console.error("❌ Faltam variáveis DB_* no .env.local.");
  process.exit(1);
}

const linha = (t) => console.log("\n" + "=".repeat(70) + "\n" + t + "\n" + "=".repeat(70));

const conn = await oracledb.getConnection({
  user: DB_USER,
  password: DB_PASSWORD,
  connectString: `${DB_HOST}:${DB_PORT}/${DB_SERVICE}`,
});

async function roda(titulo, sql, binds = {}) {
  linha(titulo);
  try {
    const r = await conn.execute(sql, binds);
    if (!r.rows || r.rows.length === 0) console.log("(nenhuma linha)");
    else console.table(r.rows);
  } catch (e) {
    console.log("⚠️  falhou:", e.message);
  }
}

// 1) Colunas de PCDOCELETRONICO que servem de chave de ligação / identificação.
await roda(
  "1) PCDOCELETRONICO — colunas de ligação/identificação",
  `SELECT column_name, data_type, data_length
     FROM all_tab_columns
    WHERE table_name = 'PCDOCELETRONICO'
      AND (column_name LIKE '%CHAVE%' OR column_name LIKE '%NUMTRANS%'
           OR column_name LIKE '%NUMNOTA%' OR column_name LIKE '%SERIE%'
           OR column_name LIKE '%FILIAL%' OR column_name LIKE '%MODELO%'
           OR column_name LIKE '%TIPO%' OR column_name LIKE '%ESPECIE%'
           OR column_name = 'NUMPED')
    ORDER BY column_name`,
);

// 2) Tentativa de ligação POR CHAVE (PCDOCELETRONICO.CHAVENFE = PCNFSAID.CHAVENFE).
await roda(
  "2) Ligação por CHAVE — nota recente + tamanho do XML autorizado",
  `SELECT * FROM (
     SELECT s.NUMNOTA, s.CHAVENFE,
            DBMS_LOB.GETLENGTH(d.XMLNFE)      AS LEN_XMLNFE,
            DBMS_LOB.GETLENGTH(d.XMLASSINADO) AS LEN_XMLASSINADO
       FROM PCNFSAID s
       JOIN PCDOCELETRONICO d ON d.CHAVENFE = s.CHAVENFE
      WHERE s.CODFILIAL IN ('1','11') AND s.CHAVENFE IS NOT NULL
      ORDER BY s.DTSAIDA DESC
   ) WHERE ROWNUM <= 3`,
);

// 3) Tentativa de ligação POR NUMTRANSVENDA (fallback, caso a chave não exista lá).
await roda(
  "3) Ligação por NUMTRANSVENDA — nota recente + tamanho do XML autorizado",
  `SELECT * FROM (
     SELECT s.NUMNOTA, s.CHAVENFE,
            DBMS_LOB.GETLENGTH(d.XMLNFE)      AS LEN_XMLNFE,
            DBMS_LOB.GETLENGTH(d.XMLASSINADO) AS LEN_XMLASSINADO
       FROM PCNFSAID s
       JOIN PCDOCELETRONICO d ON d.NUMTRANSVENDA = s.NUMTRANSVENDA
      WHERE s.CODFILIAL IN ('1','11') AND s.CHAVENFE IS NOT NULL
      ORDER BY s.DTSAIDA DESC
   ) WHERE ROWNUM <= 3`,
);

// 4) Começo do XML autorizado (confirma que é NF-e de verdade, não vazio/lixo).
//    Usa a ligação por chave; se a #2 vier vazia, o trecho abaixo também virá.
await roda(
  "4) Trecho inicial do XML autorizado (180 primeiros caracteres)",
  `SELECT * FROM (
     SELECT s.NUMNOTA,
            DBMS_LOB.SUBSTR(NVL(d.XMLASSINADO, d.XMLNFE), 180, 1) AS INICIO_XML
       FROM PCNFSAID s
       JOIN PCDOCELETRONICO d ON d.CHAVENFE = s.CHAVENFE
      WHERE s.CODFILIAL IN ('1','11') AND s.CHAVENFE IS NOT NULL
        AND DBMS_LOB.GETLENGTH(NVL(d.XMLASSINADO, d.XMLNFE)) > 0
      ORDER BY s.DTSAIDA DESC
   ) WHERE ROWNUM <= 1`,
);

await conn.close();
linha("FIM — copie tudo acima e mande de volta.");
process.exit(0);

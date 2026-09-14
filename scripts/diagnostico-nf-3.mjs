// Diagnóstico 3 (final) da NF-e: confirma o join
// PCDOCELETRONICO.NUMTRANSACAO = PCNFSAID.NUMTRANSVENDA e que o XML autorizado
// vem com conteúdo. Também lista todas as colunas de PCDOCELETRONICO (tipo,
// status, protocolo) para montar a query e o parser do DANFE corretamente.
//
// 100% SOMENTE LEITURA.  Rodar:  node --env-file=.env.local scripts/diagnostico-nf-3.mjs
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

// 1) Todas as colunas de PCDOCELETRONICO (tipo/status/protocolo/xml).
await roda(
  "1) PCDOCELETRONICO — todas as colunas",
  `SELECT column_name, data_type, data_length
     FROM all_tab_columns WHERE table_name = 'PCDOCELETRONICO' ORDER BY column_name`,
);

// 2) Join confirmado: nota recente + tamanho do XML + começo do conteúdo.
await roda(
  "2) Join NUMTRANSACAO = NUMTRANSVENDA — nota recente + XML",
  `SELECT * FROM (
     SELECT s.NUMNOTA, s.NUMTRANSVENDA, s.CHAVENFE,
            DBMS_LOB.GETLENGTH(d.XMLNFE)      AS LEN_XMLNFE,
            DBMS_LOB.GETLENGTH(d.XMLASSINADO) AS LEN_XMLASSINADO,
            DBMS_LOB.SUBSTR(NVL(d.XMLASSINADO, d.XMLNFE), 160, 1) AS INICIO_XML
       FROM PCNFSAID s
       JOIN PCDOCELETRONICO d ON d.NUMTRANSACAO = s.NUMTRANSVENDA
      WHERE s.CODFILIAL IN ('1','11') AND s.CHAVENFE IS NOT NULL
      ORDER BY s.DTSAIDA DESC
   ) WHERE ROWNUM <= 3`,
);

// 3) Há mais de uma linha em PCDOCELETRONICO por transação? (evita XML duplicado/errado)
await roda(
  "3) Quantas linhas de PCDOCELETRONICO por transação (amostra recente)",
  `SELECT * FROM (
     SELECT s.NUMTRANSVENDA, COUNT(*) AS QTD_DOCS,
            SUM(CASE WHEN DBMS_LOB.GETLENGTH(NVL(d.XMLASSINADO, d.XMLNFE)) > 0 THEN 1 ELSE 0 END) AS COM_XML
       FROM PCNFSAID s
       JOIN PCDOCELETRONICO d ON d.NUMTRANSACAO = s.NUMTRANSVENDA
      WHERE s.CODFILIAL IN ('1','11') AND s.CHAVENFE IS NOT NULL
      GROUP BY s.NUMTRANSVENDA
      ORDER BY s.NUMTRANSVENDA DESC
   ) WHERE ROWNUM <= 5`,
);

await conn.close();
linha("FIM — copie tudo e mande de volta.");
process.exit(0);

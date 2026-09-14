// Diagnóstico da NF-e no WinThor: descobre o nome exato da coluna da CHAVE de
// acesso e SE/ONDE o XML da nota está guardado no banco. É a informação que
// decide se dá pra gerar o DANFE em PDF direto do banco ou se vai precisar de
// certificado digital + SEFAZ.
//
// É 100% SOMENTE LEITURA (só SELECT no dicionário de dados e uma nota de amostra).
//
// Rodar (na máquina que enxerga o Oracle, com o .env.local configurado):
//   node --env-file=.env.local scripts/diagnostico-nf.mjs
//
// Copie TODA a saída e mande de volta.
import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const { DB_HOST, DB_PORT, DB_SERVICE, DB_USER, DB_PASSWORD } = process.env;
if (!DB_HOST || !DB_PORT || !DB_SERVICE || !DB_USER || !DB_PASSWORD) {
  console.error("❌ Faltam variáveis DB_* no .env.local (DB_HOST, DB_PORT, DB_SERVICE, DB_USER, DB_PASSWORD).");
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
    if (!r.rows || r.rows.length === 0) {
      console.log("(nenhuma linha)");
    } else {
      console.table(r.rows);
    }
  } catch (e) {
    console.log("⚠️  falhou:", e.message);
  }
}

// 1) Colunas da PCNFSAID que tenham cara de chave/XML/protocolo/DANFE.
await roda(
  "1) Colunas candidatas em PCNFSAID (chave / XML / protocolo / danfe)",
  `SELECT column_name, data_type, data_length
     FROM all_tab_columns
    WHERE table_name = 'PCNFSAID'
      AND (column_name LIKE '%CHAVE%' OR column_name LIKE '%XML%'
           OR column_name LIKE '%PROT%' OR column_name LIKE '%DANFE%'
           OR column_name LIKE '%NFE%')
    ORDER BY column_name`,
);

// 2) Qualquer coluna de XML/CLOB/BLOB em tabelas PC* (onde o XML costuma morar).
await roda(
  "2) Colunas de XML/CLOB/BLOB em tabelas PC* (possível casa do XML)",
  `SELECT table_name, column_name, data_type
     FROM all_tab_columns
    WHERE table_name LIKE 'PC%'
      AND (column_name LIKE '%XML%'
           OR data_type IN ('CLOB', 'XMLTYPE', 'BLOB', 'LONG'))
      AND (column_name LIKE '%XML%' OR table_name LIKE '%NF%' OR table_name LIKE '%NFE%')
    ORDER BY table_name, column_name`,
);

// 3) Tabelas cujo NOME sugere XML / NF-e / DANFE.
await roda(
  "3) Tabelas com nome sugestivo (XML / NFE / DANFE)",
  `SELECT table_name
     FROM all_tables
    WHERE table_name LIKE '%XML%' OR table_name LIKE '%NFE%' OR table_name LIKE '%DANFE%'
    ORDER BY table_name`,
);

// 4) Amostra: uma NF recente das filiais 1/11 com número + chave (confirma a coluna).
//    Tenta CHAVENFE (nome mais comum); se não existir, o passo 1 já revelou o certo.
await roda(
  "4) Amostra de nota recente (nº + chave) — confirma o nome da coluna da chave",
  `SELECT * FROM (
     SELECT NUMNOTA, CHAVENFE, LENGTH(CHAVENFE) AS TAM_CHAVE, DTSAIDA
       FROM PCNFSAID
      WHERE CODFILIAL IN ('1','11') AND CHAVENFE IS NOT NULL
      ORDER BY DTSAIDA DESC
   ) WHERE ROWNUM <= 3`,
);

await conn.close();
linha("FIM — copie tudo acima e mande de volta.");
process.exit(0);

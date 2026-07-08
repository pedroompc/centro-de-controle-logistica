// Testa a conexão com o Oracle do Winthor.
// Rodar:  node --env-file=.env.local scripts/test-oracle.mjs
import oracledb from "oracledb";

const { DB_HOST, DB_PORT, DB_SERVICE, DB_USER, DB_PASSWORD } = process.env;

if (!DB_HOST || !DB_PORT || !DB_SERVICE || !DB_USER || !DB_PASSWORD) {
  console.error("❌ Faltam variáveis DB_* no .env.local (DB_HOST, DB_PORT, DB_SERVICE, DB_USER, DB_PASSWORD).");
  process.exit(1);
}

try {
  const conn = await oracledb.getConnection({
    user: DB_USER,
    password: DB_PASSWORD,
    connectString: `${DB_HOST}:${DB_PORT}/${DB_SERVICE}`,
  });
  const r = await conn.execute("SELECT 1 AS OK, SYSDATE AS AGORA FROM DUAL");
  console.log("✅ Conexão Winthor OK:", JSON.stringify(r.rows));
  const v = await conn.execute("SELECT banner FROM v$version WHERE ROWNUM = 1");
  console.log("Versão Oracle:", v.rows?.[0]?.BANNER ?? "(desconhecida)");
  await conn.close();
  process.exit(0);
} catch (e) {
  console.error("❌ Falha na conexão:", e.message);
  if (String(e.message).includes("NJS-138") || String(e.message).includes("thin")) {
    console.error(
      "→ O modo thin (padrão) não suporta essa versão do Oracle (provável 11g). " +
      "Precisamos do thick mode + Oracle Instant Client.",
    );
  }
  process.exit(1);
}

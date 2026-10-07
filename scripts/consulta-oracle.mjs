// Roda UMA consulta de leitura no Oracle (Winthor + Harpia) e imprime o resultado.
// Feito para o Claude Code investigar o banco direto da máquina do Pedro.
//
//   npm run oracle -- "SELECT ... FROM ..."
//   npm run oracle -- -f caminho/consulta.sql
//
// Travas: só aceita SELECT/WITH, abre a transação como READ ONLY (o Oracle
// recusa qualquer escrita) e corta em 500 linhas. Use um usuário Oracle só de
// leitura no .env.local — as travas aqui são a segunda linha de defesa.
import { readFileSync } from "node:fs";
import oracledb from "oracledb";

const MAX_LINHAS = 500;
const { DB_HOST, DB_PORT, DB_SERVICE, DB_USER, DB_PASSWORD } = process.env;

if (!DB_HOST || !DB_PORT || !DB_SERVICE || !DB_USER || !DB_PASSWORD) {
  console.error("Faltam variáveis DB_* no .env.local (DB_HOST, DB_PORT, DB_SERVICE, DB_USER, DB_PASSWORD).");
  process.exit(1);
}

const args = process.argv.slice(2);
const sqlBruto = args[0] === "-f" ? readFileSync(args[1], "utf8") : args.join(" ");
// O driver não aceita ";" no fim do comando.
const sql = sqlBruto.trim().replace(/;\s*$/, "");
const semComentarios = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "").trim();

if (!sql) {
  console.error('Uso: npm run oracle -- "SELECT ..."  ou  npm run oracle -- -f consulta.sql');
  process.exit(1);
}
if (!/^(select|with)\b/i.test(semComentarios) || semComentarios.includes(";")) {
  console.error("Recusado: só uma consulta SELECT/WITH por vez.");
  process.exit(1);
}

const formatar = (v) =>
  v instanceof Date ? v.toISOString().replace("T", " ").replace(/\.000Z$/, "") : v == null ? "" : String(v);

let conn;
try {
  conn = await oracledb.getConnection({
    user: DB_USER,
    password: DB_PASSWORD,
    connectString: `${DB_HOST}:${DB_PORT}/${DB_SERVICE}`,
  });
  await conn.execute("SET TRANSACTION READ ONLY");
  const r = await conn.execute(sql, [], { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: MAX_LINHAS + 1 });
  const linhas = r.rows ?? [];
  const colunas = (r.metaData ?? []).map((m) => m.name);
  console.log(colunas.join("\t"));
  for (const l of linhas.slice(0, MAX_LINHAS)) console.log(colunas.map((c) => formatar(l[c])).join("\t"));
  console.log(
    linhas.length > MAX_LINHAS
      ? `-- cortado em ${MAX_LINHAS} linhas (agrupe ou filtre a consulta)`
      : `-- ${linhas.length} linha(s)`,
  );
} catch (e) {
  console.error("Erro:", e.message);
  process.exitCode = 1;
} finally {
  if (conn) {
    try {
      await conn.rollback();
      await conn.close();
    } catch {
      // conexão já caiu; ignorável
    }
  }
}

import oracledb from "oracledb";

// Retorna cada linha como objeto { COLUNA: valor }.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
// CLOB (ex.: XML da NF-e em PCDOCELETRONICO.XMLNFE) vem como string, não Lob.
// As notas têm ~15 KB — muito abaixo do teto de string do driver.
oracledb.fetchAsString = [oracledb.CLOB];

/**
 * Executa uma query de leitura no banco Oracle do Winthor.
 * Abre uma conexão, roda a query e fecha (padrão simples; se o volume crescer,
 * trocamos por um pool). Usa as credenciais de WINTHOR_ORACLE_* do ambiente.
 */
export async function queryWinthor<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = {},
): Promise<T[]> {
  let connection: oracledb.Connection | undefined;
  try {
    connection = await oracledb.getConnection({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
    });
    const result = await connection.execute<T>(sql, binds);
    return result.rows ?? [];
  } finally {
    if (connection) {
      try {
        await connection.close();
      } catch {
        // conexão já pode ter caído; ignorável no fechamento
      }
    }
  }
}

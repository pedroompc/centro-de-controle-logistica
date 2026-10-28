import oracledb from "oracledb";

// Retorna cada linha como objeto { COLUNA: valor }.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
// CLOB (ex.: XML da NF-e em PCDOCELETRONICO.XMLNFE) vem como string, não Lob.
// As notas têm ~15 KB — muito abaixo do teto de string do driver.
oracledb.fetchAsString = [oracledb.CLOB];

// Abrir conexão com o Oracle custa ~3 s; o pool mantém algumas abertas e as
// reaproveita. Fica no globalThis para sobreviver ao hot reload do dev.
const g = globalThis as { __poolWinthor?: Promise<oracledb.Pool> };

function pool(): Promise<oracledb.Pool> {
  // Guarda a promise (não o pool): consultas simultâneas não criam dois pools.
  g.__poolWinthor ??= oracledb
    .createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
      // Um BI dispara ~9 consultas juntas: manter conexões quentes por 10 min
      // evita pagar a abertura de novo a cada tela.
      poolMin: 4,
      poolMax: 12,
      poolIncrement: 2,
      poolTimeout: 600,
      queueTimeout: 60_000,
    })
    .catch((e) => {
      g.__poolWinthor = undefined;
      throw e;
    });
  return g.__poolWinthor;
}

/** Pool caiu (ex.: NJS-521, rede): descarta para a próxima consulta criar outro. */
async function descartarPool(p: oracledb.Pool) {
  if (g.__poolWinthor) g.__poolWinthor = undefined;
  try {
    await p.close(0);
  } catch {
    // já pode estar fechado; ignorável
  }
}

/**
 * Executa uma query de leitura no banco Oracle do Winthor, com uma conexão
 * do pool. Usa as credenciais de DB_* do ambiente.
 */
export async function queryWinthor<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = {},
): Promise<T[]> {
  const p = await pool();
  let connection: oracledb.Connection;
  try {
    connection = await p.getConnection();
  } catch (e) {
    await descartarPool(p);
    throw e;
  }
  try {
    const result = await connection.execute<T>(sql, binds);
    return result.rows ?? [];
  } finally {
    try {
      await connection.close();
    } catch {
      // conexão já pode ter caído; ignorável no fechamento
    }
  }
}

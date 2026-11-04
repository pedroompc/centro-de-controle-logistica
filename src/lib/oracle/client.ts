import oracledb from "oracledb";

// Retorna cada linha como objeto { COLUNA: valor }.
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
// CLOB (ex.: XML da NF-e em PCDOCELETRONICO.XMLNFE) vem como string, não Lob.
// As notas têm ~15 KB — muito abaixo do teto de string do driver.
oracledb.fetchAsString = [oracledb.CLOB];

// Abrir conexão com o Oracle custa ~3 s; o pool mantém algumas abertas e as
// reaproveita. Fica no globalThis para sobreviver ao hot reload do dev.
const g = globalThis as { __poolWinthor?: Promise<oracledb.Pool>; __poolWinthorAtual?: oracledb.Pool };

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
    .then((p) => (g.__poolWinthorAtual = p))
    .catch((e) => {
      g.__poolWinthor = undefined;
      throw e;
    });
  return g.__poolWinthor;
}

/**
 * Pool caiu (ex.: NJS-521, rede) ou tem conexão corrompida: a próxima consulta
 * cria outro. O velho fecha em segundo plano, esperando até 1 min as consultas
 * que ainda estão nele terminarem — não derruba a página de quem está no meio.
 */
function descartarPool(p: oracledb.Pool) {
  // Só esquece o pool se ainda for este: outra requisição pode já ter criado o novo.
  if (g.__poolWinthorAtual === p) {
    g.__poolWinthor = undefined;
    g.__poolWinthorAtual = undefined;
  }
  // Sem await: a requisição que deu erro não fica presa esperando o fechamento.
  p.close(60).catch(() => {
    // já pode estar fechado; ignorável
  });
}

/**
 * Teto de uma consulta. A mais pesada (Harpia da Separação, mês cheio) leva
 * ~25 s; acima de 2 min é rede/banco travado, e segurar a página não ajuda.
 */
export const TEMPO_MAX_CONSULTA_MS = 120_000;

// Erro de SQL que deixa a conexão perfeita para a próxima consulta.
const ERRO_DE_SQL = /^ORA-\d+/;
// ORA- que significam "a conexão morreu" (fim de arquivo, sessão morta, timeout).
const ORA_CONEXAO_PERDIDA = /^ORA-(03113|03114|03135|00028|01012|02396|12152|12170)\b/;

/**
 * A conexão que deu este erro pode ser reaproveitada? Erro de SQL comum (ORA-)
 * não estraga a conexão. Todo o resto — erro do driver (NJS-/DPI-), timeout,
 * ou um "Attempt to access memory outside buffer bounds" do protocolo — deixa
 * a conexão num estado desconhecido: se voltar ao pool, envenena as próximas
 * consultas (foi o que derrubou o faturamento em 04/11/2026).
 */
export function conexaoSuspeita(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro);
  if (ORA_CONEXAO_PERDIDA.test(msg)) return true;
  return !ERRO_DE_SQL.test(msg);
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
    descartarPool(p);
    throw e;
  }
  let suspeita = false;
  try {
    connection.callTimeout = TEMPO_MAX_CONSULTA_MS;
    const result = await connection.execute<T>(sql, binds);
    return result.rows ?? [];
  } catch (e) {
    suspeita = conexaoSuspeita(e);
    throw e;
  } finally {
    try {
      // Conexão suspeita sai do pool de vez (drop) em vez de voltar para ele.
      if (suspeita) await connection.close({ drop: true });
      else await connection.close();
    } catch {
      // conexão já pode ter caído; ignorável no fechamento
    }
    // Se uma conexão se corrompeu, as irmãs abertas junto podem estar iguais:
    // recomeça o pool do zero na próxima consulta.
    if (suspeita) descartarPool(p);
  }
}

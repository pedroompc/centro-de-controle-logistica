import { registrarConsulta } from "./registro";
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
      // O Oracle fica atrás de rede pública/NAT: conexão ociosa (as 4 do poolMin)
      // é derrubada em silêncio e a próxima leitura nela dá "Attempt to access
      // memory outside buffer bounds" / NJS-521. Keepalive TCP a cada 1 min
      // mantém o caminho vivo; o ping antes de entregar uma conexão parada há
      // 20 s pega a que morreu mesmo assim (descartada e trocada pelo pool).
      expireTime: 1,
      poolPingInterval: 20,
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

// Teto de tempo estourado (consulta ou fila do pool): o banco está lento ou
// travado — repetir só dobraria a espera de quem está na tela.
const ERRO_DE_TEMPO = /NJS-123|NJS-040|DPI-1067|ORA-01013|ORA-12170|call timeout/i;

/**
 * Vale repetir a consulta numa conexão nova? Só quando a conexão morreu na
 * rede (ociosa derrubada no NAT → "buffer bounds", NJS-5xx, ORA de canal
 * perdido): o pool velho já foi descartado e a segunda tentativa abre outra.
 * Erro de SQL e estouro de tempo não repetem.
 */
export function podeRepetir(erro: unknown): boolean {
  const msg = erro instanceof Error ? erro.message : String(erro);
  return conexaoSuspeita(erro) && !ERRO_DE_TEMPO.test(msg);
}

/** Uma tentativa: pega conexão do pool, executa e devolve a conexão (ou a descarta). */
async function tentar<T>(sql: string, binds: oracledb.BindParameters): Promise<T[]> {
  const t0 = Date.now();
  let connection: oracledb.Connection;
  let p: oracledb.Pool | undefined;
  try {
    p = await pool();
    connection = await p.getConnection();
  } catch (e) {
    if (p) descartarPool(p);
    registrarConsulta(sql, Date.now() - t0, e);
    throw e;
  }
  let suspeita = false;
  try {
    connection.callTimeout = TEMPO_MAX_CONSULTA_MS;
    const result = await connection.execute<T>(sql, binds);
    registrarConsulta(sql, Date.now() - t0);
    return result.rows ?? [];
  } catch (e) {
    suspeita = conexaoSuspeita(e);
    registrarConsulta(sql, Date.now() - t0, e);
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

/**
 * Executa uma query de leitura no banco Oracle do Winthor, com uma conexão
 * do pool. Usa as credenciais de DB_* do ambiente. Se a conexão estava morta
 * (ociosa derrubada na rede), repete UMA vez numa conexão nova — a tela não
 * precisa mais de um F5 para aparecer. Só leitura passa por aqui, então
 * repetir é seguro.
 */
export async function queryWinthor<T = Record<string, unknown>>(
  sql: string,
  binds: oracledb.BindParameters = {},
): Promise<T[]> {
  try {
    return await tentar<T>(sql, binds);
  } catch (e) {
    if (!podeRepetir(e)) throw e;
    console.warn(`[oracle] conexão morta (${e instanceof Error ? e.message : String(e)}); repetindo numa nova`);
    return tentar<T>(sql, binds);
  }
}

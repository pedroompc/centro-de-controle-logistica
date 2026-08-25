import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import { agregarPorSetor } from "@/domain/devolucoes";
import type {
  ResumoDevolucoes,
  DevolucaoPorMotivo,
  DevolucaoPorCliente,
  DevolucaoPorMotorista,
  SetorDevolucao,
} from "@/domain/devolucoes";
import type { LinhaCidadeDevolucao } from "@/domain/devolucoes-mapa";

const faixa = (col: string) =>
  `${col} >= TO_DATE(:ini,'YYYY-MM-DD') AND ${col} < TO_DATE(:fim,'YYYY-MM-DD') + 1`;

/** Filtros aplicados no SQL — estreitam motivo, clientes e motoristas de uma vez. */
export interface FiltrosDevolucao {
  motivo?: string;
  setor?: string;
}

// Valor líquido do item de devolução: preço praticado menos ST. Na devolução, o
// IPI NÃO é deduzido — é como a VIEW_BI_FATURAMENTO (fonte oficial) trata a
// devolução, e assim a soma da quebra fica a ~0,003% do total oficial (deduzir
// IPI cheio erra ~R$700; sem IPI erra ~R$29 — resíduo irredutível de IPI parcial
// item a item, que só a view reproduz). Ver [[devolucao-regra]] na memória.
const NET = `(m.PUNIT - NVL(m.ST,0)) * m.QT`;

// Motivo (CODDEVOL) → setor responsável, conforme o cadastro de motivos do Winthor.
const SETOR = `CASE
    WHEN ed.CODDEVOL IN (85,86,87,88,89,90,91,97,98,99,100,101,102,103,104,111,112) THEN 'Logística'
    WHEN ed.CODDEVOL IN (93,94,95,96,106,107,108,109,110) THEN 'Comercial'
    WHEN ed.CODDEVOL IN (92,105) THEN 'Faturamento'
    ELSE 'Não classificado' END`;

// Base única (rotina 111 líquido, por DATA DA DEVOLUÇÃO): uma linha por nota de
// entrada de devolução (movimento ED do período), com valor líquido, motivo e o
// vínculo com a NF de venda de origem. `NUMTRANSVENDA = 0` ⇒ devolução avulsa
// (sem venda de origem) — excluída da quebra abaixo, como o 111 faz. O vínculo
// é pré-agregado por NUMTRANSENT p/ não multiplicar a soma dos itens.
const ED_CTE = `
ed AS (
  SELECT ne.NUMTRANSENT,
         MAX(ne.CODDEVOL) CODDEVOL,
         NVL(MAX(vlink.NUMTRANSVENDA), 0) NUMTRANSVENDA,
         SUM(${NET}) VL -- sem arredondar aqui: só na agregação final, p/ bater centavo a centavo com o card
  FROM PCMOV m
  JOIN PCNFENT ne ON ne.NUMTRANSENT = m.NUMTRANSENT
  LEFT JOIN (SELECT NUMTRANSENT, MAX(NVL(NUMTRANSVENDA, 0)) NUMTRANSVENDA
               FROM PCESTCOM GROUP BY NUMTRANSENT) vlink ON vlink.NUMTRANSENT = ne.NUMTRANSENT
  WHERE ${filialIn("m.CODFILIAL")} AND ${faixa("m.DTMOV")} AND m.CODOPER = 'ED'
    AND m.DTCANCEL IS NULL
  GROUP BY ne.NUMTRANSENT
)`;

/**
 * `edf` = `ed` com motivo/setor resolvidos e os filtros aplicados num ÚNICO ponto
 * — as três queries (motivo/cliente/motorista) leem daqui, então o filtro
 * estreita todas de uma vez. As cláusulas só entram quando há filtro (o Oracle
 * recusa bind que não aparece na query).
 */
function ctes(f: FiltrosDevolucao): string {
  const cond = [
    f.motivo ? `AND NVL(td.MOTIVO, 'Não informado') = :motivo` : "",
    f.setor ? `AND ${SETOR} = :setor` : "",
  ].join("\n    ");
  return `${ED_CTE},
edf AS (
  SELECT ed.NUMTRANSENT, ed.NUMTRANSVENDA, ed.VL,
         NVL(td.MOTIVO, 'Não informado') MOTIVO, ${SETOR} SETOR
  FROM ed LEFT JOIN PCTABDEV td ON td.CODDEVOL = ed.CODDEVOL
  WHERE 1 = 1
    ${cond}
)`;
}

const sqlMotivo = (f: FiltrosDevolucao) => `WITH ${ctes(f)}
  SELECT MOTIVO, SETOR, COUNT(*) NOTAS, ROUND(SUM(VL), 2) VALOR
  FROM edf
  WHERE NUMTRANSVENDA > 0
  GROUP BY MOTIVO, SETOR
  ORDER BY VALOR DESC`;

const sqlCliente = (f: FiltrosDevolucao) => `SELECT * FROM (WITH ${ctes(f)}
  SELECT s.CODCLI, MAX(cli.CLIENTE) NOME,
         COUNT(DISTINCT edf.NUMTRANSENT) NOTAS, ROUND(SUM(edf.VL), 2) VALOR
  FROM edf
  JOIN PCNFSAID s ON s.NUMTRANSVENDA = edf.NUMTRANSVENDA
  LEFT JOIN PCCLIENT cli ON cli.CODCLI = s.CODCLI
  WHERE edf.NUMTRANSVENDA > 0
  GROUP BY s.CODCLI ORDER BY VALOR DESC
) WHERE ROWNUM <= 50`;

// Devolução por motorista de entrega: expedição via carga (PCNFSAID.NUMCAR →
// PCCARREG.CODMOTORISTA → PCEMPR.NOME), taxa = devolvidas/expedidas. Motorista
// 9996 (DIALOG/pseudo) excluído. `expedidas` = NFs em carga saídas no período;
// a devolução (valor líquido) é atribuída à carga da venda de origem.
const sqlMotorista = (f: FiltrosDevolucao) => `
WITH ${ctes(f)},
vendas AS (
  SELECT nf.NUMTRANSVENDA, nf.NUMCAR
  FROM PCNFSAID nf
  WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")}
    AND NVL(nf.NUMCAR, 0) != 0
    AND NVL(nf.CONDVENDA, 0) NOT IN (4,8,10,13,20,98,99)
    AND nf.DTCANCEL IS NULL
),
devv AS (
  SELECT NUMTRANSVENDA, SUM(VL) VL_DEVOLVIDO
  FROM edf WHERE NUMTRANSVENDA > 0 GROUP BY NUMTRANSVENDA
)
SELECT car.CODMOTORISTA,
       MAX(emp.NOME) NOME,
       MAX(emp.TIPOMOTORISTA) TIPO_MOTORISTA, -- F = da casa · T = terceirizado (PCEMPR)
       COUNT(DISTINCT v.NUMTRANSVENDA) EXPEDIDAS,
       COUNT(DISTINCT CASE WHEN devv.NUMTRANSVENDA IS NOT NULL THEN v.NUMTRANSVENDA END) DEVOLVIDAS,
       ROUND(COUNT(DISTINCT CASE WHEN devv.NUMTRANSVENDA IS NOT NULL THEN v.NUMTRANSVENDA END) * 100
             / NULLIF(COUNT(DISTINCT v.NUMTRANSVENDA), 0), 2) TAXA,
       ROUND(SUM(NVL(devv.VL_DEVOLVIDO, 0)), 2) VALOR_DEVOLVIDO
FROM vendas v
JOIN PCCARREG car ON car.NUMCAR = v.NUMCAR
LEFT JOIN PCEMPR emp ON emp.MATRICULA = car.CODMOTORISTA
LEFT JOIN devv ON devv.NUMTRANSVENDA = v.NUMTRANSVENDA
WHERE NVL(car.CODMOTORISTA, 0) != 0 AND car.CODMOTORISTA NOT IN (9996)
GROUP BY car.CODMOTORISTA
ORDER BY VALOR_DEVOLVIDO DESC`;

interface LinhaMotivo { MOTIVO: string; SETOR: string; NOTAS: number; VALOR: number }
interface LinhaCliente { CODCLI: number; NOME: string | null; NOTAS: number; VALOR: number }
interface LinhaMotorista { CODMOTORISTA: number; NOME: string | null; TIPO_MOTORISTA: string | null; EXPEDIDAS: number; DEVOLVIDAS: number; TAXA: number; VALOR_DEVOLVIDO: number }

const n = (v: unknown): number => Number(v) || 0;

/**
 * Motivos que tiveram devolução no período — popula o `select` do filtro. Sempre
 * SEM filtro (senão, ao filtrar, o dropdown ficaria com uma opção só).
 */
export const listarMotivosDoMes = cache(async (ini: string, fim: string): Promise<string[]> => {
  const binds = { ini, fim };
  try {
    const rows = await queryWinthor<{ MOTIVO: string }>(
      `WITH ${ctes({})}
       SELECT DISTINCT MOTIVO FROM edf WHERE NUMTRANSVENDA > 0 ORDER BY MOTIVO`,
      binds,
    );
    return rows.map((r) => r.MOTIVO);
  } catch (erro) {
    console.error("[devolucoes] motivos indisponíveis:", (erro as Error).message);
    return [];
  }
});

/**
 * Devoluções das filiais 1 e 11 no período [ini, fim]: total, por setor, por
 * motivo e top clientes. `motivo`/`setor` estreitam as três quebras de uma vez
 * (via a CTE `edf`). Retorna `null` se o Winthor estiver indisponível.
 *
 * Parâmetros primitivos (e não um objeto) de propósito: `cache()` do React
 * compara argumentos por identidade — um objeto literal novo a cada chamada
 * furaria a memoização.
 */
export const getDevolucoes = cache(async (
  ini: string,
  fim: string,
  motivo?: string,
  setor?: string,
): Promise<ResumoDevolucoes | null> => {
  const f: FiltrosDevolucao = { motivo, setor };
  // Bind só do que aparece na query — o Oracle recusa bind não referenciado.
  const binds: Record<string, string> = { ini, fim };
  if (motivo) binds.motivo = motivo;
  if (setor) binds.setor = setor;
  try {
    const [motivosRaw, clientesRaw, motoristasRaw] = await Promise.all([
      queryWinthor<LinhaMotivo>(sqlMotivo(f), binds),
      queryWinthor<LinhaCliente>(sqlCliente(f), binds),
      queryWinthor<LinhaMotorista>(sqlMotorista(f), binds),
    ]);

    const porMotivo: DevolucaoPorMotivo[] = motivosRaw.map((r) => ({
      motivo: r.MOTIVO,
      setor: r.SETOR as SetorDevolucao,
      notas: n(r.NOTAS),
      valor: n(r.VALOR),
    }));
    const topClientes: DevolucaoPorCliente[] = clientesRaw.map((r) => ({
      codcli: n(r.CODCLI),
      nome: r.NOME ?? `Cliente ${r.CODCLI}`,
      notas: n(r.NOTAS),
      valor: n(r.VALOR),
    }));
    const porMotorista: DevolucaoPorMotorista[] = motoristasRaw.map((r) => ({
      codMotorista: n(r.CODMOTORISTA),
      nome: r.NOME ?? `Motorista ${r.CODMOTORISTA}`,
      tipo: r.TIPO_MOTORISTA === "F" || r.TIPO_MOTORISTA === "T" ? r.TIPO_MOTORISTA : null,
      expedidas: n(r.EXPEDIDAS),
      devolvidas: n(r.DEVOLVIDAS),
      taxa: n(r.TAXA),
      valorDevolvido: n(r.VALOR_DEVOLVIDO),
    }));

    return {
      total: porMotivo.reduce((t, m) => t + m.valor, 0),
      porSetor: agregarPorSetor(porMotivo),
      porMotivo,
      topClientes,
      porMotorista,
    };
  } catch (erro) {
    console.error("[devolucoes] Winthor indisponível:", (erro as Error).message);
    return null;
  }
});

// --- Devolução por cidade (PE) ------------------------------------------------
// Faturado e devolvido atribuídos à CIDADE DO CLIENTE DA VENDA. O faturado usa os
// mesmos filtros da query de motorista (condvenda de bonificação/brinde fora); o
// devolvido reusa a CTE `edf` (líquido, rotina 111, NUMTRANSVENDA > 0), ligado à
// venda de origem. FULL OUTER JOIN por cidade: pode haver faturamento sem
// devolução (e, raro, o inverso). Só UF = 'PE'.
//
// Colunas confirmadas no Winthor (dicionário de dados): cliente → cidade via
// PCCLIENT.CODCIDADE → PCCIDADE (CODCIDADE, NOMECIDADE, CODIBGE numérico de 7
// dígitos, UF de 2 letras). O CODIBGE casa 1:1 com as chaves da geometria de PE.
const sqlCidade = () => `
WITH ${ctes({})},
fat AS (
  SELECT ci.CODIBGE, MAX(ci.NOMECIDADE) CIDADE, SUM(nf.VLTOTAL) FATURADO
  FROM PCNFSAID nf
  JOIN PCCLIENT cli ON cli.CODCLI = nf.CODCLI
  JOIN PCCIDADE ci ON ci.CODCIDADE = cli.CODCIDADE
  WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")}
    AND NVL(nf.CONDVENDA, 0) NOT IN (4,8,10,13,20,98,99)
    AND nf.DTCANCEL IS NULL
    AND ci.UF = 'PE'
  GROUP BY ci.CODIBGE
),
dev AS (
  SELECT ci.CODIBGE,
         MAX(ci.NOMECIDADE) CIDADE,
         SUM(edf.VL) DEVOLVIDO,
         COUNT(DISTINCT edf.NUMTRANSENT) NOTAS
  FROM edf
  JOIN PCNFSAID s ON s.NUMTRANSVENDA = edf.NUMTRANSVENDA
  JOIN PCCLIENT cli ON cli.CODCLI = s.CODCLI
  JOIN PCCIDADE ci ON ci.CODCIDADE = cli.CODCIDADE
  WHERE edf.NUMTRANSVENDA > 0 AND ci.UF = 'PE'
  GROUP BY ci.CODIBGE
)
SELECT TO_CHAR(NVL(fat.CODIBGE, dev.CODIBGE)) IBGE,
       NVL(fat.CIDADE, dev.CIDADE) CIDADE,
       ROUND(NVL(fat.FATURADO, 0), 2) FATURADO,
       ROUND(NVL(dev.DEVOLVIDO, 0), 2) DEVOLVIDO,
       NVL(dev.NOTAS, 0) NOTAS
FROM fat FULL OUTER JOIN dev ON dev.CODIBGE = fat.CODIBGE
WHERE NVL(fat.CODIBGE, dev.CODIBGE) IS NOT NULL`;

interface LinhaCidadeRaw {
  IBGE: string | null;
  CIDADE: string | null;
  FATURADO: number;
  DEVOLVIDO: number;
  NOTAS: number;
}

/**
 * Faturado e devolvido por município de PE no período [ini, fim], para o mapa de
 * calor. Sem taxa aqui — ela é derivada no domínio (`comTaxa`). Winthor
 * indisponível ⇒ `[]` (a seção do mapa mostra estado vazio).
 */
export const getDevolucaoPorCidade = cache(async (
  ini: string,
  fim: string,
): Promise<LinhaCidadeDevolucao[]> => {
  try {
    const rows = await queryWinthor<LinhaCidadeRaw>(sqlCidade(), { ini, fim });
    return rows
      .filter((r) => r.IBGE)
      .map((r) => ({
        ibge: String(r.IBGE),
        cidade: r.CIDADE ?? `Cidade ${r.IBGE}`,
        faturado: n(r.FATURADO),
        devolvido: n(r.DEVOLVIDO),
        notasDevolvidas: n(r.NOTAS),
      }));
  } catch (erro) {
    console.error("[devolucoes] mapa por cidade indisponível:", (erro as Error).message);
    return [];
  }
});

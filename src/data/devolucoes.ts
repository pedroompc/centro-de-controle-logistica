import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { primeiroDiaDoMes } from "@/domain/periodo";
import { filialIn } from "./filiais";
import { agregarPorSetor } from "@/domain/devolucoes";
import type {
  ResumoDevolucoes,
  DevolucaoPorMotivo,
  DevolucaoPorCliente,
  DevolucaoPorMotorista,
  SetorDevolucao,
} from "@/domain/devolucoes";

const faixa = (col: string) =>
  `${col} >= TO_DATE(:ini,'YYYY-MM-DD') AND ${col} < TO_DATE(:fim,'YYYY-MM-DD') + 1`;

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

const SQL_MOTIVO = `WITH ${ED_CTE}
  SELECT NVL(td.MOTIVO, 'Não informado') MOTIVO, ${SETOR} SETOR,
         COUNT(*) NOTAS, ROUND(SUM(ed.VL), 2) VALOR
  FROM ed LEFT JOIN PCTABDEV td ON td.CODDEVOL = ed.CODDEVOL
  WHERE ed.NUMTRANSVENDA > 0
  GROUP BY NVL(td.MOTIVO, 'Não informado'), ${SETOR}
  ORDER BY VALOR DESC`;

const SQL_CLIENTE = `SELECT * FROM (WITH ${ED_CTE}
  SELECT s.CODCLI, MAX(cli.CLIENTE) NOME,
         COUNT(DISTINCT ed.NUMTRANSENT) NOTAS, ROUND(SUM(ed.VL), 2) VALOR
  FROM ed
  JOIN PCNFSAID s ON s.NUMTRANSVENDA = ed.NUMTRANSVENDA
  LEFT JOIN PCCLIENT cli ON cli.CODCLI = s.CODCLI
  WHERE ed.NUMTRANSVENDA > 0
  GROUP BY s.CODCLI ORDER BY VALOR DESC
) WHERE ROWNUM <= 10`;

// Devolução por motorista de entrega: expedição via carga (PCNFSAID.NUMCAR →
// PCCARREG.CODMOTORISTA → PCEMPR.NOME), taxa = devolvidas/expedidas. Motorista
// 9996 (DIALOG/pseudo) excluído. `expedidas` = NFs em carga saídas no período;
// a devolução (valor líquido) é atribuída à carga da venda de origem.
const SQL_MOTORISTA = `
WITH ${ED_CTE},
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
  FROM ed WHERE NUMTRANSVENDA > 0 GROUP BY NUMTRANSVENDA
)
SELECT car.CODMOTORISTA,
       MAX(emp.NOME) NOME,
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
interface LinhaMotorista { CODMOTORISTA: number; NOME: string | null; EXPEDIDAS: number; DEVOLVIDAS: number; TAXA: number; VALOR_DEVOLVIDO: number }

function hojeISO(hoje = new Date()): string {
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}
const n = (v: unknown): number => Number(v) || 0;

/**
 * Devoluções das filiais 1 e 11 no mês corrente (1º dia → hoje): total, por
 * setor, por motivo e top clientes. Retorna `null` se o Winthor estiver
 * indisponível.
 */
export const getDevolucoesMesAtual = cache(async (): Promise<ResumoDevolucoes | null> => {
  const binds = { ini: primeiroDiaDoMes(), fim: hojeISO() };
  try {
    const [motivosRaw, clientesRaw, motoristasRaw] = await Promise.all([
      queryWinthor<LinhaMotivo>(SQL_MOTIVO, binds),
      queryWinthor<LinhaCliente>(SQL_CLIENTE, binds),
      queryWinthor<LinhaMotorista>(SQL_MOTORISTA, binds),
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

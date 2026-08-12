import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import { EUGENIO } from "@/domain/fechamento-janela";

/**
 * ⛔ PARADO (decisão 12/08): o card usa faturamento por data de emissão (bate
 * com o 111). Este módulo fica no repo, isolado e não ligado, caso a regra da
 * janela operacional seja retomada. Ver plano em
 * docs/superpowers/plans/2026-08-11-fechamento-janela-operacional.md.
 *
 * Faturamento pela JANELA OPERACIONAL (etapa 2) — isolado de `getResumoFaturamento`
 * (que continua calendário, usado pelo dashboard). Regra do "dia operacional":
 * hora da autorização SEFAZ + motorista da carga (ver `@/domain/fechamento-janela`).
 *
 * • VALOR: os totais exatos da VIEW_BI_FATURAMENTO (batem no 111) são
 *   redistribuídos entre os dias operacionais pela proporção de valor (VLTOTAL)
 *   por janela stay/move das notas → mês fecha no centavo; dia fica próximo.
 * • PESO (bruto) e CONTAGENS: direto das tabelas-base, pela classificação por nota.
 *
 * ⚠️ NÃO VALIDADO contra o 111 ainda (Fase 4). Confirmar no schema:
 * `PCNFSAID.VLTOTAL` (peso da proporção) e `PCNFSAID.NUMCAR → PCCARREG.CODMOTORISTA`.
 */

const HORA = "TO_NUMBER(TO_CHAR(n.DTHORAAUTORIZACAOSEFAZ, 'HH24'))";
const DIAC = "TRUNC(n.DTHORAAUTORIZACAOSEFAZ)";
const MOT = "NVL(car.CODMOTORISTA, 0)";

// Data operacional (DATE) da nota — espelha `diaOperacional` do domínio.
const OP_DATE = `CASE
  WHEN ${HORA} < 7 THEN ${DIAC}
  WHEN ${HORA} < 13 THEN (CASE WHEN ${MOT} = ${EUGENIO} THEN ${DIAC} ELSE ${DIAC} + 1 END)
  ELSE ${DIAC} + 1 END`;

// "S" = fica no dia (op = c); "M" = vai para o dia seguinte (op = c + 1).
const MV = `CASE
  WHEN ${HORA} < 7 THEN 'S'
  WHEN ${HORA} < 13 THEN (CASE WHEN ${MOT} = ${EUGENIO} THEN 'S' ELSE 'M' END)
  ELSE 'M' END`;

// Universo de notas de venda com a carga (para hora SEFAZ + motorista). Janela
// [iniExt, fim] em DTHORAAUTORIZACAOSEFAZ (iniExt = ini − 1) para pegar a véspera
// cujo bloco da noite cai no primeiro dia do intervalo.
const BASE_NOTAS = `
  FROM PCNFSAID n
  LEFT JOIN PCCARREG car ON car.NUMCAR = n.NUMCAR
 WHERE ${filialIn("n.CODFILIAL")}
   AND n.TIPOVENDA IN ('VP', 'VV') AND n.DTCANCEL IS NULL
   AND n.DTHORAAUTORIZACAOSEFAZ >= TO_DATE(:iniExt, 'YYYY-MM-DD')
   AND n.DTHORAAUTORIZACAOSEFAZ <  TO_DATE(:fim, 'YYYY-MM-DD') + 1`;

// Proporção (VLTOTAL) e contagem de notas por dia-calendário e janela stay/move.
const SQL_PROP = `
SELECT TO_CHAR(${DIAC}, 'YYYY-MM-DD') DIA, ${MV} MV,
       NVL(SUM(NVL(n.VLTOTAL, 0)), 0) V, COUNT(*) QTD
  ${BASE_NOTAS}
 GROUP BY TO_CHAR(${DIAC}, 'YYYY-MM-DD'), ${MV}`;

// Totais autoritativos de venda por dia-calendário (a fonte que bate no 111).
const SQL_BI = `
SELECT TO_CHAR(TRUNC(v.DTSAIDA), 'YYYY-MM-DD') DIA, NVL(SUM(v.VENDAS), 0) V
  FROM VIEW_BI_FATURAMENTO v
 WHERE ${filialIn("v.CODFILIAL")}
   AND v.DTSAIDA >= TO_DATE(:iniExt, 'YYYY-MM-DD')
   AND v.DTSAIDA <  TO_DATE(:fim, 'YYYY-MM-DD') + 1
 GROUP BY TO_CHAR(TRUNC(v.DTSAIDA), 'YYYY-MM-DD')`;

// PDVs atendidos = clientes distintos por dia OPERACIONAL, no intervalo pedido.
const SQL_ATEND = `
SELECT COUNT(DISTINCT n.CODCLI || '|' || TO_CHAR(${OP_DATE}, 'YYYYMMDD')) ATEND
  FROM PCNFSAID n
  LEFT JOIN PCCARREG car ON car.NUMCAR = n.NUMCAR
 WHERE ${filialIn("n.CODFILIAL")}
   AND n.TIPOVENDA IN ('VP', 'VV') AND n.DTCANCEL IS NULL
   AND n.DTHORAAUTORIZACAOSEFAZ >= TO_DATE(:iniExt, 'YYYY-MM-DD')
   AND n.DTHORAAUTORIZACAOSEFAZ <  TO_DATE(:fim, 'YYYY-MM-DD') + 1
   AND ${OP_DATE} >= TO_DATE(:ini, 'YYYY-MM-DD')
   AND ${OP_DATE} <  TO_DATE(:fim, 'YYYY-MM-DD') + 1`;

// Peso bruto de venda das notas cujo dia operacional cai no intervalo.
const SQL_PESO = `
SELECT NVL(SUM(NVL(m.PESOBRUTO, 0) * m.QT), 0) PESO
  FROM PCMOV m
  JOIN PCNFSAID n ON n.NUMTRANSVENDA = m.NUMTRANSVENDA
  LEFT JOIN PCCARREG car ON car.NUMCAR = n.NUMCAR
 WHERE ${filialIn("m.CODFILIAL")} AND m.CODOPER = 'S'
   AND n.TIPOVENDA IN ('VP', 'VV') AND n.DTCANCEL IS NULL
   AND n.DTHORAAUTORIZACAOSEFAZ >= TO_DATE(:iniExt, 'YYYY-MM-DD')
   AND n.DTHORAAUTORIZACAOSEFAZ <  TO_DATE(:fim, 'YYYY-MM-DD') + 1
   AND ${OP_DATE} >= TO_DATE(:ini, 'YYYY-MM-DD')
   AND ${OP_DATE} <  TO_DATE(:fim, 'YYYY-MM-DD') + 1`;

interface LinhaProp { DIA: string; MV: "S" | "M"; V: number; QTD: number }
interface LinhaBI { DIA: string; V: number }
interface LinhaAtend { ATEND: number }
interface LinhaPeso { PESO: number }

export interface FaturamentoOperacional {
  vendaFaturada: number; // R$ (proporcional; mês bate no 111)
  pesoFaturadoBrutoKg: number;
  emitidas: number;
  atendimentos: number;
}

const num = (v: unknown): number => Number(v) || 0;

function addDia(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Faturamento operacional consolidado (filiais 1+11) para o intervalo [ini, fim].
 * Retorna `null` se o Winthor estiver indisponível.
 */
export async function getFaturamentoOperacional(
  ini: string,
  fim: string,
): Promise<FaturamentoOperacional | null> {
  const iniExt = addDia(ini, -1);
  try {
    const [propRows, biRows, atendRows, pesoRows] = await Promise.all([
      queryWinthor<LinhaProp>(SQL_PROP, { iniExt, fim }),
      queryWinthor<LinhaBI>(SQL_BI, { iniExt, fim }),
      queryWinthor<LinhaAtend>(SQL_ATEND, { iniExt, ini, fim }),
      queryWinthor<LinhaPeso>(SQL_PESO, { iniExt, ini, fim }),
    ]);

    // Pesos stay/move por dia-calendário.
    const stay = new Map<string, number>();
    const move = new Map<string, number>();
    for (const r of propRows) {
      (r.MV === "S" ? stay : move).set(r.DIA, num(r.V));
    }
    // Totais autoritativos por dia.
    const bi = new Map<string, number>();
    for (const r of biRows) bi.set(r.DIA, num(r.V));

    // valor = Σ bi(c)·w_stay(c) [op=c ∈ intervalo] + Σ bi(c)·w_move(c) [op=c+1 ∈ intervalo]
    let vendaFaturada = 0;
    const dias = new Set([...bi.keys(), ...stay.keys(), ...move.keys()]);
    for (const c of dias) {
      const s = stay.get(c) ?? 0;
      const m = move.get(c) ?? 0;
      const total = s + m;
      const biC = bi.get(c) ?? 0;
      if (total <= 0 || biC === 0) continue;
      if (c >= ini && c <= fim) vendaFaturada += biC * (s / total); // fica em c
      const opMove = addDia(c, 1);
      if (opMove >= ini && opMove <= fim) vendaFaturada += biC * (m / total); // vai p/ c+1
    }

    // emitidas = notas cujo dia operacional cai no intervalo.
    let emitidas = 0;
    for (const r of propRows) {
      const op = r.MV === "S" ? r.DIA : addDia(r.DIA, 1);
      if (op >= ini && op <= fim) emitidas += num(r.QTD);
    }

    return {
      vendaFaturada,
      pesoFaturadoBrutoKg: num(pesoRows[0]?.PESO),
      emitidas,
      atendimentos: num(atendRows[0]?.ATEND),
    };
  } catch (erro) {
    console.error("[faturamento-operacional] Winthor indisponível:", (erro as Error).message);
    return null;
  }
}

import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import { notaExpedida, motoristaDeEntrega } from "./regras-winthor";
import type { RotaMotorista, TotaisEntrega, DiaSemanaFrota } from "@/domain/telemetria";

// Aba Telemetria & Frota (portada do app Flask, "Análise do Motorista"). Universo
// das entregas = notas EXPEDIDAS em carga com motorista de verdade, saídas no
// período (filiais 1 e 11) — o mesmo da devolução por motorista do Centro. A
// devolução vem da VIEW_DEVOL_RESUMO_FATURAMENTO (VLDEVOLUCAO − IPI − ST, base da
// 111), de qualquer motivo, como no Flask.

const faixa = (col: string) => `${col} >= TO_DATE(:ini,'YYYY-MM-DD') AND ${col} < TO_DATE(:fim,'YYYY-MM-DD') + 1`;
const VL_VIEW = `NVL(v.VLDEVOLUCAO,0) - NVL(v.VLIPI,0) - NVL(v.VLST,0)`;

const vendas = (comMotorista: boolean) => `vendas AS (
  SELECT nf.NUMTRANSVENDA, nf.NUMCAR, nf.CODCLI, TRUNC(nf.DTSAIDA) DIA, car.CODMOTORISTA,
         NVL(nf.VLTOTAL, 0) VALOR, NVL(nf.TOTPESO, 0) PESO
  FROM PCNFSAID nf
  JOIN PCCARREG car ON car.NUMCAR = nf.NUMCAR
  WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")}
    AND NVL(nf.NUMCAR, 0) != 0 AND ${notaExpedida("nf")}
    AND ${motoristaDeEntrega("car.CODMOTORISTA")}
    ${comMotorista ? "AND car.CODMOTORISTA = :motorista" : ""}
),
dev AS (
  SELECT v.NUMTRANSVENDA, SUM(${VL_VIEW}) VL, SUM(NVL(v.TOTPESO, 0)) PESO
  FROM VIEW_DEVOL_RESUMO_FATURAMENTO v
  WHERE ${filialIn("v.CODFILIAL")} AND v.DTENT >= TO_DATE(:ini,'YYYY-MM-DD') AND v.DTCANCEL IS NULL
    AND v.NUMTRANSVENDA IN (SELECT NUMTRANSVENDA FROM vendas)
  GROUP BY v.NUMTRANSVENDA
)`;

// Motorista × cidade do cliente: a tabela "rotas" e a base do mapa e dos KPIs por motorista.
const SQL_ROTAS = `WITH ${vendas(false)}
SELECT s.CODMOTORISTA, MAX(emp.NOME) MOTORISTA, ci.CODIBGE IBGE, NVL(MAX(ci.NOMECIDADE), 'Sem cidade') CIDADE, MAX(ci.UF) UF,
       COUNT(DISTINCT s.NUMCAR) CARGAS, COUNT(DISTINCT s.NUMTRANSVENDA) NOTAS,
       COUNT(DISTINCT TO_CHAR(s.DIA, 'YYYYMMDD') || '-' || s.CODCLI) ENTREGAS,
       COUNT(DISTINCT s.CODCLI) CLIENTES,
       COUNT(DISTINCT CASE WHEN d.NUMTRANSVENDA IS NOT NULL THEN TO_CHAR(s.DIA, 'YYYYMMDD') || '-' || s.CODCLI END) ENTREGAS_DEV,
       COUNT(DISTINCT CASE WHEN d.NUMTRANSVENDA IS NOT NULL THEN s.CODCLI END) CLIENTES_DEV,
       ROUND(SUM(s.PESO), 1) PESO, ROUND(SUM(s.VALOR), 2) VALOR,
       ROUND(SUM(NVL(d.VL, 0)), 2) DEVOLVIDO, ROUND(SUM(NVL(d.PESO, 0)), 1) PESO_DEV
FROM vendas s
LEFT JOIN dev d ON d.NUMTRANSVENDA = s.NUMTRANSVENDA
LEFT JOIN PCEMPR emp ON emp.MATRICULA = s.CODMOTORISTA
LEFT JOIN PCCLIENT cli ON cli.CODCLI = s.CODCLI
LEFT JOIN PCCIDADE ci ON ci.CODCIDADE = cli.CODCIDADE
GROUP BY s.CODMOTORISTA, ci.CODIBGE`;

// Totais sem dupla contagem (cliente atendido por dois motoristas conta uma vez).
const sqlTotais = (comMotorista: boolean) => `WITH ${vendas(comMotorista)}
SELECT COUNT(DISTINCT TO_CHAR(s.DIA, 'YYYYMMDD') || '-' || s.CODCLI) ENTREGAS,
       COUNT(DISTINCT s.CODCLI) CLIENTES,
       COUNT(DISTINCT CASE WHEN d.NUMTRANSVENDA IS NOT NULL THEN TO_CHAR(s.DIA, 'YYYYMMDD') || '-' || s.CODCLI END) ENTREGAS_DEV,
       COUNT(DISTINCT CASE WHEN d.NUMTRANSVENDA IS NOT NULL THEN s.CODCLI END) CLIENTES_DEV,
       ROUND(SUM(s.VALOR), 2) VALOR, ROUND(SUM(NVL(d.VL, 0)), 2) DEVOLVIDO
FROM vendas s LEFT JOIN dev d ON d.NUMTRANSVENDA = s.NUMTRANSVENDA`;

// Dia da semana pela data da venda ("Dia faturado"): faturado e devolvido dessas notas.
const sqlSemanaFat = (comMotorista: boolean) => `WITH ${vendas(comMotorista)}
SELECT s.DIA - TRUNC(s.DIA, 'IW') DS,
       ROUND(SUM(s.VALOR), 2) VALOR, ROUND(SUM(s.PESO), 1) PESO,
       ROUND(SUM(NVL(d.VL, 0)), 2) DEVOLVIDO, ROUND(SUM(NVL(d.PESO, 0)), 1) PESO_DEV
FROM vendas s LEFT JOIN dev d ON d.NUMTRANSVENDA = s.NUMTRANSVENDA
GROUP BY s.DIA - TRUNC(s.DIA, 'IW')`;

// Dia da semana pela entrada da devolução ("Entrada dev."): devoluções que entraram
// no período, de notas entregues por motorista (o do filtro, se houver).
const sqlSemanaEnt = (comMotorista: boolean) => `
SELECT TRUNC(v.DTENT) - TRUNC(TRUNC(v.DTENT), 'IW') DS,
       ROUND(SUM(${VL_VIEW}), 2) DEVOLVIDO, ROUND(SUM(NVL(v.TOTPESO, 0)), 1) PESO_DEV
FROM VIEW_DEVOL_RESUMO_FATURAMENTO v
JOIN PCNFSAID nf ON nf.NUMTRANSVENDA = v.NUMTRANSVENDA
JOIN PCCARREG car ON car.NUMCAR = nf.NUMCAR
WHERE ${filialIn("v.CODFILIAL")} AND ${faixa("v.DTENT")} AND v.DTCANCEL IS NULL
  AND ${motoristaDeEntrega("car.CODMOTORISTA")}
  ${comMotorista ? "AND car.CODMOTORISTA = :motorista" : ""}
GROUP BY TRUNC(v.DTENT) - TRUNC(TRUNC(v.DTENT), 'IW')`;

const n = (v: unknown) => (v == null ? 0 : Number(v));
const s = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());

/** Motorista × cidade das entregas do período (todos os motoristas). */
export const lerRotas = cache(async (ini: string, fim: string): Promise<RotaMotorista[]> => {
  const rows = await queryWinthor<Record<string, unknown>>(SQL_ROTAS, { ini, fim });
  return rows.map((r) => ({
    codMotorista: n(r.CODMOTORISTA),
    motorista: s(r.MOTORISTA) ?? `Motorista ${r.CODMOTORISTA}`,
    ibge: s(r.IBGE),
    cidade: s(r.UF) ? `${s(r.CIDADE)} · ${s(r.UF)}` : (s(r.CIDADE) ?? "Sem cidade"),
    cargas: n(r.CARGAS),
    notas: n(r.NOTAS),
    entregas: n(r.ENTREGAS),
    clientes: n(r.CLIENTES),
    entregasDev: n(r.ENTREGAS_DEV),
    clientesDev: n(r.CLIENTES_DEV),
    peso: n(r.PESO),
    valor: n(r.VALOR),
    devolvido: n(r.DEVOLVIDO),
    pesoDev: n(r.PESO_DEV),
  }));
});

/** Totais de entrega do período, sem contar duas vezes o cliente de dois motoristas. */
export async function lerTotaisEntrega(ini: string, fim: string, motorista: number | null): Promise<TotaisEntrega> {
  const binds = motorista === null ? { ini, fim } : { ini, fim, motorista };
  const [r] = await queryWinthor<Record<string, unknown>>(sqlTotais(motorista !== null), binds);
  return {
    entregas: n(r?.ENTREGAS), clientes: n(r?.CLIENTES), entregasDev: n(r?.ENTREGAS_DEV), clientesDev: n(r?.CLIENTES_DEV),
    valor: n(r?.VALOR), devolvido: n(r?.DEVOLVIDO),
  };
}

/** Devolução por dia da semana (0 = segunda) nas duas bases: dia faturado e entrada da devolução. */
export async function lerDiaSemanaFrota(ini: string, fim: string, motorista: number | null): Promise<DiaSemanaFrota[]> {
  const binds = motorista === null ? { ini, fim } : { ini, fim, motorista };
  const [fat, ent] = await Promise.all([
    queryWinthor<Record<string, unknown>>(sqlSemanaFat(motorista !== null), binds),
    queryWinthor<Record<string, unknown>>(sqlSemanaEnt(motorista !== null), binds),
  ]);
  const porFat = new Map(fat.map((r) => [n(r.DS), r]));
  const porEnt = new Map(ent.map((r) => [n(r.DS), r]));
  return Array.from({ length: 7 }, (_, ds) => {
    const f = porFat.get(ds);
    const e = porEnt.get(ds);
    return {
      ds,
      faturado: n(f?.VALOR), pesoFaturado: n(f?.PESO),
      devolvidoFat: n(f?.DEVOLVIDO), pesoDevFat: n(f?.PESO_DEV),
      devolvidoEnt: n(e?.DEVOLVIDO), pesoDevEnt: n(e?.PESO_DEV),
    };
  });
}

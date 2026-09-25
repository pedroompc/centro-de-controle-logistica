import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import { getSerieFaturamento } from "./faturamento-mensal";
import { getResumoFaturamentoMesAtual } from "./faturamento";
import { getNucleoDevolucao } from "./devolucoes";
import { getMovimentosMensais } from "./wms";
import { listarFaltas } from "./faltas";
import { mesAnterior, mesProximo, primeiroDiaDoMes, inicioFimDoMes } from "@/domain/periodo";
import { janelaGestao, mesAnoAnterior, MES_VAZIO, type MesGestao, type ServicoMes } from "@/domain/gestao";

/*
 * Painel de gestão: junta, por mês, o que já está validado no app —
 * faturamento (rotina 111), devolução por setor, movimentação do Harpia e faltas —
 * e acrescenta o nível de serviço (liberação do pedido → nota autorizada).
 */

// Dias de calendário entre a liberação e a autorização da nota. Usa TRUNC nos
// dois lados: funciona mesmo que DTLIBERA não tenha hora gravada.
const DIAS = `(TRUNC(n.AUT) - TRUNC(NVL(p.DTLIBERA, p.DATA)))`;
const HORAS = `((n.AUT - NVL(p.DTLIBERA, p.DATA)) * 24)`;

// Um pedido = primeira nota autorizada dele (venda VP/VV, não cancelada, filiais do app).
// Horas só entram na mediana/P90 quando a liberação tem hora de verdade e não é negativa.
const SQL_SERVICO = `
SELECT TO_CHAR(TRUNC(n.AUT, 'MM'), 'YYYY-MM-DD') MES,
       COUNT(*) PEDIDOS,
       SUM(CASE WHEN ${DIAS} <= 0 THEN 1 ELSE 0 END) ATE_D0,
       SUM(CASE WHEN ${DIAS} <= 1 THEN 1 ELSE 0 END) ATE_D1,
       SUM(CASE WHEN ${DIAS} >= 3 THEN 1 ELSE 0 END) D3_MAIS,
       SUM(CASE WHEN p.DTLIBERA <> TRUNC(p.DTLIBERA) THEN 1 ELSE 0 END) COM_HORA,
       MEDIAN(CASE WHEN p.DTLIBERA <> TRUNC(p.DTLIBERA) AND ${HORAS} >= 0 THEN ${HORAS} END) MEDIANA_H,
       PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY
         CASE WHEN p.DTLIBERA <> TRUNC(p.DTLIBERA) AND ${HORAS} >= 0 THEN ${HORAS} END) P90_H
  FROM (SELECT nf.NUMPED, MIN(nf.DTHORAAUTORIZACAOSEFAZ) AUT
          FROM PCNFSAID nf
         WHERE ${filialIn("nf.CODFILIAL")}
           AND nf.TIPOVENDA IN ('VP', 'VV')
           AND nf.DTCANCEL IS NULL
           AND nf.NUMPED > 0
           AND nf.DTHORAAUTORIZACAOSEFAZ >= TO_DATE(:ini, 'YYYY-MM-DD')
           AND nf.DTHORAAUTORIZACAOSEFAZ <  TO_DATE(:fim, 'YYYY-MM-DD')
         GROUP BY nf.NUMPED) n
  JOIN PCPEDC p ON p.NUMPED = n.NUMPED
 GROUP BY TRUNC(n.AUT, 'MM')`;

// Com menos que isso das liberações com hora, a mediana em horas não representa o mês.
const MIN_FRACAO_COM_HORA = 0.8;

const num = (v: unknown): number => Number(v) || 0;
const talvez = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

async function servicoPorMes(ini: string, fimExcl: string): Promise<Map<string, ServicoMes> | null> {
  try {
    const rows = await queryWinthor<Record<string, unknown>>(SQL_SERVICO, { ini, fim: fimExcl });
    const mapa = new Map<string, ServicoMes>();
    for (const r of rows) {
      const pedidos = num(r.PEDIDOS);
      const comHora = num(r.COM_HORA);
      const horasValidas = pedidos > 0 && comHora / pedidos >= MIN_FRACAO_COM_HORA;
      mapa.set(String(r.MES), {
        pedidos,
        ateD0: num(r.ATE_D0),
        ateD1: num(r.ATE_D1),
        d3mais: num(r.D3_MAIS),
        comHora,
        medianaHoras: horasValidas ? talvez(r.MEDIANA_H) : null,
        p90Horas: horasValidas ? talvez(r.P90_H) : null,
      });
    }
    return mapa;
  } catch (erro) {
    console.error("[gestao] nível de serviço indisponível:", (erro as Error).message);
    return null;
  }
}

async function devLogisticaDoMes(mes: string): Promise<number | null> {
  const { inicio, fim } = inicioFimDoMes(mes);
  const r = await getNucleoDevolucao(inicio, fim);
  if (!r) return null;
  return r.porSetor.find((s) => s.setor === "Logística")?.valor ?? 0;
}

async function faltasPorMes(): Promise<Map<string, number> | null> {
  try {
    const faltas = await listarFaltas();
    const mapa = new Map<string, number>();
    for (const f of faltas) {
      const mes = primeiroDiaDoMes(f.data);
      mapa.set(mes, (mapa.get(mes) ?? 0) + 1);
    }
    return mapa;
  } catch (erro) {
    console.error("[gestao] faltas indisponíveis:", (erro as Error).message);
    return null;
  }
}

export interface PainelGestao {
  mes: string;
  serie: MesGestao[]; // 13 meses, do mais antigo ao `mes`
  indisponivel: string[];
  primeiroMesFaltas: string | null; // antes disso, faltas = sem dado (não havia lançamento)
}

/** Painel de gestão para `mes` (13 meses de série: dá o mês anterior e o mesmo mês do ano passado). */
export const getPainelGestao = cache(async (mes: string): Promise<PainelGestao> => {
  const meses = janelaGestao(mes);
  const ini = meses[0];
  const fimExcl = mesProximo(meses[meses.length - 1]);
  const atual = primeiroDiaDoMes();
  const fechados = meses.filter((m) => m < atual);
  const indisponivel: string[] = [];

  const [fat, fatCorrente, servico, mov, faltas, devAtual, devAnt, devAno] = await Promise.all([
    getSerieFaturamento(fechados).catch(() => []),
    meses.includes(atual) ? getResumoFaturamentoMesAtual() : Promise.resolve(null),
    servicoPorMes(ini, fimExcl),
    getMovimentosMensais(ini, fimExcl),
    faltasPorMes(),
    devLogisticaDoMes(mes),
    devLogisticaDoMes(mesAnterior(mes)),
    devLogisticaDoMes(mesAnoAnterior(mes)),
  ]);

  if (fat.length < fechados.length) indisponivel.push("faturamento de alguns meses");
  if (!servico) indisponivel.push("nível de serviço");
  if (!mov) indisponivel.push("movimentação do WMS");
  if (!faltas) indisponivel.push("faltas");

  const fatPorMes = new Map(fat.map((p) => [p.mes, p]));
  const dev = new Map<string, number | null>([
    [mes, devAtual], [mesAnterior(mes), devAnt], [mesAnoAnterior(mes), devAno],
  ]);
  const mesesComFalta = faltas ? [...faltas.keys()].sort() : [];
  const primeiroMesFaltas = mesesComFalta[0] ?? null;

  const serie = meses.map((m): MesGestao => {
    const base = MES_VAZIO(m);
    const f = fatPorMes.get(m);
    const r = m === atual ? fatCorrente : null;
    const fonte = f
      ? { vendaFaturada: f.vendaFaturada, vendaLiquida: f.vendaLiquida, valorDevolucao: f.valorDevolucao, pesoKg: f.pesoFaturado, entregas: f.atendimentos, notas: f.emitidas }
      : r
        ? { vendaFaturada: r.vendaFaturada, vendaLiquida: r.vendaLiquida, valorDevolucao: r.valorDevolucao, pesoKg: r.pesoFaturado, entregas: r.atendimentos, notas: r.emitidas }
        : {};
    const mv = mov?.get(m);
    return {
      ...base,
      ...fonte,
      devLogistica: dev.get(m) ?? null,
      servico: servico?.get(m) ?? null,
      // Mês sem nenhum movimento no WMS = antes da implantação, não zero.
      movVerticais: mv ? mv.verticais : null,
      movHorizontais: mv ? mv.horizontais : null,
      faltas: faltas && primeiroMesFaltas && m >= primeiroMesFaltas ? faltas.get(m) ?? 0 : null,
    };
  });

  return { mes, serie, indisponivel, primeiroMesFaltas };
});

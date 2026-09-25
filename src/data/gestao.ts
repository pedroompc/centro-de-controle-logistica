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

// Duas faixas de data: assim a comparação lê só os meses que usa (mês + anterior, e o
// mesmo mês do ano passado) em vez de 13 meses. Faixa vazia = ini e fim iguais.
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
           AND ((nf.DTHORAAUTORIZACAOSEFAZ >= TO_DATE(:ini1, 'YYYY-MM-DD')
                 AND nf.DTHORAAUTORIZACAOSEFAZ <  TO_DATE(:fim1, 'YYYY-MM-DD'))
             OR (nf.DTHORAAUTORIZACAOSEFAZ >= TO_DATE(:ini2, 'YYYY-MM-DD')
                 AND nf.DTHORAAUTORIZACAOSEFAZ <  TO_DATE(:fim2, 'YYYY-MM-DD')))
         GROUP BY nf.NUMPED) n
  JOIN PCPEDC p ON p.NUMPED = n.NUMPED
 GROUP BY TRUNC(n.AUT, 'MM')`;

// Com menos que isso das liberações com hora, a mediana em horas não representa o mês.
const MIN_FRACAO_COM_HORA = 0.8;

const num = (v: unknown): number => Number(v) || 0;
const talvez = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

type Faixa = { ini: string; fim: string }; // fim exclusivo

async function servicoPorMes(f1: Faixa, f2: Faixa): Promise<Map<string, ServicoMes> | null> {
  try {
    const rows = await queryWinthor<Record<string, unknown>>(SQL_SERVICO, {
      ini1: f1.ini, fim1: f1.fim, ini2: f2.ini, fim2: f2.fim,
    });
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
  serie: MesGestao[]; // meses carregados, do mais antigo ao mais novo
  indisponivel: string[];
  primeiroMesFaltas: string | null; // antes disso, faltas = sem dado (não havia lançamento)
}

/**
 * Monta os meses pedidos. As consultas cobrem só as faixas `f1`/`f2`, e o
 * faturamento é calculado só para os meses da lista — nada de 13 meses de
 * WinThor quando a tela compara três.
 */
async function montar(mes: string, meses: string[], f1: Faixa, f2: Faixa, comDevLogistica: string[]): Promise<PainelGestao> {
  const atual = primeiroDiaDoMes();
  const fechados = meses.filter((m) => m < atual);
  const indisponivel: string[] = [];

  const [fat, fatCorrente, servico, mov1, mov2, faltas, ...devs] = await Promise.all([
    getSerieFaturamento(fechados).catch(() => []),
    meses.includes(atual) ? getResumoFaturamentoMesAtual() : Promise.resolve(null),
    servicoPorMes(f1, f2),
    getMovimentosMensais(f1.ini, f1.fim),
    f2.ini < f2.fim ? getMovimentosMensais(f2.ini, f2.fim) : Promise.resolve(new Map()),
    faltasPorMes(),
    ...comDevLogistica.map((m) => devLogisticaDoMes(m)),
  ]);

  if (fat.length < fechados.length) indisponivel.push("faturamento de algum mês");
  if (!servico) indisponivel.push("nível de serviço");
  if (!mov1 || !mov2) indisponivel.push("movimentação do WMS");
  if (!faltas) indisponivel.push("faltas");

  const fatPorMes = new Map(fat.map((p) => [p.mes, p]));
  const mov = new Map([...(mov1 ?? []), ...(mov2 ?? [])]);
  const dev = new Map(comDevLogistica.map((m, i) => [m, devs[i] as number | null]));
  const primeiroMesFaltas = faltas ? [...faltas.keys()].sort()[0] ?? null : null;

  const serie = meses.map((m): MesGestao => {
    const f = fatPorMes.get(m);
    const r = m === atual ? fatCorrente : null;
    const fonte = f
      ? { vendaFaturada: f.vendaFaturada, vendaLiquida: f.vendaLiquida, valorDevolucao: f.valorDevolucao, pesoKg: f.pesoFaturado, entregas: f.atendimentos, notas: f.emitidas }
      : r
        ? { vendaFaturada: r.vendaFaturada, vendaLiquida: r.vendaLiquida, valorDevolucao: r.valorDevolucao, pesoKg: r.pesoFaturado, entregas: r.atendimentos, notas: r.emitidas }
        : {};
    const mv = mov.get(m);
    return {
      ...MES_VAZIO(m),
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
}

/** Comparativo: o mês, o anterior e o mesmo mês do ano passado — só esses 3 são lidos. */
export const getPainelGestao = cache(async (mes: string): Promise<PainelGestao> => {
  const ant = mesAnterior(mes);
  const ano = mesAnoAnterior(mes);
  return montar(
    mes,
    [ano, ant, mes],
    { ini: ant, fim: mesProximo(mes) },
    { ini: ano, fim: mesProximo(ano) },
    [ano, ant, mes],
  );
});

/**
 * Evolução de 13 meses — carregada só quando o gestor pede (é a parte lenta:
 * meses ainda não congelados no Supabase são calculados do WinThor um a um).
 * Devolução logística fica de fora: a quebra por motivo mês a mês pesaria demais.
 */
export const getEvolucaoGestao = cache(async (mes: string): Promise<PainelGestao> => {
  const meses = janelaGestao(mes);
  const faixa = { ini: meses[0], fim: mesProximo(mes) };
  return montar(mes, meses, faixa, { ini: mes, fim: mes }, []);
});

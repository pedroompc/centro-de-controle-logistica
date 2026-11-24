// Base do "custo para atender cada região" (Relatório geral de custos): notas,
// peso, venda e viagens do mês por região, mais o km do rastreador.
//
// Venda na MESMA base do faturamento do Início (VIEW_VENDAS_RESUMO_FATURAMENTO,
// líquida de ST/IPI/devolução na nota) — a soma das regiões bate com o
// faturamento do mês. Nota em carga com motorista de verdade = entrega (vai
// para a região da cidade do cliente); senão = retira.
import { queryWinthor } from "@/lib/oracle/client";
import { getRotas } from "./calendario-rotas";
import { lerHodometroPeriodo } from "./frota-km";
import { filialIn } from "./filiais";
import { motoristaDeEntrega } from "./regras-winthor";
import { criarIndiceCalendario } from "@/domain/pedidos-a-faturar/calendario";
import { mapaKmDia, normalizarPlaca } from "@/domain/frota";
import { baseDasRegioes, regiaoDaCidade, type BaseRegiao, type TrechoRegiao } from "@/domain/custo-regioes";

const SQL = `
WITH v AS (
  SELECT a.NUMTRANSVENDA,
         SUM(NVL(a.VLVENDA, 0) - NVL(a.ICMSRETIDO, 0) - NVL(a.VLIPI, 0) - NVL(a.VLDEVOLCLI, 0)) VL
    FROM VIEW_VENDAS_RESUMO_FATURAMENTO a
   WHERE a.CONDVENDA IN (0, 1, 5, 7, 9, 11, 14)
     AND a.CODFISCAL NOT IN (522, 622, 722, 532, 632, 732)
     AND ${filialIn("a.CODFILIAL")}
     AND a.DTSAIDA >= TO_DATE(:ini, 'YYYY-MM-DD') AND a.DTSAIDA < TO_DATE(:fim, 'YYYY-MM-DD') + 1
   GROUP BY a.NUMTRANSVENDA
),
n AS (
  SELECT v.VL, TRUNC(nf.DTSAIDA) DIA, nf.CODCLI, NVL(nf.TOTPESO, 0) PESO,
         car.CODVEICULO, car.CODMOTORISTA,
         CASE WHEN ${motoristaDeEntrega("car.CODMOTORISTA")} THEN 1 ELSE 0 END ENTREGA
    FROM v
    LEFT JOIN PCNFSAID nf ON nf.NUMTRANSVENDA = v.NUMTRANSVENDA
    LEFT JOIN PCCARREG car ON car.NUMCAR = nf.NUMCAR
),
g AS (
  SELECT n.*, CASE WHEN ENTREGA = 1
                   THEN NVL(CODVEICULO, 0) || '-' || CODMOTORISTA || '-' || TO_CHAR(DIA, 'YYYYMMDD') END VIAGEM
    FROM n
)
SELECT g.VIAGEM, MAX(ve.PLACA) PLACA, TO_CHAR(MIN(g.DIA), 'YYYY-MM-DD') DIA,
       c.MUNICENT CIDADE, c.ESTENT UF,
       COUNT(*) NOTAS, SUM(g.PESO) PESO, SUM(g.VL) VALOR,
       COUNT(DISTINCT g.CODCLI || '-' || TO_CHAR(g.DIA, 'YYYYMMDD')) ENTREGAS
  FROM g
  LEFT JOIN PCVEICUL ve ON ve.CODVEICULO = g.CODVEICULO
  LEFT JOIN PCCLIENT c ON c.CODCLI = g.CODCLI
 GROUP BY g.VIAGEM, c.MUNICENT, c.ESTENT`;

const num = (v: unknown) => (v == null ? 0 : Number(v));
const str = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());

export interface BaseRegioesMes {
  regioes: BaseRegiao[];
  /** Placas com viagem no mês e sem rastreador (km estimado pela média da região). */
  viagensSemRastreador: number;
  viagens: number;
}

/** Base por região de [ini, fim]; `null` se o Winthor cair. */
export async function lerBaseRegioes(ini: string, fim: string): Promise<BaseRegioesMes | null> {
  try {
    const [rows, rotas, hodometro] = await Promise.all([
      queryWinthor<Record<string, unknown>>(SQL, { ini, fim }),
      getRotas(),
      lerHodometroPeriodo(ini, fim),
    ]);
    const indice = criarIndiceCalendario(rotas ?? []);
    const regiaoOp = (c: string | null) => indice.buscar(c)?.regiaoOperacional ?? null;
    const trechos: TrechoRegiao[] = rows.map((r) => {
      const viagem = str(r.VIAGEM);
      return {
        viagem,
        placa: str(r.PLACA),
        dia: String(r.DIA),
        regiao: viagem === null ? "Retira" : regiaoDaCidade(str(r.CIDADE), str(r.UF), regiaoOp),
        notas: num(r.NOTAS),
        peso: num(r.PESO),
        valor: num(r.VALOR),
        entregas: num(r.ENTREGAS),
      };
    });
    const kmDia = mapaKmDia(hodometro ?? []);
    const rastreadas = new Set([...kmDia.keys()].map((k) => k.split("|")[0]));
    const viagens = new Map<string, string | null>();
    for (const t of trechos) if (t.viagem) viagens.set(t.viagem, t.placa);
    const semRastreador = [...viagens.values()].filter((p) => !rastreadas.has(normalizarPlaca(p))).length;
    return { regioes: baseDasRegioes(trechos, kmDia, fim), viagensSemRastreador: semRastreador, viagens: viagens.size };
  } catch (erro) {
    console.error("[custo-regioes] indisponível:", (erro as Error).message);
    return null;
  }
}

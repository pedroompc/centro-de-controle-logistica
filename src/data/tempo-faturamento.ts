import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import type { LinhaTempo } from "@/domain/tempo-faturamento";

// Horas do pedido liberado até a nota, por pedido faturado no período.
// Liberação = DTLIBERA (liberado à mão após bloqueio); senão o horário do pedido
// (nasceu liberado — DTLIBERA só é gravada quando há CODFUNCLIBERA).
// Faturamento = DTFAT (sem hora) + HORAFAT/MINUTOFAT.
const HORAS = `((ped.DTFAT + ped.HORAFAT/24 + ped.MINUTOFAT/1440)
  - NVL(ped.DTLIBERA, TRUNC(ped.DATA) + ped.HORA/24 + ped.MINUTO/1440)) * 24`;

const FILTRO = `${filialIn("ped.CODFILIAL")}
  AND ped.POSICAO = 'F'
  AND ped.CODUSUR != 4
  AND ped.DTFAT >= TO_DATE(:ini, 'YYYY-MM-DD') AND ped.DTFAT <= TO_DATE(:fim, 'YYYY-MM-DD')`;

// Histograma cidade × hora inteira: a mediana sai exata sem trazer 24 mil linhas.
// Tempo negativo (faturado "antes" de liberar) é ruído de cadastro — fica de fora.
const SQL_HISTOGRAMA = `
SELECT cli.MUNICENT AS CIDADE, cli.ESTENT AS UF, FLOOR(${HORAS}) AS HORAS, COUNT(*) AS QTD
FROM PCPEDC ped
LEFT JOIN PCCLIENT cli ON cli.CODCLI = ped.CODCLI
WHERE ${FILTRO} AND ${HORAS} >= 0
GROUP BY cli.MUNICENT, cli.ESTENT, FLOOR(${HORAS})`;

// Quanto o pedido bloqueado espera até alguém liberar (só quem passou por liberação manual).
const SQL_LIBERACAO = `
SELECT AVG((ped.DTLIBERA - (TRUNC(ped.DATA) + ped.HORA/24 + ped.MINUTO/1440)) * 24) AS HORAS
FROM PCPEDC ped
WHERE ${FILTRO} AND ped.DTLIBERA IS NOT NULL
  AND ped.DTLIBERA >= TRUNC(ped.DATA) + ped.HORA/24 + ped.MINUTO/1440`;

const str = (v: unknown): string | null => (v == null ? null : String(v));

export async function lerTemposFaturamento(ini: string, fim: string): Promise<{ linhas: LinhaTempo[]; liberacaoManualH: number | null }> {
  const binds = { ini, fim };
  const [hist, lib] = await Promise.all([
    queryWinthor<Record<string, unknown>>(SQL_HISTOGRAMA, binds),
    queryWinthor<Record<string, unknown>>(SQL_LIBERACAO, binds),
  ]);
  const h = lib[0]?.HORAS;
  return {
    linhas: hist.map((r) => ({ cidade: str(r.CIDADE), uf: str(r.UF), horas: Number(r.HORAS), qtd: Number(r.QTD) })),
    liberacaoManualH: h == null ? null : Number(h),
  };
}

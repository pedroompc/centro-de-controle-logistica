import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import type { TipoMotorista, ViagemEntrega } from "@/domain/motoristas";

// Universo: notas de VENDA em carga, das filiais do dashboard, pela data de
// saída da nota (mesmo universo das "expedidas" da devolução por motorista —
// bonificação/brinde/transferência fora pelo CONDVENDA). Motorista 9996 é o
// pseudo-motorista DIALOG (balcão), fora.
const NF = `
nf AS (
  SELECT n.NUMCAR, TRUNC(n.DTSAIDA) DIA, n.CODCLI, NVL(n.TOTPESO, 0) PESO, NVL(n.VLTOTAL, 0) VL
  FROM PCNFSAID n
  WHERE ${filialIn("n.CODFILIAL")}
    AND n.DTSAIDA >= TO_DATE(:ini, 'YYYY-MM-DD') AND n.DTSAIDA < TO_DATE(:fim, 'YYYY-MM-DD') + 1
    AND NVL(n.NUMCAR, 0) != 0
    AND NVL(n.CONDVENDA, 0) NOT IN (4,8,10,13,20,98,99)
    AND n.DTCANCEL IS NULL
),
viagem AS (
  SELECT nf.DIA, NVL(c.CODVEICULO, 0) CODVEICULO, c.CODMOTORISTA,
         STATS_MODE(NULLIF(c.CODFUNCAJUD, 0)) CODAJUD,
         COUNT(DISTINCT nf.NUMCAR) CARGAS, COUNT(*) NOTAS, COUNT(DISTINCT nf.CODCLI) ENTREGAS,
         SUM(nf.PESO) KG, SUM(nf.VL) VALOR
  FROM nf
  JOIN PCCARREG c ON c.NUMCAR = nf.NUMCAR
  WHERE NVL(c.CODMOTORISTA, 0) NOT IN (0, 9996) AND c.DT_CANCEL IS NULL
  GROUP BY nf.DIA, NVL(c.CODVEICULO, 0), c.CODMOTORISTA
)`;

const SQL_VIAGENS = `
WITH ${NF}
SELECT TO_CHAR(vg.DIA, 'YYYY-MM-DD') DIA, vg.CODVEICULO, ve.PLACA, ve.DESCRICAO, ve.PESOCARGAKG,
       vg.CODMOTORISTA, mo.NOME NOME_MOT, mo.TIPOMOTORISTA, vg.CODAJUD, aj.NOME NOME_AJUD,
       vg.CARGAS, vg.NOTAS, vg.ENTREGAS, vg.KG, vg.VALOR
FROM viagem vg
LEFT JOIN PCVEICUL ve ON ve.CODVEICULO = vg.CODVEICULO
LEFT JOIN PCEMPR mo ON mo.MATRICULA = vg.CODMOTORISTA
LEFT JOIN PCEMPR aj ON aj.MATRICULA = vg.CODAJUD
ORDER BY vg.DIA, vg.CODVEICULO`;

// Mês a mês (histórico do custo por entrega / tonelada).
const SQL_MESES = `
WITH ${NF}
SELECT TO_CHAR(TRUNC(DIA, 'MM'), 'YYYY-MM-DD') MES, COUNT(*) VIAGENS, SUM(ENTREGAS) ENTREGAS,
       SUM(NOTAS) NOTAS, SUM(KG) KG, COUNT(DISTINCT DIA) DIAS
FROM viagem
GROUP BY TRUNC(DIA, 'MM')
ORDER BY 1`;

const str = (v: unknown): string | null => (v == null || String(v).trim() === "" ? null : String(v).trim());
const num = (v: unknown): number => (v == null ? 0 : Number(v));
const numOuNull = (v: unknown): number | null => (v == null || Number(v) <= 0 ? null : Number(v));

function ultimoDia(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(a, m, 0).getDate();
  return `${mes.slice(0, 7)}-${String(d).padStart(2, "0")}`;
}

/** Viagens (veículo + motorista + dia) do mês "yyyy-mm-01". */
export async function lerViagensMes(mes: string): Promise<ViagemEntrega[]> {
  const rows = await queryWinthor<Record<string, unknown>>(SQL_VIAGENS, { ini: mes, fim: ultimoDia(mes) });
  return rows.map((r) => {
    const tipo = str(r.TIPOMOTORISTA);
    return {
      dia: String(r.DIA),
      veiculo: num(r.CODVEICULO),
      placa: str(r.PLACA),
      descricaoVeiculo: str(r.DESCRICAO),
      capacidadeKg: numOuNull(r.PESOCARGAKG),
      motorista: num(r.CODMOTORISTA),
      nomeMotorista: str(r.NOME_MOT),
      tipoMotorista: (tipo === "F" || tipo === "T" ? tipo : null) as TipoMotorista,
      ajudante: r.CODAJUD == null ? null : num(r.CODAJUD),
      nomeAjudante: str(r.NOME_AJUD),
      cargas: num(r.CARGAS),
      notas: num(r.NOTAS),
      entregas: num(r.ENTREGAS),
      kg: num(r.KG),
      valor: num(r.VALOR),
    };
  });
}

export interface EntregasDoMes {
  mes: string;
  viagens: number;
  entregas: number;
  notas: number;
  kg: number;
  dias: number;
}

/** Totais por mês de `ini` ("yyyy-mm-01") até o fim do mês `fim`. */
export async function lerEntregasMeses(ini: string, fim: string): Promise<EntregasDoMes[]> {
  const rows = await queryWinthor<Record<string, unknown>>(SQL_MESES, { ini, fim: ultimoDia(fim) });
  return rows.map((r) => ({
    mes: String(r.MES),
    viagens: num(r.VIAGENS),
    entregas: num(r.ENTREGAS),
    notas: num(r.NOTAS),
    kg: num(r.KG),
    dias: num(r.DIAS),
  }));
}

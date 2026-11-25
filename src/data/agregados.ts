import { queryWinthor } from "@/lib/oracle/client";
import { lembrar, ttlDoPeriodo } from "@/lib/cache-memoria";
import { filialIn } from "./filiais";
import { notaExpedida, motoristaDeEntrega } from "./regras-winthor";
import { listarFuncionarios } from "./funcionarios";
import { listarSetores } from "./setores";
import { serieEfetivoSetorMensal } from "./efetivo-mensal";
import { ehSetorMotoristas } from "@/domain/motoristas";
import { hojeISO } from "@/domain/fechamento";
import { inicioFimDoMes, mesesDoPeriodo, type Periodo } from "@/domain/periodo";
import {
  casarMatriculas,
  montarAgregados,
  normNome,
  totaisCasa,
  type RelatorioAgregados,
  type OperacaoPessoa,
  type PagamentoFornecedor,
} from "@/domain/agregados";

// Agregado = fornecedor que já recebeu na conta 13 (PRESTAÇÃO DE SERVIÇO) com
// "agregado" no histórico — a mesma regra da linha "Terceiros · Agregados" que o
// coletor grava no custo (scripts/coletor-frota/custo-terceiros.mjs).
export const SQL_PAGAMENTOS = `
WITH ag AS (
  SELECT DISTINCT a.CODFORNEC FROM PCLANC a
  WHERE ${filialIn("a.CODFILIAL")} AND a.CODCONTA = 13 AND a.DTCANCEL IS NULL
    AND a.DTLANC >= DATE '2025-01-01' AND UPPER(a.HISTORICO) LIKE '%AGREG%'
)
SELECT l.CODFORNEC, MAX(f.FORNECEDOR) NOME, MAX(f.CGC) CGC, SUM(l.VALOR) CUSTO,
       COUNT(DISTINCT TRUNC(l.DTLANC)) LOTES, TO_CHAR(MAX(l.DTLANC), 'YYYY-MM-DD') ULTIMO
FROM PCLANC l
JOIN ag ON ag.CODFORNEC = l.CODFORNEC
LEFT JOIN PCFORNEC f ON f.CODFORNEC = l.CODFORNEC
WHERE ${filialIn("l.CODFILIAL")} AND l.CODCONTA = 13 AND l.DTCANCEL IS NULL
  AND l.DTLANC >= TO_DATE(:ini, 'YYYY-MM-DD') AND l.DTLANC < TO_DATE(:fim, 'YYYY-MM-DD') + 1
GROUP BY l.CODFORNEC
HAVING ABS(SUM(l.VALOR)) > 0.005`;

// O que cada matrícula rodou, como motorista e como ajudante. Universo = o do BI
// Motoristas (nota de venda em carga, pela saída da nota). Devolução = base
// "faturamento" da aba Devoluções: o que voltou, de qualquer data a partir do
// início, das notas saídas no período (valor líquido da VIEW_DEVOL_RESUMO_FATURAMENTO).
export const SQL_OPERACAO = `
WITH nf AS (
  SELECT n.NUMTRANSVENDA, n.NUMCAR, TRUNC(n.DTSAIDA) DIA, n.CODCLI, NVL(n.TOTPESO, 0) PESO, NVL(n.VLTOTAL, 0) VL
  FROM PCNFSAID n
  WHERE ${filialIn("n.CODFILIAL")}
    AND n.DTSAIDA >= TO_DATE(:ini, 'YYYY-MM-DD') AND n.DTSAIDA < TO_DATE(:fim, 'YYYY-MM-DD') + 1
    AND NVL(n.NUMCAR, 0) != 0 AND ${notaExpedida("n")}
),
dev AS (
  SELECT v.NUMTRANSVENDA, SUM(NVL(v.VLDEVOLUCAO,0) - NVL(v.VLIPI,0) - NVL(v.VLST,0)) VL
  FROM VIEW_DEVOL_RESUMO_FATURAMENTO v
  WHERE ${filialIn("v.CODFILIAL")} AND v.DTCANCEL IS NULL AND v.DTENT >= TO_DATE(:ini, 'YYYY-MM-DD')
    AND v.NUMTRANSVENDA IN (SELECT NUMTRANSVENDA FROM nf)
  GROUP BY v.NUMTRANSVENDA
),
nfc AS (
  SELECT nf.*, NVL(c.CODVEICULO, 0) VEIC, c.CODMOTORISTA, NVL(c.CODFUNCAJUD, 0) AJUD, dev.VL DEVOLVIDO
  FROM nf
  JOIN PCCARREG c ON c.NUMCAR = nf.NUMCAR
  LEFT JOIN dev ON dev.NUMTRANSVENDA = nf.NUMTRANSVENDA
  WHERE ${motoristaDeEntrega("c.CODMOTORISTA")} AND c.DT_CANCEL IS NULL
),
papel AS (
  SELECT CODMOTORISTA MAT, 'motorista' PAPEL, nfc.* FROM nfc
  UNION ALL
  SELECT AJUD MAT, 'ajudante' PAPEL, nfc.* FROM nfc WHERE AJUD != 0
)
SELECT p.MAT, p.PAPEL, MAX(e.NOME) NOME, MAX(e.CPF) CPF,
       COUNT(DISTINCT p.DIA) DIAS,
       COUNT(DISTINCT TO_CHAR(p.DIA, 'YYYYMMDD') || '-' || p.VEIC) VIAGENS,
       COUNT(DISTINCT p.NUMTRANSVENDA) NOTAS,
       COUNT(DISTINCT TO_CHAR(p.DIA, 'YYYYMMDD') || '-' || p.VEIC || '-' || p.CODCLI) ENTREGAS,
       SUM(p.PESO) KG, SUM(p.VL) FATURADO,
       COUNT(DISTINCT CASE WHEN p.DEVOLVIDO IS NOT NULL THEN p.NUMTRANSVENDA END) NOTAS_DEV,
       SUM(NVL(p.DEVOLVIDO, 0)) DEVOLVIDO
FROM papel p
LEFT JOIN PCEMPR e ON e.MATRICULA = p.MAT
GROUP BY p.MAT, p.PAPEL`;

const num = (v: unknown) => (v == null ? 0 : Number(v));
const str = (v: unknown) => (v == null || String(v).trim() === "" ? null : String(v).trim());

export type { RelatorioAgregados };

/** Folha do setor que cai dentro do período (pró-rata pelos dias; mês aberto até hoje). */
function folhaNoPeriodo(serie: { mes: string; setor: string; custoAtivos: number }[], filtroSetor: (s: string) => boolean, p: Periodo): number {
  const hoje = hojeISO();
  const fimP = p.ate < hoje ? p.ate : hoje;
  let total = 0;
  for (const mes of mesesDoPeriodo(p)) {
    const { inicio, fim } = inicioFimDoMes(mes);
    const de = p.de > inicio ? p.de : inicio;
    const ate = fimP < fim ? fimP : fim;
    if (ate < de) continue;
    const dias = (Date.parse(ate) - Date.parse(de)) / 86_400_000 + 1;
    const diasMes = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000 + 1;
    const custo = serie.filter((l) => l.mes === mes && filtroSetor(l.setor)).reduce((t, l) => t + l.custoAtivos, 0);
    total += (custo * dias) / diasMes;
  }
  return total;
}

const ehAjudantesEntrega = (s: string) => normNome(s) === "AJUDANTES DE ENTREGA";

async function buscar(p: Periodo): Promise<RelatorioAgregados> {
  const binds = { ini: p.de, fim: p.ate };
  const [pagRows, opRows, funcionarios, setores, serie] = await Promise.all([
    queryWinthor<Record<string, unknown>>(SQL_PAGAMENTOS, binds),
    queryWinthor<Record<string, unknown>>(SQL_OPERACAO, binds),
    listarFuncionarios(),
    listarSetores(),
    serieEfetivoSetorMensal(24),
  ]);
  const pagamentos: PagamentoFornecedor[] = pagRows.map((r) => ({
    codFornec: num(r.CODFORNEC),
    nome: String(r.NOME ?? `Fornecedor ${r.CODFORNEC}`),
    cgc: str(r.CGC),
    custo: num(r.CUSTO),
    lotes: num(r.LOTES),
    ultimo: str(r.ULTIMO),
  }));
  const operacao: OperacaoPessoa[] = opRows.map((r) => ({
    matricula: num(r.MAT),
    papel: r.PAPEL === "ajudante" ? "ajudante" : "motorista",
    nome: str(r.NOME),
    cpf: str(r.CPF),
    dias: num(r.DIAS),
    viagens: num(r.VIAGENS),
    notas: num(r.NOTAS),
    entregas: num(r.ENTREGAS),
    kg: num(r.KG),
    faturado: num(r.FATURADO),
    notasDevolvidas: num(r.NOTAS_DEV),
    devolvido: num(r.DEVOLVIDO),
  }));

  const agregados = montarAgregados(pagamentos, operacao);
  const deAgregado = new Set(agregados.flatMap((a) => a.matriculas));

  // Casa = quem está no cadastro (setores Motoristas / Ajudantes de Entrega), fora os agregados.
  const pessoas = [...new Map(operacao.map((o) => [o.matricula, { matricula: o.matricula, nome: o.nome, cpf: o.cpf }])).values()];
  const nomeSetor = new Map(setores.map((s) => [s.id, s.nome]));
  const casaMats = new Set<number>();
  for (const f of funcionarios) {
    const setor = nomeSetor.get(f.setorId) ?? "";
    if (!ehSetorMotoristas(setor) && !ehAjudantesEntrega(setor)) continue;
    for (const m of casarMatriculas(normNome(f.nome), null, pessoas)) if (!deAgregado.has(m)) casaMats.add(m);
  }
  const casa = {
    motorista: totaisCasa("motorista", operacao, casaMats, folhaNoPeriodo(serie, ehSetorMotoristas, p)),
    ajudante: totaisCasa("ajudante", operacao, casaMats, folhaNoPeriodo(serie, ehAjudantesEntrega, p)),
  };

  const outrosMap = new Map<number, RelatorioAgregados["outros"][number]>();
  for (const o of operacao) {
    if (deAgregado.has(o.matricula) || casaMats.has(o.matricula)) continue;
    const atual = outrosMap.get(o.matricula);
    if (!atual || o.dias > atual.dias) outrosMap.set(o.matricula, { matricula: o.matricula, nome: o.nome, papel: o.papel, dias: o.dias });
  }
  return { agregados, casa, outros: [...outrosMap.values()].sort((a, b) => b.dias - a.dias) };
}

export function carregarAgregados(p: Periodo): Promise<RelatorioAgregados> {
  return lembrar(`agregados:${p.de}:${p.ate}`, ttlDoPeriodo(p), () => buscar(p));
}

import { cache } from "react";
import { queryWinthor } from "@/lib/oracle/client";
import { filialIn } from "./filiais";
import { notaExpedida, motoristaDeEntrega } from "./regras-winthor";
import { agregarPorSetor } from "@/domain/devolucoes";
import { classificarRegiao } from "@/domain/pe-regioes";
import geoRaw from "@/data/geo/pe-municipios.json";
import type {
  NucleoDevolucao,
  SecaoRanking,
  DevolucaoPorMotivo,
  DevolucaoPorCliente,
  DevolucaoPorVendedor,
  DevolucaoPorMotorista,
  MotivoDetalhe,
  SetorDevolucao,
} from "@/domain/devolucoes";
import type { LinhaCidadeDevolucao, BairroDevolucao } from "@/domain/devolucoes-mapa";
import type { DevolucaoMotDia, MotoristaCidade } from "@/domain/motoristas";
import { montarDiasSemana, type BaseDevolucao, type DevolucaoDiaSemana } from "@/domain/devolucoes-dia-semana";

// Códigos IBGE dos municípios da RMR, derivados da MESMA classificação do painel
// (a geometria de PE + o classificador de região) — evita hardcode de código e
// mantém a RMR do bairro igual à da carteira/mapa.
const RMR_IBGE = (geoRaw as { ibge: string; nome: string }[])
  .filter((g) => classificarRegiao(g.nome, "PE") === "RMR")
  .map((g) => g.ibge);

/** Nome do município de PE pelo código IBGE (geometria do mapa); `undefined` se não existir. */
export const nomeCidadePE = (ibge: string): string | undefined =>
  (geoRaw as { ibge: string; nome: string }[]).find((g) => g.ibge === ibge)?.nome;

const faixa = (col: string) =>
  `${col} >= TO_DATE(:ini,'YYYY-MM-DD') AND ${col} < TO_DATE(:fim,'YYYY-MM-DD') + 1`;

/**
 * Filtros aplicados no SQL — estreitam todas as seções de uma vez.
 * `ibge` = cidade do cliente da nota de venda (clique no mapa); `base` = qual data
 * define o período (ver `BaseDevolucao`).
 */
export interface FiltrosDevolucao {
  motivo?: string;
  setor?: string;
  ibge?: string;
  base?: BaseDevolucao;
}

// Valor líquido da devolução = VLDEVOLUCAO − IPI − ST da VIEW_DEVOL_RESUMO_FATURAMENTO,
// a mesma base da rotina 111: bate com a VIEW_BI_FATURAMENTO.DEVOLUCAO em até R$ 2
// por mês (jul–nov/2026). O cálculo antigo pelo PCMOV ((PUNIT − ST) × QT) ficava
// até R$ 4,6 mil acima. A view também traz o peso (TOTPESO = QT × PESOBRUTO).
const VL_VIEW = `NVL(v.VLDEVOLUCAO,0) - NVL(v.VLIPI,0) - NVL(v.VLST,0)`;

// Notas de venda faturadas (saídas) no período — o universo da base "faturamento".
const VENDAS_DO_PERIODO = `SELECT nf.NUMTRANSVENDA FROM PCNFSAID nf
      WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")} AND nf.DTCANCEL IS NULL`;

// Motivo (CODDEVOL) → setor responsável, conforme o cadastro de motivos do Winthor.
// Override por NOME: o motivo de "coleta" conta como Comercial (decisão do
// cliente), independente do código — por isso vem antes das faixas de CODDEVOL.
// 118/119 (R-/D- PRECO ERRADO) = Comercial (decisão do Pedro, 09/11/2026).
const SETOR = `CASE
    WHEN UPPER(NVL(td.MOTIVO, '')) LIKE '%COLETA%' THEN 'Comercial'
    WHEN ed.CODDEVOL IN (85,86,87,88,89,90,91,97,98,99,100,101,102,103,104,111,112) THEN 'Logística'
    WHEN ed.CODDEVOL IN (93,94,95,96,106,107,108,109,110,118,119) THEN 'Comercial'
    WHEN ed.CODDEVOL IN (92,105) THEN 'Faturamento'
    ELSE 'Não classificado' END`;

// Base única: uma linha por nota de entrada de devolução VINCULADA a uma venda
// (a avulsa não entra na view e fica no card próprio, vindo da VIEW_BI_FATURAMENTO).
// O período depende da base:
// - "devolucao": devoluções que entraram no período (DTENT) — rotina 111;
// - "faturamento": devoluções, de qualquer data a partir do início do período,
//   das notas de venda saídas no período.
// A view é por item; agrega por NUMTRANSENT p/ não multiplicar as junções.
const edCte = (base: BaseDevolucao = "devolucao") => `
ed AS (
  SELECT v.NUMTRANSENT,
         MAX(v.CODDEVOL) CODDEVOL,
         MAX(v.NUMTRANSVENDA) NUMTRANSVENDA,
         MAX(TRUNC(v.DTENT)) DTENT,
         SUM(${VL_VIEW}) VL, -- sem arredondar aqui: só na agregação final
         SUM(NVL(v.TOTPESO, 0)) PESO
  FROM VIEW_DEVOL_RESUMO_FATURAMENTO v
  WHERE ${filialIn("v.CODFILIAL")} AND v.DTCANCEL IS NULL AND NVL(v.NUMTRANSVENDA, 0) > 0
    AND ${base === "faturamento"
      ? `v.DTENT >= TO_DATE(:ini,'YYYY-MM-DD') AND v.NUMTRANSVENDA IN (${VENDAS_DO_PERIODO})`
      : faixa("v.DTENT")}
  GROUP BY v.NUMTRANSENT
)`;

// Cliente da nota de venda pertence à cidade `:ibge` (PCCLIENT → PCCIDADE.CODIBGE).
const naCidade = (colCliente: string) => `EXISTS (
      SELECT 1 FROM PCCLIENT cx JOIN PCCIDADE cix ON cix.CODCIDADE = cx.CODCIDADE
      WHERE cx.CODCLI = ${colCliente} AND cix.CODIBGE = TO_NUMBER(:ibge))`;

/**
 * `edf` = `ed` com motivo/setor resolvidos e os filtros aplicados num ÚNICO ponto
 * — todas as queries leem daqui, então o filtro estreita todas de uma vez. As
 * cláusulas só entram quando há filtro (o Oracle recusa bind que não aparece na
 * query). `CODCLI`/`DTSAIDA` vêm da nota de venda de origem.
 */
function ctes(f: FiltrosDevolucao): string {
  const cond = [
    f.motivo ? `AND NVL(td.MOTIVO, 'Não informado') = :motivo` : "",
    f.setor ? `AND ${SETOR} = :setor` : "",
    f.ibge ? `AND ${naCidade("sv.CODCLI")}` : "",
  ].join("\n    ");
  return `${edCte(f.base)},
edf AS (
  SELECT ed.NUMTRANSENT, ed.NUMTRANSVENDA, ed.VL, ed.PESO, ed.DTENT,
         sv.CODCLI, TRUNC(sv.DTSAIDA) DTVENDA,
         NVL(td.MOTIVO, 'Não informado') MOTIVO, ${SETOR} SETOR
  FROM ed
  JOIN PCNFSAID sv ON sv.NUMTRANSVENDA = ed.NUMTRANSVENDA
  LEFT JOIN PCTABDEV td ON td.CODDEVOL = ed.CODDEVOL
  WHERE 1 = 1
    ${cond}
)`;
}

const sqlMotivo = (f: FiltrosDevolucao) => `WITH ${ctes(f)}
  SELECT MOTIVO, SETOR, COUNT(*) NOTAS, ROUND(SUM(VL), 2) VALOR, ROUND(SUM(PESO), 1) PESO
  FROM edf
  WHERE NUMTRANSVENDA > 0
  GROUP BY MOTIVO, SETOR
  ORDER BY VALOR DESC`;

// Devolução por DIA DA SEMANA (0 = segunda … 6 = domingo, independente do NLS).
// Na base "devolucao" o dia é o da entrada da devolução; na "faturamento", o dia
// em que a nota de venda saiu.
const sqlDiaSemana = (f: FiltrosDevolucao) => {
  const dia = f.base === "faturamento" ? "DTVENDA" : "DTENT";
  return `WITH ${ctes(f)}
  SELECT ${dia} - TRUNC(${dia}, 'IW') DIA,
         ROUND(SUM(VL), 2) VALOR, ROUND(SUM(PESO), 1) PESO, COUNT(*) NOTAS
  FROM edf
  GROUP BY ${dia} - TRUNC(${dia}, 'IW')`;
};

// Ordena por Nº DE NOTAS (quem "mais volta com entregas"), desempatando por valor
// — casa com o subtítulo do painel e destaca quem reincide, não só quem tem ticket alto.
const sqlCliente = (f: FiltrosDevolucao) => `SELECT * FROM (WITH ${ctes(f)}
  SELECT s.CODCLI, MAX(cli.CLIENTE) NOME,
         COUNT(DISTINCT edf.NUMTRANSVENDA) NOTAS, ROUND(SUM(edf.VL), 2) VALOR
  FROM edf
  JOIN PCNFSAID s ON s.NUMTRANSVENDA = edf.NUMTRANSVENDA
  LEFT JOIN PCCLIENT cli ON cli.CODCLI = s.CODCLI
  WHERE edf.NUMTRANSVENDA > 0
  GROUP BY s.CODCLI ORDER BY NOTAS DESC, VALOR DESC
) WHERE ROWNUM <= 50`;

// Devolução por VENDEDOR (RCA) da nota de origem: PCNFSAID.CODUSUR → PCUSUARI.NOME.
// Mesma base do painel de clientes (devolução ligada à venda), agrupada por vendedor.
const sqlVendedor = (f: FiltrosDevolucao) => `SELECT * FROM (WITH ${ctes(f)}
  SELECT s.CODUSUR, MAX(usu.NOME) NOME,
         COUNT(DISTINCT edf.NUMTRANSVENDA) NOTAS, ROUND(SUM(edf.VL), 2) VALOR
  FROM edf
  JOIN PCNFSAID s ON s.NUMTRANSVENDA = edf.NUMTRANSVENDA
  LEFT JOIN PCUSUARI usu ON usu.CODUSUR = s.CODUSUR
  WHERE edf.NUMTRANSVENDA > 0 AND NVL(s.CODUSUR, 0) != 0
  GROUP BY s.CODUSUR ORDER BY NOTAS DESC, VALOR DESC
) WHERE ROWNUM <= 50`;

// Devolução por motorista de entrega: expedição via carga (PCNFSAID.NUMCAR →
// PCCARREG.CODMOTORISTA → PCEMPR.NOME), taxa = devolvidas/expedidas. Motorista
// 9996 (DIALOG/pseudo) excluído. `expedidas` = NFs em carga saídas no período;
// a devolução (valor líquido) é atribuída à carga da venda de origem.
const sqlMotorista = (f: FiltrosDevolucao) => `
WITH ${ctes(f)},
vendas AS (
  SELECT nf.NUMTRANSVENDA, nf.NUMCAR, NVL(nf.VLTOTAL, 0) VLVENDA
  FROM PCNFSAID nf
  WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")}
    AND NVL(nf.NUMCAR, 0) != 0
    AND ${notaExpedida("nf")}${f.ibge ? `\n    AND ${naCidade("nf.CODCLI")}` : ""}
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
       ROUND(SUM(NVL(v.VLVENDA, 0)), 2) VALOR_EXPEDIDO,
       ROUND(SUM(NVL(devv.VL_DEVOLVIDO, 0)), 2) VALOR_DEVOLVIDO
FROM vendas v
JOIN PCCARREG car ON car.NUMCAR = v.NUMCAR
LEFT JOIN PCEMPR emp ON emp.MATRICULA = car.CODMOTORISTA
LEFT JOIN devv ON devv.NUMTRANSVENDA = v.NUMTRANSVENDA
WHERE ${motoristaDeEntrega("car.CODMOTORISTA")}
GROUP BY car.CODMOTORISTA
ORDER BY VALOR_DEVOLVIDO DESC`;

// Quebra por MOTIVO dentro de cada motorista (drill-down): mesma atribuição da
// query de motorista (venda em carga → PCCARREG.CODMOTORISTA), mas lida no nível
// da devolução (edf) p/ preservar motivo/setor. `notas` = nº de vendas que
// voltaram por aquele motivo; `valor` = valor líquido devolvido.
const sqlMotoristaMotivo = (f: FiltrosDevolucao) => `
WITH ${ctes(f)},
vendas AS (
  SELECT nf.NUMTRANSVENDA, nf.NUMCAR
  FROM PCNFSAID nf
  WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")}
    AND NVL(nf.NUMCAR, 0) != 0
    AND ${notaExpedida("nf")}${f.ibge ? `\n    AND ${naCidade("nf.CODCLI")}` : ""}
)
SELECT car.CODMOTORISTA,
       edf.MOTIVO,
       edf.SETOR,
       COUNT(DISTINCT edf.NUMTRANSVENDA) NOTAS,
       ROUND(SUM(edf.VL), 2) VALOR
FROM vendas v
JOIN edf ON edf.NUMTRANSVENDA = v.NUMTRANSVENDA
JOIN PCCARREG car ON car.NUMCAR = v.NUMCAR
WHERE edf.NUMTRANSVENDA > 0 AND ${motoristaDeEntrega("car.CODMOTORISTA")}
GROUP BY car.CODMOTORISTA, edf.MOTIVO, edf.SETOR
ORDER BY car.CODMOTORISTA, NOTAS DESC, VALOR DESC`;

// Quebra por MOTIVO dentro de cada CLIENTE / VENDEDOR (drill-down dos painéis):
// lê no nível da devolução (edf) ligada à venda de origem, agrupando por
// entidade + motivo. `notas` = nº de vendas que voltaram; `valor` = líquido.
const sqlClienteMotivo = (f: FiltrosDevolucao) => `WITH ${ctes(f)}
  SELECT s.CODCLI COD, edf.MOTIVO, edf.SETOR,
         COUNT(DISTINCT edf.NUMTRANSVENDA) NOTAS, ROUND(SUM(edf.VL), 2) VALOR
  FROM edf
  JOIN PCNFSAID s ON s.NUMTRANSVENDA = edf.NUMTRANSVENDA
  WHERE edf.NUMTRANSVENDA > 0
  GROUP BY s.CODCLI, edf.MOTIVO, edf.SETOR
  ORDER BY s.CODCLI, NOTAS DESC, VALOR DESC`;

const sqlVendedorMotivo = (f: FiltrosDevolucao) => `WITH ${ctes(f)}
  SELECT s.CODUSUR COD, edf.MOTIVO, edf.SETOR,
         COUNT(DISTINCT edf.NUMTRANSVENDA) NOTAS, ROUND(SUM(edf.VL), 2) VALOR
  FROM edf
  JOIN PCNFSAID s ON s.NUMTRANSVENDA = edf.NUMTRANSVENDA
  WHERE edf.NUMTRANSVENDA > 0 AND NVL(s.CODUSUR, 0) != 0
  GROUP BY s.CODUSUR, edf.MOTIVO, edf.SETOR
  ORDER BY s.CODUSUR, NOTAS DESC, VALOR DESC`;

interface LinhaMotivo { MOTIVO: string; SETOR: string; NOTAS: number; VALOR: number; PESO: number }
interface LinhaCliente { CODCLI: number; NOME: string | null; NOTAS: number; VALOR: number }
interface LinhaVendedor { CODUSUR: number; NOME: string | null; NOTAS: number; VALOR: number }
interface LinhaMotorista { CODMOTORISTA: number; NOME: string | null; TIPO_MOTORISTA: string | null; EXPEDIDAS: number; DEVOLVIDAS: number; TAXA: number; VALOR_EXPEDIDO: number; VALOR_DEVOLVIDO: number }
interface LinhaMotoristaMotivo { CODMOTORISTA: number; MOTIVO: string; SETOR: string; NOTAS: number; VALOR: number }
// Motivo por entidade genérica (cliente/vendedor): COD é o código da entidade.
interface LinhaEntidadeMotivo { COD: number; MOTIVO: string; SETOR: string; NOTAS: number; VALOR: number }

const n = (v: unknown): number => Number(v) || 0;

/**
 * Protege uma seção OPCIONAL: devolve `fallback` se a query falhar OU passar de
 * `ms` — assim uma seção nova pesada/lenta nunca trava a página inteira (o resto
 * já renderizou). A conexão pendente fecha sozinha no `finally` do queryWinthor.
 */
function secaoOpcional<T>(p: Promise<T>, ms: number, fallback: T, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const porTempo = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.error(`[devolucoes] seção "${label}" passou de ${ms}ms — omitida desta vez`);
      resolve(fallback);
    }, ms);
  });
  return Promise.race([
    p.catch((erro) => {
      console.error(`[devolucoes] seção "${label}" indisponível:`, (erro as Error).message);
      return fallback;
    }),
    porTempo,
  ]).finally(() => clearTimeout(timer));
}

/**
 * Motivos que tiveram devolução no período — popula o `select` do filtro. Sempre
 * SEM filtro (senão, ao filtrar, o dropdown ficaria com uma opção só).
 */
export const listarMotivosDoMes = cache(async (
  ini: string, fim: string, ibge?: string, base?: BaseDevolucao,
): Promise<string[]> => {
  const f: FiltrosDevolucao = { ibge, base };
  const binds = bindsDe(ini, fim, f);
  try {
    const rows = await queryWinthor<{ MOTIVO: string }>(
      `WITH ${ctes(f)}
       SELECT DISTINCT MOTIVO FROM edf WHERE NUMTRANSVENDA > 0 ORDER BY MOTIVO`,
      binds,
    );
    return rows.map((r) => r.MOTIVO);
  } catch (erro) {
    console.error("[devolucoes] motivos indisponíveis:", (erro as Error).message);
    return [];
  }
});

// Bind só do que aparece na query — o Oracle recusa bind não referenciado.
function bindsDe(ini: string, fim: string, f: FiltrosDevolucao): Record<string, string> {
  const b: Record<string, string> = { ini, fim };
  if (f.motivo) b.motivo = f.motivo;
  if (f.setor) b.setor = f.setor;
  if (f.ibge) b.ibge = f.ibge;
  return b;
}

// Agrupa linhas "código → motivo" num Record por código (para os drill-downs).
function agruparPorCod(rows: LinhaEntidadeMotivo[]): Record<number, MotivoDetalhe[]> {
  const mapa: Record<number, MotivoDetalhe[]> = {};
  for (const r of rows) {
    (mapa[n(r.COD)] ??= []).push({
      motivo: r.MOTIVO, setor: r.SETOR as SetorDevolucao, notas: n(r.NOTAS), valor: n(r.VALOR),
    });
  }
  return mapa;
}

/**
 * NÚCLEO da página (rápido): por motivo → total, por setor e a lista de motivos.
 * É o único bloco de devolução buscado no SSR; as demais seções (clientes,
 * vendedores, motoristas, mapa) são carregadas SOB DEMANDA por aba. Retorna
 * `null` se o Winthor estiver indisponível (a página mostra o aviso).
 */
export const getNucleoDevolucao = cache(async (
  ini: string, fim: string, motivo?: string, setor?: string, ibge?: string, base?: BaseDevolucao,
): Promise<NucleoDevolucao | null> => {
  const f: FiltrosDevolucao = { motivo, setor, ibge, base };
  try {
    const motivosRaw = await queryWinthor<LinhaMotivo>(sqlMotivo(f), bindsDe(ini, fim, f));
    const porMotivo: DevolucaoPorMotivo[] = motivosRaw.map((r) => ({
      motivo: r.MOTIVO, setor: r.SETOR as SetorDevolucao, notas: n(r.NOTAS), valor: n(r.VALOR),
    }));
    return {
      total: porMotivo.reduce((t, m) => t + m.valor, 0),
      peso: Math.round(motivosRaw.reduce((t, r) => t + n(r.PESO), 0) * 10) / 10,
      porSetor: agregarPorSetor(porMotivo),
      porMotivo,
    };
  } catch (erro) {
    console.error("[devolucoes] núcleo indisponível:", (erro as Error).message);
    return null;
  }
});

// Cards do topo na base "faturamento": total da coorte (notas saídas no período,
// devolvidas até hoje) SEM os filtros de motivo/setor/cidade — continua sendo a
// âncora do mês, só que olhando pelo dia faturado. `notas` = vendas distintas que
// voltaram (numerador da taxa por notas; o denominador são as NFs emitidas no mês).
const sqlResumoCoorte = `WITH ${ctes({ base: "faturamento" })}
  SELECT ROUND(SUM(VL), 2) VALOR, COUNT(DISTINCT NUMTRANSVENDA) NOTAS
  FROM edf
  WHERE NUMTRANSVENDA > 0`;

export interface ResumoCoorteFaturamento {
  valor: number;
  notas: number;
}

/** Total devolvido das notas faturadas no período (base "Dia faturado"); `null` se o Winthor cair. */
export const getResumoCoorteFaturamento = cache(async (ini: string, fim: string): Promise<ResumoCoorteFaturamento | null> => {
  try {
    const [r] = await queryWinthor<{ VALOR: number | null; NOTAS: number | null }>(sqlResumoCoorte, { ini, fim });
    return { valor: n(r?.VALOR), notas: n(r?.NOTAS) };
  } catch (erro) {
    console.error("[devolucoes] resumo da coorte indisponível:", (erro as Error).message);
    return null;
  }
});

/** Aba CLIENTES (sob demanda): ranking por nº de notas + drill-down por motivo. */
export const getClientesDevolucao = cache(async (
  ini: string, fim: string, motivo?: string, setor?: string, ibge?: string, base?: BaseDevolucao,
): Promise<SecaoRanking<DevolucaoPorCliente>> => {
  const f: FiltrosDevolucao = { motivo, setor, ibge, base };
  const binds = bindsDe(ini, fim, f);
  const [rankingRaw, motivoRaw] = await Promise.all([
    secaoOpcional(queryWinthor<LinhaCliente>(sqlCliente(f), binds), 15000, [], "clientes"),
    secaoOpcional(queryWinthor<LinhaEntidadeMotivo>(sqlClienteMotivo(f), binds), 15000, [], "motivos por cliente"),
  ]);
  return {
    itens: rankingRaw.map((r) => ({ codcli: n(r.CODCLI), nome: r.NOME ?? `Cliente ${r.CODCLI}`, notas: n(r.NOTAS), valor: n(r.VALOR) })),
    motivos: agruparPorCod(motivoRaw),
  };
});

/** Aba VENDEDORES (sob demanda): ranking + drill-down por motivo. */
export const getVendedoresDevolucao = cache(async (
  ini: string, fim: string, motivo?: string, setor?: string, ibge?: string, base?: BaseDevolucao,
): Promise<SecaoRanking<DevolucaoPorVendedor>> => {
  const f: FiltrosDevolucao = { motivo, setor, ibge, base };
  const binds = bindsDe(ini, fim, f);
  const [rankingRaw, motivoRaw] = await Promise.all([
    secaoOpcional(queryWinthor<LinhaVendedor>(sqlVendedor(f), binds), 15000, [], "vendedores"),
    secaoOpcional(queryWinthor<LinhaEntidadeMotivo>(sqlVendedorMotivo(f), binds), 15000, [], "motivos por vendedor"),
  ]);
  return {
    itens: rankingRaw.map((r) => ({ codVendedor: n(r.CODUSUR), nome: r.NOME ?? `Vendedor ${r.CODUSUR}`, notas: n(r.NOTAS), valor: n(r.VALOR) })),
    motivos: agruparPorCod(motivoRaw),
  };
});

/** Aba MOTORISTAS (sob demanda): taxa por motorista + drill-down por motivo. */
export const getMotoristasDevolucao = cache(async (
  ini: string, fim: string, motivo?: string, setor?: string, ibge?: string, base?: BaseDevolucao,
): Promise<SecaoRanking<DevolucaoPorMotorista>> => {
  const f: FiltrosDevolucao = { motivo, setor, ibge, base };
  const binds = bindsDe(ini, fim, f);
  const [rankingRaw, motivoRaw] = await Promise.all([
    secaoOpcional(queryWinthor<LinhaMotorista>(sqlMotorista(f), binds), 20000, [], "motoristas"),
    secaoOpcional(queryWinthor<LinhaMotoristaMotivo>(sqlMotoristaMotivo(f), binds), 20000, [], "motivos por motorista"),
  ]);
  const motivos: Record<number, MotivoDetalhe[]> = {};
  for (const r of motivoRaw) {
    (motivos[n(r.CODMOTORISTA)] ??= []).push({
      motivo: r.MOTIVO, setor: r.SETOR as SetorDevolucao, notas: n(r.NOTAS), valor: n(r.VALOR),
    });
  }
  return {
    itens: rankingRaw.map((r) => ({
      codMotorista: n(r.CODMOTORISTA),
      nome: r.NOME ?? `Motorista ${r.CODMOTORISTA}`,
      tipo: r.TIPO_MOTORISTA === "F" || r.TIPO_MOTORISTA === "T" ? r.TIPO_MOTORISTA : null,
      expedidas: n(r.EXPEDIDAS), devolvidas: n(r.DEVOLVIDAS), taxa: n(r.TAXA),
      valorExpedido: n(r.VALOR_EXPEDIDO), valorDevolvido: n(r.VALOR_DEVOLVIDO),
    })),
    motivos,
  };
});

/** Aba DIA DA SEMANA (sob demanda): valor, peso e notas devolvidos por dia (seg → dom). */
export const getDevolucaoPorDiaSemana = cache(async (
  ini: string, fim: string, motivo?: string, setor?: string, ibge?: string, base?: BaseDevolucao,
): Promise<DevolucaoDiaSemana[]> => {
  const f: FiltrosDevolucao = { motivo, setor, ibge, base };
  const rows = await secaoOpcional(
    queryWinthor<{ DIA: number; VALOR: number; PESO: number; NOTAS: number }>(sqlDiaSemana(f), bindsDe(ini, fim, f)),
    15000, [], "dia da semana",
  );
  return montarDiasSemana(rows.map((r) => ({ dia: n(r.DIA), valor: n(r.VALOR), peso: n(r.PESO), notas: n(r.NOTAS) })));
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
const sqlCidade = (base?: BaseDevolucao) => `
WITH ${ctes({ base })},
fat AS (
  SELECT ci.CODIBGE, MAX(ci.NOMECIDADE) CIDADE, SUM(nf.VLTOTAL) FATURADO,
         COUNT(DISTINCT nf.NUMTRANSVENDA) NOTAS_FAT
  FROM PCNFSAID nf
  JOIN PCCLIENT cli ON cli.CODCLI = nf.CODCLI
  JOIN PCCIDADE ci ON ci.CODCIDADE = cli.CODCIDADE
  WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")}
    AND ${notaExpedida("nf")}
    AND ci.UF = 'PE'
  GROUP BY ci.CODIBGE
),
devbase AS (
  SELECT ci.CODIBGE, MAX(ci.NOMECIDADE) CIDADE, edf.MOTIVO,
         SUM(edf.VL) VL, COUNT(DISTINCT edf.NUMTRANSENT) NOTAS
  FROM edf
  JOIN PCNFSAID s ON s.NUMTRANSVENDA = edf.NUMTRANSVENDA
  JOIN PCCLIENT cli ON cli.CODCLI = s.CODCLI
  JOIN PCCIDADE ci ON ci.CODCIDADE = cli.CODCIDADE
  WHERE edf.NUMTRANSVENDA > 0 AND ci.UF = 'PE'
  GROUP BY ci.CODIBGE, edf.MOTIVO
),
dev AS (
  SELECT CODIBGE, CIDADE, DEVOLVIDO, NOTAS, MOTIVO_TOP, MOTIVO_VALOR FROM (
    SELECT CODIBGE, CIDADE,
           SUM(VL) OVER (PARTITION BY CODIBGE) DEVOLVIDO,
           SUM(NOTAS) OVER (PARTITION BY CODIBGE) NOTAS,
           MOTIVO MOTIVO_TOP, VL MOTIVO_VALOR,
           ROW_NUMBER() OVER (PARTITION BY CODIBGE ORDER BY VL DESC) RN
    FROM devbase
  ) WHERE RN = 1
)
SELECT TO_CHAR(NVL(fat.CODIBGE, dev.CODIBGE)) IBGE,
       NVL(fat.CIDADE, dev.CIDADE) CIDADE,
       ROUND(NVL(fat.FATURADO, 0), 2) FATURADO,
       ROUND(NVL(dev.DEVOLVIDO, 0), 2) DEVOLVIDO,
       NVL(fat.NOTAS_FAT, 0) NOTAS_FAT,
       NVL(dev.NOTAS, 0) NOTAS,
       dev.MOTIVO_TOP,
       ROUND(NVL(dev.MOTIVO_VALOR, 0), 2) MOTIVO_VALOR
FROM fat FULL OUTER JOIN dev ON dev.CODIBGE = fat.CODIBGE
WHERE NVL(fat.CODIBGE, dev.CODIBGE) IS NOT NULL`;

interface LinhaCidadeRaw {
  IBGE: string | null;
  CIDADE: string | null;
  FATURADO: number;
  DEVOLVIDO: number;
  NOTAS_FAT: number;
  NOTAS: number;
  MOTIVO_TOP: string | null;
  MOTIVO_VALOR: number;
}

/**
 * Faturado e devolvido por município de PE no período [ini, fim], para o mapa de
 * calor. Sem taxa aqui — ela é derivada no domínio (`comTaxa`). Winthor
 * indisponível ⇒ `[]` (a seção do mapa mostra estado vazio).
 */
export const getDevolucaoPorCidade = cache(async (
  ini: string,
  fim: string,
  base?: BaseDevolucao,
): Promise<LinhaCidadeDevolucao[]> => {
  try {
    const rows = await queryWinthor<LinhaCidadeRaw>(sqlCidade(base), { ini, fim });
    return rows
      .filter((r) => r.IBGE)
      .map((r) => ({
        ibge: String(r.IBGE),
        cidade: r.CIDADE ?? `Cidade ${r.IBGE}`,
        faturado: n(r.FATURADO),
        devolvido: n(r.DEVOLVIDO),
        notasEntregues: n(r.NOTAS_FAT),
        notasDevolvidas: n(r.NOTAS),
        motivo: r.MOTIVO_TOP ?? "—",
        motivoValor: n(r.MOTIVO_VALOR),
      }));
  } catch (erro) {
    console.error("[devolucoes] mapa por cidade indisponível:", (erro as Error).message);
    return [];
  }
});

// --- Devolução por BAIRRO (RMR ou uma cidade) ---------------------------------
// Devolvido por CIDADE + BAIRRO (PCCLIENT.BAIRROENT), restrito à RMR — ou à cidade
// escolhida no mapa (`:ibge`) —, na base de data escolhida. Também traz o
// MOTIVO PREDOMINANTE do bairro (o de maior R$ devolvido) e o valor dele. Sem
// faturado/taxa: no bairro a taxa não é confiável (numerador e denominador de
// safras diferentes), então mostramos o volume + o motivo que puxa. O bairro é
// normalizado (UPPER/TRIM); a chave separa homônimos por cidade (CODIBGE).
const BAIRRO_EXPR = "UPPER(TRIM(NVL(cli.BAIRROENT,'SEM BAIRRO')))";

const sqlBairro = (base?: BaseDevolucao, ibge?: string) => {
  const cidades = ibge ? `= TO_NUMBER(:ibge)` : `IN (${RMR_IBGE.join(",")})`;
  return `
WITH ${ctes({ base })},
fat AS (
  SELECT ci.CODIBGE, ${BAIRRO_EXPR} BAIRRO, SUM(nf.VLTOTAL) FATURADO,
         COUNT(DISTINCT nf.NUMTRANSVENDA) NOTAS_FAT
  FROM PCNFSAID nf
  JOIN PCCLIENT cli ON cli.CODCLI = nf.CODCLI
  JOIN PCCIDADE ci ON ci.CODCIDADE = cli.CODCIDADE
  WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")}
    AND ${notaExpedida("nf")}
    AND ci.CODIBGE ${cidades}
  GROUP BY ci.CODIBGE, ${BAIRRO_EXPR}
),
base AS (
  SELECT ci.CODIBGE, MAX(ci.NOMECIDADE) CIDADE, ${BAIRRO_EXPR} BAIRRO, edf.MOTIVO,
         SUM(edf.VL) VL, SUM(edf.PESO) PESO, COUNT(DISTINCT edf.NUMTRANSENT) NOTAS
  FROM edf
  JOIN PCNFSAID s ON s.NUMTRANSVENDA = edf.NUMTRANSVENDA
  JOIN PCCLIENT cli ON cli.CODCLI = s.CODCLI
  JOIN PCCIDADE ci ON ci.CODCIDADE = cli.CODCIDADE
  WHERE edf.NUMTRANSVENDA > 0 AND ci.CODIBGE ${cidades}
  GROUP BY ci.CODIBGE, ${BAIRRO_EXPR}, edf.MOTIVO
),
ranked AS (
  SELECT CODIBGE, CIDADE, BAIRRO, MOTIVO, VL,
         SUM(VL) OVER (PARTITION BY CODIBGE, BAIRRO) DEVOLVIDO,
         SUM(PESO) OVER (PARTITION BY CODIBGE, BAIRRO) PESO,
         SUM(NOTAS) OVER (PARTITION BY CODIBGE, BAIRRO) NOTAS,
         ROW_NUMBER() OVER (PARTITION BY CODIBGE, BAIRRO ORDER BY VL DESC) RN
  FROM base
)
SELECT r.CIDADE, r.BAIRRO,
       ROUND(NVL(f.FATURADO, 0), 2) FATURADO,
       NVL(f.NOTAS_FAT, 0) NOTAS_FAT,
       ROUND(r.DEVOLVIDO, 2) DEVOLVIDO,
       ROUND(r.PESO, 1) PESO,
       r.NOTAS,
       r.MOTIVO MOTIVO_TOP,
       ROUND(r.VL, 2) MOTIVO_VALOR
FROM ranked r
LEFT JOIN fat f ON f.CODIBGE = r.CODIBGE AND f.BAIRRO = r.BAIRRO
WHERE r.RN = 1 AND r.DEVOLVIDO > 0
ORDER BY DEVOLVIDO DESC`;
};

interface LinhaBairroRaw {
  CIDADE: string | null;
  BAIRRO: string | null;
  FATURADO: number;
  NOTAS_FAT: number;
  DEVOLVIDO: number;
  PESO: number;
  NOTAS: number;
  MOTIVO_TOP: string | null;
  MOTIVO_VALOR: number;
}

/**
 * Devolução por bairro (cidade + bairro) no período — da RMR ou, com `ibge`, de
 * uma cidade —, com o motivo predominante e o valor dele. Só bairros com
 * devolução > 0. Winthor indisponível ⇒ `[]`.
 */
export const getDevolucaoPorBairro = cache(async (
  ini: string,
  fim: string,
  base?: BaseDevolucao,
  ibge?: string,
): Promise<BairroDevolucao[]> => {
  if (!ibge && RMR_IBGE.length === 0) return [];
  try {
    const rows = await queryWinthor<LinhaBairroRaw>(sqlBairro(base, ibge), ibge ? { ini, fim, ibge } : { ini, fim });
    return rows.map((r) => ({
      cidade: r.CIDADE ?? "—",
      bairro: r.BAIRRO ?? "SEM BAIRRO",
      faturado: n(r.FATURADO),
      notasFaturadas: n(r.NOTAS_FAT),
      devolvido: n(r.DEVOLVIDO),
      peso: n(r.PESO),
      notas: n(r.NOTAS),
      motivo: r.MOTIVO_TOP ?? "Não informado",
      motivoValor: n(r.MOTIVO_VALOR),
    }));
  } catch (erro) {
    console.error("[devolucoes] bairros indisponível:", (erro as Error).message);
    return [];
  }
});

/** Bairros da RMR pela data da devolução (Painel TV). */

// --- Devolução por motorista POR PERÍODO DE FATURAMENTO (BI dos Motoristas) ----
// Coorte: as notas de venda em carga SAÍDAS no período (mesmo universo de
// `sqlMotorista`); devolvida = a nota que voltou por motivo da LOGÍSTICA em
// QUALQUER data a partir do início do período (devolução não antecede a venda).
// Diferente da tela Devoluções, que conta pela data da devolução: aqui a taxa do
// mês corrente ainda sobe conforme as devoluções das notas dele entram.
const sqlMotoristaFaturamento = `
WITH vendas AS (
  SELECT nf.NUMTRANSVENDA, nf.NUMCAR, TRUNC(nf.DTSAIDA) DIA, NVL(nf.VLTOTAL, 0) VLVENDA
  FROM PCNFSAID nf
  WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")}
    AND NVL(nf.NUMCAR, 0) != 0
    AND ${notaExpedida("nf")}
),
ed AS (
  SELECT v.NUMTRANSENT, MAX(v.CODDEVOL) CODDEVOL, MAX(v.NUMTRANSVENDA) NUMTRANSVENDA, SUM(${VL_VIEW}) VL
  FROM VIEW_DEVOL_RESUMO_FATURAMENTO v
  WHERE ${filialIn("v.CODFILIAL")} AND v.DTENT >= TO_DATE(:ini,'YYYY-MM-DD') AND v.DTCANCEL IS NULL
    AND v.NUMTRANSVENDA IN (SELECT NUMTRANSVENDA FROM vendas)
  GROUP BY v.NUMTRANSENT
),
devv AS (
  SELECT ed.NUMTRANSVENDA, SUM(ed.VL) VL_DEVOLVIDO
  FROM ed LEFT JOIN PCTABDEV td ON td.CODDEVOL = ed.CODDEVOL
  WHERE ${SETOR} = 'Logística'
  GROUP BY ed.NUMTRANSVENDA
)
SELECT car.CODMOTORISTA, TO_CHAR(v.DIA, 'YYYY-MM-DD') DIA,
       MAX(emp.NOME) NOME,
       MAX(emp.TIPOMOTORISTA) TIPO_MOTORISTA,
       COUNT(DISTINCT v.NUMTRANSVENDA) EXPEDIDAS,
       COUNT(DISTINCT CASE WHEN devv.NUMTRANSVENDA IS NOT NULL THEN v.NUMTRANSVENDA END) DEVOLVIDAS,
       ROUND(SUM(NVL(v.VLVENDA, 0)), 2) VALOR_EXPEDIDO,
       ROUND(SUM(NVL(devv.VL_DEVOLVIDO, 0)), 2) VALOR_DEVOLVIDO
FROM vendas v
JOIN PCCARREG car ON car.NUMCAR = v.NUMCAR
LEFT JOIN PCEMPR emp ON emp.MATRICULA = car.CODMOTORISTA
LEFT JOIN devv ON devv.NUMTRANSVENDA = v.NUMTRANSVENDA
WHERE ${motoristaDeEntrega("car.CODMOTORISTA")}
GROUP BY car.CODMOTORISTA, v.DIA`;

// Motorista × CIDADE do cliente, no mesmo universo de `sqlMotoristaFaturamento`
// (notas de venda em carga saídas no período; devolução LOGÍSTICA dessas notas,
// em qualquer data a partir do início do período). Mostra onde cada motorista
// entrega e quais clientes devolveram.
const sqlMotoristaCidade = `
WITH vendas AS (
  SELECT nf.NUMTRANSVENDA, nf.NUMCAR, nf.CODCLI
  FROM PCNFSAID nf
  WHERE ${filialIn("nf.CODFILIAL")} AND ${faixa("nf.DTSAIDA")}
    AND NVL(nf.NUMCAR, 0) != 0
    AND ${notaExpedida("nf")}
),
ed AS (
  SELECT v.NUMTRANSENT, MAX(v.CODDEVOL) CODDEVOL, MAX(v.NUMTRANSVENDA) NUMTRANSVENDA, SUM(${VL_VIEW}) VL
  FROM VIEW_DEVOL_RESUMO_FATURAMENTO v
  WHERE ${filialIn("v.CODFILIAL")} AND v.DTENT >= TO_DATE(:ini,'YYYY-MM-DD') AND v.DTCANCEL IS NULL
    AND v.NUMTRANSVENDA IN (SELECT NUMTRANSVENDA FROM vendas)
  GROUP BY v.NUMTRANSENT
),
devv AS (
  SELECT ed.NUMTRANSVENDA, SUM(ed.VL) VL_DEVOLVIDO
  FROM ed LEFT JOIN PCTABDEV td ON td.CODDEVOL = ed.CODDEVOL
  WHERE ${SETOR} = 'Logística'
  GROUP BY ed.NUMTRANSVENDA
)
SELECT car.CODMOTORISTA,
       NVL(ci.NOMECIDADE, 'Sem cidade') CIDADE, ci.UF,
       COUNT(DISTINCT v.NUMTRANSVENDA) NOTAS,
       COUNT(DISTINCT v.CODCLI) CLIENTES,
       COUNT(DISTINCT CASE WHEN devv.NUMTRANSVENDA IS NOT NULL THEN v.NUMTRANSVENDA END) DEVOLVIDAS,
       COUNT(DISTINCT CASE WHEN devv.NUMTRANSVENDA IS NOT NULL THEN v.CODCLI END) CLIENTES_DEV,
       ROUND(SUM(NVL(devv.VL_DEVOLVIDO, 0)), 2) VALOR_DEVOLVIDO
FROM vendas v
JOIN PCCARREG car ON car.NUMCAR = v.NUMCAR
LEFT JOIN PCCLIENT cli ON cli.CODCLI = v.CODCLI
LEFT JOIN PCCIDADE ci ON ci.CODCIDADE = cli.CODCIDADE
LEFT JOIN devv ON devv.NUMTRANSVENDA = v.NUMTRANSVENDA
WHERE ${motoristaDeEntrega("car.CODMOTORISTA")}
GROUP BY car.CODMOTORISTA, NVL(ci.NOMECIDADE, 'Sem cidade'), ci.UF`;

/** Motorista × cidade das notas faturadas (saídas) entre `ini` e `fim`, com a devolução logística delas. */
export async function getMotoristaCidades(ini: string, fim: string): Promise<MotoristaCidade[]> {
  const rows = await queryWinthor<{
    CODMOTORISTA: number; CIDADE: string; UF: string | null; NOTAS: number; CLIENTES: number;
    DEVOLVIDAS: number; CLIENTES_DEV: number; VALOR_DEVOLVIDO: number;
  }>(sqlMotoristaCidade, { ini, fim });
  return rows.map((r) => ({
    codMotorista: n(r.CODMOTORISTA),
    cidade: r.UF ? `${r.CIDADE} · ${r.UF}` : r.CIDADE,
    notas: n(r.NOTAS),
    clientes: n(r.CLIENTES),
    devolvidas: n(r.DEVOLVIDAS),
    clientesDevolveram: n(r.CLIENTES_DEV),
    valorDevolvido: n(r.VALOR_DEVOLVIDO),
  }));
}

/** Devolução LOGÍSTICA por motorista × dia das notas faturadas (saídas) entre `ini` e `fim`. */
export async function getDevolucaoLogisticaPorFaturamento(ini: string, fim: string): Promise<DevolucaoMotDia[]> {
  const rows = await queryWinthor<Omit<LinhaMotorista, "TAXA"> & { DIA: string }>(sqlMotoristaFaturamento, { ini, fim });
  return rows.map((r) => ({
    dia: String(r.DIA),
    codMotorista: n(r.CODMOTORISTA),
    nome: r.NOME ?? `Motorista ${r.CODMOTORISTA}`,
    tipo: r.TIPO_MOTORISTA === "F" || r.TIPO_MOTORISTA === "T" ? r.TIPO_MOTORISTA : null,
    expedidas: n(r.EXPEDIDAS), devolvidas: n(r.DEVOLVIDAS),
    valorExpedido: n(r.VALOR_EXPEDIDO), valorDevolvido: n(r.VALOR_DEVOLVIDO),
  }));
}

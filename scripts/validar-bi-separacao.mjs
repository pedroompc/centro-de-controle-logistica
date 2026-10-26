// Validação do BI da Separação contra o banco — consultas INDEPENDENTES das do
// app (escritas de novo, direto nas tabelas brutas), para conferir a tela.
//
//   npm run validar:separacao -- 2026-10
//
// Imprime o valor que cada card/tabela deve mostrar no mês e checagens de
// duplicidade. Custo vem do Supabase (cadastro) e não é lido aqui: o script
// mostra a fração do mês para conferir "custo do período = custo do mês × fração".
// Mesmas travas do consulta-oracle.mjs: só SELECT, transação READ ONLY.
import oracledb from "oracledb";

const CORTE = 7; // = CORTE_DIA_OPERACIONAL em src/domain/turnos-separacao.ts
const NOITE = { inicio: 22, fim: 7 }; // janela de atribuição da noite (mesmo arquivo)

const arg = process.argv[2];
if (!/^\d{4}-\d{2}$/.test(arg ?? "")) {
  console.error("Uso: npm run validar:separacao -- AAAA-MM");
  process.exit(1);
}
const [ano, mes] = arg.split("-").map(Number);
const ini = `${arg}-01`;
const fim = `${arg}-${String(new Date(ano, mes, 0).getDate()).padStart(2, "0")}`;
const hoje = new Date();
const fracao = ano * 12 + mes - 1 < hoje.getFullYear() * 12 + hoje.getMonth() ? 1 : hoje.getDate() / new Date(ano, mes, 0).getDate();

// Mapas cuja 1ª conferência (na tabela INTEIRA, sem janela de leitura) cai nos dias operacionais do mês.
const MAPAS = `
  SELECT a.SEQ_PLANILHA_PF_1197 MAPA, MIN(a.DTHR_AVERIG_1197) INI
    FROM HARPIAW2.PLAN_SEP_MAPA_AVERIG_1197 a
   GROUP BY a.SEQ_PLANILHA_PF_1197
  HAVING MIN(a.DTHR_AVERIG_1197) >= TO_DATE(:ini,'YYYY-MM-DD') + ${CORTE}/24
     AND MIN(a.DTHR_AVERIG_1197) <  TO_DATE(:fim,'YYYY-MM-DD') + 1 + ${CORTE}/24`;

const Q = {
  producao: `
WITH m AS (${MAPAS})
SELECT COUNT(*) LINHAS,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM HARPIAW2.PLAN_SEP_MAPA_PAGINA_OS_1236 p
                              WHERE p.SEQ_PLANILHA_PF_1236 = x.SEQ_PLANILHA_PF_1196 AND p.N_OS_PAGINA_1236 = x.N_OS_PAGINA_1196
                                AND p.USU_SEP_FK_1236 IS NOT NULL) THEN 1 ELSE 0 END) LINHAS_COM_SEPARADOR,
       SUM(NVL(x.QTD_FATURADA_CX_1196,0)) CAIXAS,
       SUM(NVL(x.QTD_FATURADA_CX_1196,0) * NVL(pr.QTUNITCX,1) + NVL(x.QTD_FATURADA_UN_1196,0)) UNIDADES,
       ROUND(SUM((NVL(x.QTD_FATURADA_CX_1196,0) * NVL(pr.QTUNITCX,1) + NVL(x.QTD_FATURADA_UN_1196,0)) * NVL(pr.PESOBRUTO,0))) KG,
       COUNT(DISTINCT x.MERC_PF_1196) SKUS,
       COUNT(DISTINCT TRUNC(m.INI - ${CORTE}/24)) DIAS
  FROM m JOIN HARPIAW2.PLAN_SEP_MAPA_MERC_1196 x ON x.SEQ_PLANILHA_PF_1196 = m.MAPA
  LEFT JOIN PCPRODUT pr ON pr.CODPROD = x.MERC_PF_1196`,
  pedidos: `
WITH m AS (${MAPAS}),
g AS (SELECT COUNT(DISTINCT g.NUM_PEDCONF_FK_1198) PEDIDOS, COUNT(DISTINCT NULLIF(g.CLI_FK_1198,0)) CLIENTES_MES
        FROM m JOIN HARPIAW2.PLAN_SEP_MAPA_GUIAS_1198 g ON g.SEQ_PLANILHA_PF_1198 = m.MAPA),
c AS (SELECT COUNT(DISTINCT m.MAPA) MAPAS, COUNT(DISTINCT CASE WHEN mm.TIPO_SEPARACAO_1195 <> 3 THEN mm.CARGA_1195 END) CARGAS
        FROM m JOIN HARPIAW2.PLAN_SEP_MAPA_1195 mm ON mm.SEQ_PLANILHA_PK_1195 = m.MAPA)
SELECT g.PEDIDOS, g.CLIENTES_MES, c.MAPAS, c.CARGAS FROM g, c`,
  pdvDia: `
WITH m AS (${MAPAS})
SELECT SUM(N) PDV_DIA FROM (
  SELECT TRUNC(m.INI - ${CORTE}/24) D, COUNT(DISTINCT NULLIF(g.CLI_FK_1198,0)) N
    FROM m JOIN HARPIAW2.PLAN_SEP_MAPA_GUIAS_1198 g ON g.SEQ_PLANILHA_PF_1198 = m.MAPA
   GROUP BY TRUNC(m.INI - ${CORTE}/24))`,
  noite: `
WITH m AS (${MAPAS})
SELECT COUNT(*) LINHAS_NOITE_SEM_SEPARADOR
  FROM m JOIN HARPIAW2.PLAN_SEP_MAPA_MERC_1196 x ON x.SEQ_PLANILHA_PF_1196 = m.MAPA
 WHERE NOT EXISTS (SELECT 1 FROM HARPIAW2.PLAN_SEP_MAPA_PAGINA_OS_1236 p
                    WHERE p.SEQ_PLANILHA_PF_1236 = x.SEQ_PLANILHA_PF_1196 AND p.N_OS_PAGINA_1236 = x.N_OS_PAGINA_1196 AND p.USU_SEP_FK_1236 IS NOT NULL)
   AND (TO_NUMBER(TO_CHAR(m.INI,'HH24')) >= ${NOITE.inicio} OR TO_NUMBER(TO_CHAR(m.INI,'HH24')) < ${NOITE.fim})`,
  erros: `
WITH m AS (${MAPAS})
SELECT NVL(e.ORIGEM_ERRO_1199,'?') ORIGEM, COUNT(*) OCORRENCIAS,
       COUNT(DISTINCT e.SEQ_PLANILHA_PF_1199||'-'||e.MERC_PF_1199||'-'||e.NUM_PEDCONF_FK_1199) ITENS,
       SUM(ABS(NVL(e.QTD_CARGA_UN_1199,0) - NVL(e.QTD_BIPADA_UN_1199,0))) UNIDADES
  FROM HARPIAW2.PLAN_SEP_MAPA_MERC_ERRO_1199 e JOIN m ON m.MAPA = e.SEQ_PLANILHA_PF_1199
 GROUP BY NVL(e.ORIGEM_ERRO_1199,'?') ORDER BY 1`,
  winthor: `
SELECT CODFILIAL FILIAL, SUM(CASE WHEN POSICAO <> 'C' THEN 1 ELSE 0 END) PEDIDOS,
       ROUND(SUM(CASE WHEN POSICAO <> 'C' THEN NVL(TOTPESO,0) ELSE 0 END)) KG,
       SUM(CASE WHEN POSICAO = 'C' THEN 1 ELSE 0 END) CANCELADOS
  FROM PCPEDC
 WHERE DTFINALSEP >= TO_DATE(:ini,'YYYY-MM-DD') + ${CORTE}/24 AND DTFINALSEP < TO_DATE(:fim,'YYYY-MM-DD') + 1 + ${CORTE}/24
   AND CODFILIAL IN ('1','11')
 GROUP BY CODFILIAL ORDER BY 1`,
  // Duplicidade: cada uma deve dar 0.
  dupPagina: `
SELECT COUNT(*) N FROM (
  SELECT SEQ_PLANILHA_PF_1236, N_OS_PAGINA_1236 FROM HARPIAW2.PLAN_SEP_MAPA_PAGINA_OS_1236
   WHERE USU_SEP_FK_1236 IS NOT NULL AND SEQ_PLANILHA_PF_1236 IN (SELECT MAPA FROM (${MAPAS}))
   GROUP BY SEQ_PLANILHA_PF_1236, N_OS_PAGINA_1236 HAVING COUNT(*) > 1)`,
  dupPedido: `
SELECT COUNT(*) N FROM (
  SELECT g.NUM_PEDCONF_FK_1198 FROM HARPIAW2.PLAN_SEP_MAPA_GUIAS_1198 g JOIN (${MAPAS}) m ON m.MAPA = g.SEQ_PLANILHA_PF_1198
   GROUP BY g.NUM_PEDCONF_FK_1198 HAVING COUNT(DISTINCT TRUNC(m.INI - ${CORTE}/24)) > 1)`,
  mapaMaisDeUmDia: `
SELECT COUNT(*) N FROM (
  SELECT a.SEQ_PLANILHA_PF_1197 FROM HARPIAW2.PLAN_SEP_MAPA_AVERIG_1197 a
   WHERE a.SEQ_PLANILHA_PF_1197 IN (SELECT MAPA FROM (${MAPAS}))
   GROUP BY a.SEQ_PLANILHA_PF_1197 HAVING MAX(a.DTHR_AVERIG_1197) - MIN(a.DTHR_AVERIG_1197) > 7)`,
};

const { DB_HOST, DB_PORT, DB_SERVICE, DB_USER, DB_PASSWORD } = process.env;
const conn = await oracledb.getConnection({ user: DB_USER, password: DB_PASSWORD, connectString: `${DB_HOST}:${DB_PORT}/${DB_SERVICE}` });
const r = {};
try {
  await conn.execute("SET TRANSACTION READ ONLY");
  for (const [k, sql] of Object.entries(Q)) {
    const binds = sql.includes(":ini") ? { ini, fim } : {};
    r[k] = (await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT })).rows;
  }
} finally {
  await conn.rollback().catch(() => {});
  await conn.close().catch(() => {});
}

const n = (v) => Number(v ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const p = r.producao[0];
const e = Object.fromEntries(r.erros.map((x) => [x.ORIGEM, x]));
const w1 = r.winthor.find((x) => x.FILIAL === "1") ?? {};
const w11 = r.winthor.find((x) => x.FILIAL === "11") ?? {};
const linhas = Number(p.LINHAS);
const linha = (rotulo, valor, onde) => console.log(`${rotulo.padEnd(42)} ${String(valor).padStart(14)}   ${onde}`);

console.log(`\nBI da Separação — validação de ${arg} (dias operacionais ${ini} 07h → ${fim} +1 07h)\n`);
linha("INDICADOR", "ESPERADO", "ONDE NA TELA");
linha("Linhas separadas", n(linhas), "Produção › Linhas separadas · card Produção");
linha("Linhas com separador registrado", `${n(p.LINHAS_COM_SEPARADOR)} (${n((100 * p.LINHAS_COM_SEPARADOR) / linhas)}%)`, "Auditoria › Cobertura · card Operadores");
linha("Caixas fechadas", n(p.CAIXAS), "Produção › Caixas");
linha("Unidades", n(p.UNIDADES), "Produção › Unidades");
linha("Peso (t)", n(p.KG / 1000), "Produção › Peso · card Produção");
linha("Pedidos", n(r.pedidos[0].PEDIDOS), "Produção › Pedidos · card Produção");
linha("Clientes distintos no mês", n(r.pedidos[0].CLIENTES_MES), "Produção › Clientes");
linha("PDV-dia (clientes distintos por dia, somados)", n(r.pdvDia[0].PDV_DIA), "Produção › Clientes (sub)");
linha("Carregamentos (sem venda balcão)", n(r.pedidos[0].CARGAS), "Produção › Carregamentos");
linha("Mapas", n(r.pedidos[0].MAPAS), "Auditoria › Totais do mês");
linha("SKUs", n(p.SKUS), "Produção › SKUs");
linha("Dias operacionais com separação", n(p.DIAS), "Produção › Linhas (sub)");
linha("Linhas da noite (sem separador, 22h–07h)", n(r.noite[0].LINHAS_NOITE_SEM_SEPARADOR), "Turnos › Noite › Linhas (se nenhum separador da noite)");
for (const [k, rot] of [["S", "separador"], ["C", "conferente"]]) {
  linha(`Erros ${rot}: ocorrências / itens`, `${n(e[k]?.OCORRENCIAS)} / ${n(e[k]?.ITENS)}`, `Qualidade › ${rot === "separador" ? "Ocorrências / Itens com erro" : "Erros do conferente"}`);
}
linha("Erros do separador a cada 1.000 linhas", n((1000 * Number(e.S?.ITENS ?? 0)) / linhas), "Qualidade › A cada 1.000 linhas · card Qualidade");
linha("Winthor filial 1: pedidos / t", `${n(w1.PEDIDOS)} / ${n(w1.KG / 1000)}`, "Auditoria › Harpia × Winthor");
linha("Winthor filial 11: pedidos / t", `${n(w11.PEDIDOS)} / ${n(w11.KG / 1000)}`, "Auditoria › Filial 11");
linha("Fração do mês para o custo", n(fracao * 100) + "%", "custo do período = custo do mês × fração");
console.log("\nCHECAGENS (devem dar 0)");
linha("Página (mapa, OS) com 2+ registros", n(r.dupPagina[0].N), "→ linha contaria 2x por separador");
linha("Pedido em mapas de dias diferentes", n(r.dupPedido[0].N), "→ somar pedidos por dia contaria 2x");
linha("Mapa conferido por mais de 7 dias", n(r.mapaMaisDeUmDia[0].N), "→ app lê 7 dias antes da janela; >0 pode desalinhar");
console.log("");

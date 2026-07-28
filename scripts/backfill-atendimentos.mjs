// Backfill de `atendimentos` (PDVs atendidos) no snapshot faturamento_mensal.
//
// Os meses já congelados no Supabase não têm esse número. Este script calcula,
// para os últimos 12 meses FECHADOS, o atendimentos direto do Winthor — com a
// MESMA lógica do app (clientes distintos por dia) — e imprime os comandos
// UPDATE para você colar no SQL Editor do Supabase.
//
// Só toca a coluna `atendimentos`; os valores de venda/devolução ficam intactos.
//
// Rodar DE DENTRO DA REDE da empresa (o Oracle só responde lá):
//   node --env-file=.env.local scripts/backfill-atendimentos.mjs
//
// Depois copie o bloco SQL da saída e rode no SQL Editor do Supabase.

import oracledb from "oracledb";

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const { DB_HOST, DB_PORT, DB_SERVICE, DB_USER, DB_PASSWORD } = process.env;
if (!DB_HOST || !DB_PORT || !DB_SERVICE || !DB_USER || !DB_PASSWORD) {
  console.error("❌ Faltam variáveis DB_* no .env.local.");
  process.exit(1);
}

const FILIAL_LABEL = "1+11"; // mesma chave do snapshot (src/data/filiais.ts)

// Últimos 12 meses fechados (exclui o corrente), do mais antigo ao mais novo.
// Espelha domain/tendencias.ts → mesesFechados.
function mesesFechados(qtd = 12) {
  const hoje = new Date();
  const meses = [];
  // começa no mês anterior ao corrente
  let ano = hoje.getFullYear();
  let mes = hoje.getMonth(); // 0..11 do mês corrente; usar o anterior:
  // move um mês para trás
  const voltar = () => { mes -= 1; if (mes < 0) { mes = 11; ano -= 1; } };
  voltar();
  for (let i = 0; i < qtd; i++) {
    const mm = String(mes + 1).padStart(2, "0");
    meses.push({ ano, mesIdx: mes, iso: `${ano}-${mm}-01` });
    voltar();
  }
  return meses.reverse();
}

// Intervalo [inicio, fim] do mês, em YYYY-MM-DD (fim = último dia).
function intervalo({ ano, mesIdx }) {
  const mm = String(mesIdx + 1).padStart(2, "0");
  const ultimoDia = new Date(Date.UTC(ano, mesIdx + 1, 0)).getUTCDate();
  return { ini: `${ano}-${mm}-01`, fim: `${ano}-${mm}-${String(ultimoDia).padStart(2, "0")}` };
}

// atendimentos = clientes distintos POR DIA, no mesmo universo de NFs de venda do
// app (filiais 1+11, VP/VV, não canceladas). Idêntico a src/data/faturamento.ts.
const SQL = `
SELECT COUNT(DISTINCT n.CODCLI || '|' || TO_CHAR(n.DTSAIDA, 'YYYYMMDD')) ATENDIMENTOS
  FROM PCNFSAID n
 WHERE n.CODFILIAL IN ('1', '11')
   AND n.TIPOVENDA IN ('VP', 'VV')
   AND n.DTCANCEL IS NULL
   AND n.DTSAIDA >= TO_DATE(:ini, 'YYYY-MM-DD')
   AND n.DTSAIDA <  TO_DATE(:fim, 'YYYY-MM-DD') + 1`;

let conn;
try {
  conn = await oracledb.getConnection({
    user: DB_USER, password: DB_PASSWORD,
    connectString: `${DB_HOST}:${DB_PORT}/${DB_SERVICE}`,
  });

  const updates = [];
  for (const m of mesesFechados(12)) {
    const { ini, fim } = intervalo(m);
    const r = await conn.execute(SQL, { ini, fim });
    const atendimentos = Number(r.rows?.[0]?.ATENDIMENTOS ?? 0);
    console.error(`  ${m.iso}: ${atendimentos} atendimentos`); // progresso no stderr
    updates.push(
      `UPDATE faturamento_mensal SET atendimentos = ${atendimentos} ` +
      `WHERE mes = '${m.iso}' AND filial = '${FILIAL_LABEL}';`,
    );
  }

  // Bloco SQL limpo no stdout — copie e cole no SQL Editor do Supabase.
  console.log("\n-- ===== Cole no SQL Editor do Supabase (autocommit) =====");
  console.log(updates.join("\n"));
  console.log("-- ===== fim =====\n");

  await conn.close();
  process.exit(0);
} catch (e) {
  console.error("❌ Falha:", e.message);
  if (conn) { try { await conn.close(); } catch { /* já caiu */ } }
  process.exit(1);
}

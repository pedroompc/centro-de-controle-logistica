// scripts/seed-calendario-rotas.mjs
// Lê o calendario_rotas.json do monitor-winthor e imprime os INSERTs para
// colar no SQL Editor do Supabase (import em massa, autocommit).
// Uso: node scripts/seed-calendario-rotas.mjs > /tmp/seed-calendario.sql
import { readFileSync } from "node:fs";

const ORIGEM =
  process.env.CALENDARIO_JSON ??
  "/Users/pedromarinho/Desktop/Projetos DIA/monitor-winthor/app/config/calendario_rotas.json";

const linhas = JSON.parse(readFileSync(ORIGEM, "utf8"));

const q = (v) => (v == null || v === "" ? "null" : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) =>
  !a || a.length === 0 ? "'{}'" : `ARRAY[${a.map((x) => `'${String(x).replace(/'/g, "''")}'`).join(",")}]::text[]`;

console.log(
  "insert into public.calendario_rotas " +
    "(cidade, uf, regiao_operacional, rota, grupo_rota, dia_saida_rota, dia_limite_pedido, janela_entrega, aliases, observacao) values",
);
const values = linhas.map(
  (r) =>
    `(${q(r.cidade)}, ${q(r.uf)}, ${q(r.regiao_operacional)}, ${q(r.rota)}, ${q(r.grupo_rota)}, ` +
    `${arr(r.dia_saida_rota)}, ${q(r.dia_limite_pedido)}, ${arr(r.janela_entrega)}, ${arr(r.aliases)}, ${q(r.observacao)})`,
);
console.log(values.join(",\n") + ";");

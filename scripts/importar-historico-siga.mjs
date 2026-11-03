// Importa o histórico de telemetria já coletado pela plataforma antiga (Flask do
// colega, SQLite `gestao_logistica.db`) para as tabelas da migration 0027.
//
//   node scripts/importar-historico-siga.mjs "<caminho>/gestao_logistica.db" > importar-siga.sql
//
// Gera SQL para colar no SQL Editor do Supabase (autocommit, sem begin/commit).
// Idempotente: reimportar só alarga min/max do dia, não duplica. A contagem de
// leituras fica com o maior valor (não soma), para reimportar não inflar.
// A plataforma antiga gravava o horário de Recife sem fuso → anexa -03:00.
import { DatabaseSync } from "node:sqlite";

const caminho = process.argv[2];
if (!caminho) {
  console.error('Uso: node scripts/importar-historico-siga.mjs "<caminho>/gestao_logistica.db" > importar-siga.sql');
  process.exit(1);
}

const db = new DatabaseSync(caminho, { readOnly: true });
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const placa = (p) => String(p).toUpperCase().replace(/[^A-Z0-9]/g, "");
const ts = (s) => q(`${String(s).replace(" ", "T")}-03:00`);
const LOTE = 500;

function emLotes(linhas, cabecalho, rodape) {
  const saida = [];
  for (let i = 0; i < linhas.length; i += LOTE) {
    saida.push(`${cabecalho}\n${linhas.slice(i, i + LOTE).join(",\n")}\n${rodape};`);
  }
  return saida.join("\n\n");
}

const hod = db.prepare("SELECT * FROM siga_hodometro_diario ORDER BY data, placa").all();
const gps = db.prepare("SELECT * FROM siga_km_gps_diario ORDER BY data, placa").all();
const jan = db.prepare("SELECT * FROM siga_historico_janelas ORDER BY veiculo_id, inicio").all();

const out = [];
out.push(`-- Histórico Siga+ importado de ${caminho.split("/").pop()}: ${hod.length} dias de hodômetro, ${gps.length} de GPS, ${jan.length} janelas.`);

out.push(emLotes(
  hod.map((r) => `(${q(placa(r.placa))}, ${q(r.data)}, ${r.hodometro_min_m}, ${r.hodometro_max_m}, ${ts(r.primeira_leitura)}, ${ts(r.ultima_leitura)}, ${r.leituras})`),
  "insert into frota_hodometro_diario as f (placa, dia, hodometro_min_m, hodometro_max_m, primeira_leitura, ultima_leitura, leituras) values",
  `on conflict (placa, dia) do update set
  hodometro_min_m = least(coalesce(f.hodometro_min_m, excluded.hodometro_min_m), excluded.hodometro_min_m),
  hodometro_max_m = greatest(coalesce(f.hodometro_max_m, excluded.hodometro_max_m), excluded.hodometro_max_m),
  primeira_leitura = least(coalesce(f.primeira_leitura, excluded.primeira_leitura), excluded.primeira_leitura),
  ultima_leitura = greatest(coalesce(f.ultima_leitura, excluded.ultima_leitura), excluded.ultima_leitura),
  leituras = greatest(f.leituras, excluded.leituras),
  atualizado_em = now()`,
));

if (gps.length) {
  out.push(emLotes(
    gps.map((r) => `(${q(placa(r.placa))}, ${q(r.data)}, ${Number(r.km).toFixed(2)})`),
    "insert into frota_hodometro_diario as f (placa, dia, km_gps) values",
    "on conflict (placa, dia) do update set km_gps = excluded.km_gps, atualizado_em = now()",
  ));
}

if (jan.length) {
  out.push(emLotes(
    jan.map((r) => `(${q(r.veiculo_id)}, ${q(r.inicio)})`),
    "insert into frota_historico_janelas (veiculo_id, inicio) values",
    "on conflict (veiculo_id, inicio) do nothing",
  ));
}

out.push(`select count(*) dias, count(distinct placa) placas, min(dia) desde, max(dia) ate from frota_hodometro_diario;`);
process.stdout.write(out.join("\n\n") + "\n");

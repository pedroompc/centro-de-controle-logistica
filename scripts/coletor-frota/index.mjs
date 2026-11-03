// Coletor da telemetria da frota (Fulltrack / Siga+) → Supabase.
//
//   npm run coletor:frota              # roda sem parar (serviço do Windows)
//   npm run coletor:frota -- --uma-vez # um ciclo de cada e sai
//   npm run coletor:frota -- --seco    # não grava nada, só mostra o que gravaria
//   npm run coletor:frota -- --max-janelas=5  # limita o histórico (teste)
//
// Dois ciclos:
// - posições (a cada 10 min): hodômetro atual de cada rastreador;
// - histórico (a cada 6 h): eventos desde 01/07/2026 em janelas de 15 dias. Janela
//   já encerrada é baixada uma vez só (frota_historico_janelas); a em andamento é
//   refeita a cada ciclo. Uma consulta por vez, com pausa entre elas.
//
// Precisa no .env.local (ou no ambiente do serviço): NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY e FULLTRACK_*. A chave de serviço fica só no servidor.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { veiculos, posicoes, eventosIntervalo, FulltrackErro } from "./fulltrack.mjs";
import { leiturasRecentes, resumirHodometroPorDia, kmGpsPorDia, janelasHistorico, normalizarPlaca } from "./resumo.mjs";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
try {
  process.loadEnvFile(path.join(raiz, ".env.local"));
} catch {
  // sem .env.local: usa só o ambiente (serviço do Windows)
}

const args = new Set(process.argv.slice(2));
const UMA_VEZ = args.has("--uma-vez");
const SECO = args.has("--seco");
const MAX_JANELAS = Number(process.argv.find((a) => a.startsWith("--max-janelas="))?.split("=")[1]) || Infinity;
const HISTORICO_DESDE = new Date("2026-07-01T03:00:00Z"); // 01/07/2026 00:00 em Recife
const INTERVALO_POSICOES_MS = 10 * 60_000;
const INTERVALO_HISTORICO_MS = 6 * 3600_000;

const log = (...a) => console.log(new Date().toISOString(), ...a);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
const db = SECO ? null : supabase();

async function rpc(fn, payload, campo) {
  if (!payload.length) return 0;
  if (SECO) return payload.length;
  let total = 0;
  for (let i = 0; i < payload.length; i += 1000) {
    const { data, error } = await db.rpc(fn, { [campo]: payload.slice(i, i + 1000) });
    if (error) throw new Error(`${fn}: ${error.message}`);
    total += data ?? 0;
  }
  return total;
}
const gravarHodometro = (l) => rpc("frota_registrar_hodometro", l, "leituras");
const gravarKmGps = (k) => rpc("frota_registrar_km_gps", k, "km");

async function janelasBaixadas() {
  if (SECO) return new Set();
  const feitas = new Set();
  for (let de = 0; ; de += 1000) {
    const { data, error } = await db.from("frota_historico_janelas").select("veiculo_id, inicio").range(de, de + 999);
    if (error) throw new Error(`frota_historico_janelas: ${error.message}`);
    for (const r of data) feitas.add(`${r.veiculo_id}|${r.inicio}`);
    if (data.length < 1000) return feitas;
  }
}

async function marcarJanela(veiculoId, inicioDia) {
  if (SECO) return;
  const { error } = await db.from("frota_historico_janelas").upsert({ veiculo_id: veiculoId, inicio: inicioDia });
  if (error) throw new Error(`marcar janela: ${error.message}`);
}

async function cicloPosicoes() {
  const leituras = leiturasRecentes(await posicoes());
  const n = await gravarHodometro(leituras);
  log(`posições: ${leituras.length} leituras de hodômetro${SECO ? " (seco)" : ` gravadas (${n} dias)`}`);
}

async function cicloHistorico() {
  const agora = new Date();
  const hoje = new Date(agora.getTime() - (agora.getTime() - 3 * 3600_000) % 86400_000); // 00:00 de hoje em Recife (UTC−3)
  const lista = (await veiculos()).filter((v) => v.ras_vei_id);
  const feitas = await janelasBaixadas();
  const pendentes = lista
    .flatMap((v) =>
      janelasHistorico(HISTORICO_DESDE, agora)
        .filter((j) => !feitas.has(`${v.ras_vei_id}|${j.inicioDia}`))
        .map((j) => ({ v, j })),
    )
    .slice(0, MAX_JANELAS);
  log(`histórico: ${pendentes.length} janelas pendentes de ${lista.length} veículos`);
  let ok = 0;
  for (const { v, j } of pendentes) {
    try {
      const eventos = await eventosIntervalo(v.ras_vei_id, j.inicio, j.fim);
      await gravarHodometro(resumirHodometroPorDia(eventos));
      await gravarKmGps(kmGpsPorDia(eventos));
      if (j.fim < hoje) await marcarJanela(String(v.ras_vei_id), j.inicioDia);
      ok++;
    } catch (e) {
      log(`histórico: ${normalizarPlaca(v.ras_vei_placa)} ${j.inicioDia} falhou: ${e.message}`);
      if (e instanceof FulltrackErro && e.message.includes("pausada")) break;
    }
    await dormir(1000 + Math.random() * 500);
  }
  log(`histórico: ${ok}/${pendentes.length} janelas processadas${SECO ? " (seco)" : ""}`);
}

async function laco(nome, fn, intervalo) {
  for (;;) {
    try {
      await fn();
    } catch (e) {
      log(`${nome}: ciclo falhou: ${e.message}`);
    }
    if (UMA_VEZ) return;
    await dormir(intervalo + Math.random() * 60_000);
  }
}

log(`coletor da frota iniciado${SECO ? " em modo seco" : ""}${UMA_VEZ ? " (uma vez)" : ""}`);
// Posições primeiro (rápido); o histórico roda em paralelo, mas a Fulltrack é
// chamada uma vez por vez (fila em fulltrack.mjs).
await Promise.all([
  laco("posições", cicloPosicoes, INTERVALO_POSICOES_MS),
  laco("histórico", cicloHistorico, INTERVALO_HISTORICO_MS),
]);
log("coletor encerrado");

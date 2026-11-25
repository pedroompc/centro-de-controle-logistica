// Coletor da telemetria da frota (Fulltrack / Siga+) → Supabase.
//
//   npm run coletor:frota              # roda sem parar (serviço do Windows)
//   npm run coletor:frota -- --uma-vez # um ciclo de cada e sai
//   npm run coletor:frota -- --seco    # não grava nada, só mostra o que gravaria
//   npm run coletor:frota -- --max-janelas=5  # limita o histórico (teste)
//   npm run coletor:frota -- --uma-vez --so=terceiros  # só o custo dos terceiros
//
// Ciclos (o de terceiros lê o contas a pagar do Winthor — precisa das DB_*):
// - posições (a cada 10 min): hodômetro atual de cada rastreador;
// - histórico (a cada 6 h): eventos desde 01/07/2026 em janelas de 15 dias. Janela
//   já encerrada é baixada uma vez só (frota_historico_janelas); a em andamento é
//   refeita a cada ciclo. Uma consulta por vez, com pausa entre elas.
// Só os veículos ativos de frota_veiculos (Custos → Frota): a conta da Fulltrack
// também rastreia carro de vendedor, que fica de fora.
//
// Precisa no .env.local (ou no ambiente do serviço): NEXT_PUBLIC_SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY e FULLTRACK_*. A chave de serviço fica só no servidor.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { veiculos, posicoes, eventosIntervalo, FulltrackErro } from "./fulltrack.mjs";
import { leiturasRecentes, resumirHodometroPorDia, kmGpsPorDia, janelasHistorico, normalizarPlaca, soDaFrota } from "./resumo.mjs";
import { linhasCustoFrota, mesesParaAtualizar, PREFIXO_FROTA } from "./custo-frota.mjs";
import { SQL_TERCEIROS, linhasCustoTerceiros, mesesDesde, PREFIXO_TERCEIROS } from "./custo-terceiros.mjs";
import oracledb from "oracledb";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
try {
  process.loadEnvFile(path.join(raiz, ".env.local"));
} catch {
  // sem .env.local: usa só o ambiente (serviço do Windows)
}

const args = new Set(process.argv.slice(2));
const UMA_VEZ = args.has("--uma-vez");
const SECO = args.has("--seco");
const SO = process.argv.find((a) => a.startsWith("--so="))?.split("=")[1]; // ex.: --so=terceiros (só esse ciclo)
const MAX_JANELAS = Number(process.argv.find((a) => a.startsWith("--max-janelas="))?.split("=")[1]) || Infinity;
const HISTORICO_DESDE = new Date("2026-07-01T03:00:00Z"); // 01/07/2026 00:00 em Recife
const INTERVALO_POSICOES_MS = 10 * 60_000;
const INTERVALO_HISTORICO_MS = 6 * 3600_000;
const INTERVALO_TERCEIROS_MS = 3600_000; // contas a pagar do Winthor: 1 consulta leve por hora
const CUSTO_DESDE = "2026-07-01"; // início do histórico de custos (INICIO_HISTORICO do app)

const log = (...a) => console.log(new Date().toISOString(), ...a);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function supabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
}
const db = SECO ? null : supabase();
const dbLeitura = db ?? supabase(); // no modo seco também lê (frota), só não grava

/** Placas ativas da frota (Custos → Frota). Sem nenhuma, o ciclo para — nunca coleta todos. */
async function placasDaFrota() {
  const { data, error } = await dbLeitura.from("frota_veiculos").select("placa").eq("ativo", true);
  if (error) throw new Error(`frota_veiculos: ${error.message}`);
  const placas = new Set(data.map((r) => normalizarPlaca(r.placa)));
  if (!placas.size) throw new Error("nenhum veículo ativo em frota_veiculos");
  return placas;
}

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
  const [frota, todas] = await Promise.all([placasDaFrota(), posicoes()]);
  const leituras = leiturasRecentes(soDaFrota(todas, frota));
  const n = await gravarHodometro(leituras);
  log(`posições: ${leituras.length} leituras de hodômetro${SECO ? " (seco)" : ` gravadas (${n} dias)`}`);
}

async function cicloHistorico() {
  const agora = new Date();
  const hoje = new Date(agora.getTime() - (agora.getTime() - 3 * 3600_000) % 86400_000); // 00:00 de hoje em Recife (UTC−3)
  const frota = await placasDaFrota();
  const lista = soDaFrota((await veiculos()).filter((v) => v.ras_vei_id), frota);
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

/** Todas as linhas de uma consulta, em páginas de 1000 (limite do Supabase). */
async function lerTudo(consulta) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await consulta().range(de, de + 999);
    if (error) throw new Error(error.message);
    linhas.push(...data);
    if (data.length < 1000) return linhas;
  }
}

/**
 * Custo da frota no custo logístico (ver custo-frota.mjs): grava as linhas
 * "Frota · …" dos meses abertos e dos que ainda não as têm. Só mexe na linha
 * cujo valor mudou (custos_mensais é auditado).
 */
async function cicloCustoFrota() {
  const [p, modelos, veiculosAtivos, gravadas] = await Promise.all([
    dbLeitura.from("frota_parametros").select("preco_diesel, desgaste_mensal, manutencao_mensal").eq("id", 1).maybeSingle(),
    dbLeitura.from("frota_consumo_modelos").select("modelo, km_por_litro"),
    dbLeitura.from("frota_veiculos").select("placa, modelo").eq("ativo", true),
    lerTudo(() => dbLeitura.from("custos_mensais").select("id, mes, nome, valor").like("nome", `${PREFIXO_FROTA}%`)),
  ]);
  const erro = p.error ?? modelos.error ?? veiculosAtivos.error;
  if (erro) throw new Error(erro.message);
  if (!p.data) throw new Error("frota_parametros sem linha");
  if (!veiculosAtivos.data.length) throw new Error("nenhum veículo ativo em frota_veiculos");
  const cadastro = {
    precoDiesel: Number(p.data.preco_diesel) || 0,
    desgasteMensal: Number(p.data.desgaste_mensal) || 0,
    manutencaoMensal: Number(p.data.manutencao_mensal) || 0,
    kmPorLitro: new Map(modelos.data.map((r) => [String(r.modelo), Number(r.km_por_litro) || 0])),
    modeloDaPlaca: new Map(veiculosAtivos.data.map((r) => [normalizarPlaca(r.placa), String(r.modelo)])),
  };
  const porMes = new Map();
  for (const r of gravadas) porMes.set(String(r.mes), [...(porMes.get(String(r.mes)) ?? []), r]);

  let mudou = 0;
  const meses = mesesParaAtualizar(CUSTO_DESDE, new Date(), new Set(porMes.keys()));
  for (const mes of meses) {
    const [a, m] = mes.split("-").map(Number);
    const fim = `${mes.slice(0, 8)}${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
    const hod = await lerTudo(() =>
      dbLeitura.from("frota_hodometro_diario").select("placa, dia, hodometro_min_m, hodometro_max_m, km_gps").gte("dia", mes).lte("dia", fim).order("dia").order("placa"),
    );
    const linhas = linhasCustoFrota(hod, cadastro);
    const atuais = new Map((porMes.get(mes) ?? []).map((r) => [r.nome, r]));
    if (SECO) {
      log(`custo frota ${mes.slice(0, 7)} (seco): ${linhas.map((l) => `${l.nome.slice(PREFIXO_FROTA.length)} ${l.valor}`).join(" · ")}`);
      continue;
    }
    for (const l of linhas) {
      const r = atuais.get(l.nome);
      atuais.delete(l.nome);
      if (r && Number(r.valor) === l.valor) continue;
      const { error } = r
        ? await db.from("custos_mensais").update({ valor: l.valor }).eq("id", r.id)
        : await db.from("custos_mensais").insert({ mes, nome: l.nome, tipo: l.tipo, valor: l.valor });
      if (error) throw new Error(`custo frota ${mes}: ${error.message}`);
      mudou++;
    }
    for (const r of atuais.values()) {
      const { error } = await db.from("custos_mensais").delete().eq("id", r.id);
      if (error) throw new Error(`custo frota ${mes}: ${error.message}`);
      mudou++;
    }
  }
  log(`custo frota: ${meses.length} mês(es) conferidos, ${mudou} linha(s) alteradas${SECO ? " (seco)" : ""}`);
}

/** Uma consulta de leitura no Winthor (conexão aberta e fechada a cada ciclo). */
async function consultarWinthor(sql, binds) {
  const { DB_HOST, DB_PORT, DB_SERVICE, DB_USER, DB_PASSWORD } = process.env;
  if (!DB_HOST || !DB_USER) throw new Error("Faltam as variáveis DB_* do Winthor.");
  const conn = await oracledb.getConnection({ user: DB_USER, password: DB_PASSWORD, connectString: `${DB_HOST}:${DB_PORT}/${DB_SERVICE}` });
  try {
    return (await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT, maxRows: 0 })).rows;
  } finally {
    await conn.close();
  }
}

/**
 * Custo dos terceirizados (ver custo-terceiros.mjs): recalcula TODO mês desde
 * julho a cada ciclo (lançamento atrasado no Winthor corrige o mês dele) e só
 * mexe na linha cujo valor mudou.
 */
async function cicloCustoTerceiros() {
  const meses = mesesDesde(CUSTO_DESDE, new Date());
  const [rows, gravadas] = await Promise.all([
    consultarWinthor(SQL_TERCEIROS, { desde: CUSTO_DESDE }),
    lerTudo(() => dbLeitura.from("custos_mensais").select("id, mes, nome, valor").like("nome", `${PREFIXO_TERCEIROS}%`)),
  ]);
  const porMes = linhasCustoTerceiros(rows, meses);
  if (SECO) {
    for (const [mes, linhas] of porMes) log(`custo terceiros ${mes.slice(0, 7)} (seco): ${linhas.map((l) => `${l.nome.slice(PREFIXO_TERCEIROS.length)} ${l.valor}`).join(" · ")}`);
    return;
  }
  const atuais = new Map(gravadas.map((r) => [`${String(r.mes).slice(0, 10)}|${r.nome}`, r]));
  let mudou = 0;
  for (const [mes, linhas] of porMes) {
    for (const l of linhas) {
      const chave = `${mes}|${l.nome}`;
      const r = atuais.get(chave);
      atuais.delete(chave);
      if (r && Number(r.valor) === l.valor) continue;
      const { error } = r
        ? await db.from("custos_mensais").update({ valor: l.valor }).eq("id", r.id)
        : await db.from("custos_mensais").insert({ mes, nome: l.nome, tipo: l.tipo, valor: l.valor });
      if (error) throw new Error(`custo terceiros ${mes}: ${error.message}`);
      mudou++;
    }
  }
  // Linha de nome antigo/mês fora da janela: sai.
  for (const r of atuais.values()) {
    if (String(r.mes) < CUSTO_DESDE) continue;
    const { error } = await db.from("custos_mensais").delete().eq("id", r.id);
    if (error) throw new Error(`custo terceiros: ${error.message}`);
    mudou++;
  }
  log(`custo terceiros: ${meses.length} mês(es) conferidos, ${mudou} linha(s) alteradas`);
}

async function laco(nome, fn, intervalo) {
  if (SO && !nome.includes(SO)) return;
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

/** Commit do código em disco (o auto-deploy faz `git reset` na pasta). */
async function commitAtual() {
  const { readFile } = await import("node:fs/promises");
  const head = (await readFile(path.join(raiz, ".git", "HEAD"), "utf8")).trim();
  if (!head.startsWith("ref: ")) return head;
  const ref = head.slice(5);
  try {
    return (await readFile(path.join(raiz, ".git", ref), "utf8")).trim();
  } catch {
    const packed = await readFile(path.join(raiz, ".git", "packed-refs"), "utf8");
    return packed.split("\n").find((l) => l.endsWith(` ${ref}`))?.split(" ")[0] ?? "";
  }
}

/**
 * Código novo chegou pelo deploy: sai, e o coletor-frota.ps1 sobe de novo já
 * com ele (sem isso, mudança no coletor só valia depois de reiniciar a tarefa).
 */
async function vigiarDeploy() {
  if (UMA_VEZ) return;
  const inicial = await commitAtual().catch(() => "");
  if (!inicial) return;
  for (;;) {
    await dormir(5 * 60_000);
    const agora = await commitAtual().catch(() => inicial);
    if (agora && agora !== inicial) {
      log(`código novo (${agora.slice(0, 7)}): reiniciando o coletor`);
      process.exit(0);
    }
  }
}

log(`coletor da frota iniciado${SECO ? " em modo seco" : ""}${UMA_VEZ ? " (uma vez)" : ""}`);
// Posições primeiro (rápido); o histórico roda em paralelo, mas a Fulltrack é
// chamada uma vez por vez (fila em fulltrack.mjs).
vigiarDeploy();
await Promise.all([
  laco("posições", cicloPosicoes, INTERVALO_POSICOES_MS),
  laco("histórico", cicloHistorico, INTERVALO_HISTORICO_MS),
  laco("custo frota", cicloCustoFrota, INTERVALO_HISTORICO_MS),
  laco("custo terceiros", cicloCustoTerceiros, INTERVALO_TERCEIROS_MS),
]);
log("coletor encerrado");

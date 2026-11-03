// Lógica pura do coletor da frota (sem rede nem banco) — testada em resumo.test.mjs.
// Portada da plataforma antiga (fulltrack.py do colega), com as mesmas regras:
// dia = horário de Recife; km do dia = maior − menor hodômetro; rastreador sem
// hodômetro tem o km somado pelo GPS, só com ignição ligada e sem saltos > 150 km/h.

const fmtDia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife", year: "numeric", month: "2-digit", day: "2-digit" });

/** "dd/mm/aaaa hh:mm:ss" da Fulltrack (UTC) → Date; inválido → null. */
export function dataEvento(valor) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/.exec(String(valor ?? "").trim());
  if (!m) return null;
  const [, d, mo, a, h, mi, s] = m.map(Number);
  const t = Date.UTC(a, mo - 1, d, h, mi, s);
  return Number.isNaN(t) ? null : new Date(t);
}

/** Dia "aaaa-mm-dd" no fuso de Recife. */
export const diaRecife = (d) => fmtDia.format(d);

export const normalizarPlaca = (p) => String(p ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const int = (v) => {
  const n = Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : 0;
};
const float = (v) => {
  const n = Number.parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/** Leituras de hodômetro das posições atuais (events/all), das últimas `maxHoras`. */
export function leiturasRecentes(eventos, agora = new Date(), maxHoras = 48) {
  const limite = agora.getTime() - maxHoras * 3600_000;
  const saida = [];
  for (const e of eventos) {
    const hod = int(e.ras_eve_hodometro);
    const momento = dataEvento(e.ras_eve_data_gps);
    if (hod <= 0 || !momento || momento.getTime() < limite) continue;
    saida.push({ placa: normalizarPlaca(e.ras_vei_placa), dia: diaRecife(momento), hodometro_m: hod, momento: momento.toISOString() });
  }
  return saida;
}

/** Histórico (events/interval): só a menor e a maior leitura de cada placa por dia. */
export function resumirHodometroPorDia(eventos) {
  const dias = new Map();
  for (const e of eventos) {
    const hod = int(e.ras_eve_hodometro);
    const momento = dataEvento(e.ras_eve_data_gps);
    if (hod <= 0 || !momento) continue;
    const placa = normalizarPlaca(e.ras_vei_placa);
    const dia = diaRecife(momento);
    const chave = `${placa}|${dia}`;
    const atual = dias.get(chave);
    if (!atual) {
      dias.set(chave, { placa, dia, min: hod, tMin: momento, max: hod, tMax: momento });
      continue;
    }
    if (hod < atual.min) Object.assign(atual, { min: hod, tMin: momento });
    if (hod > atual.max) Object.assign(atual, { max: hod, tMax: momento });
  }
  return [...dias.values()].flatMap((d) => [
    { placa: d.placa, dia: d.dia, hodometro_m: d.min, momento: d.tMin.toISOString() },
    { placa: d.placa, dia: d.dia, hodometro_m: d.max, momento: d.tMax.toISOString() },
  ]);
}

const VELOCIDADE_MAX_KMH = 150;

function distanciaKm(lat1, lon1, lat2, lon2) {
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/**
 * km do dia pela soma dos trechos de GPS, por placa — só nos dias em que a placa
 * NÃO tem nenhuma leitura de hodômetro (rastreador que manda hodômetro 0). Trecho
 * conta se a ignição estava ligada numa das pontas (parado, o GPS "passeia").
 */
export function kmGpsPorDia(eventos) {
  const comHodometro = new Set();
  const pontos = [];
  for (const e of eventos) {
    const momento = dataEvento(e.ras_eve_data_gps);
    if (!momento) continue;
    const placa = normalizarPlaca(e.ras_vei_placa);
    const dia = diaRecife(momento);
    if (int(e.ras_eve_hodometro) > 0) comHodometro.add(`${placa}|${dia}`);
    const lat = float(e.ras_eve_latitude);
    const lon = float(e.ras_eve_longitude);
    if (lat === null || lon === null || (lat === 0 && lon === 0) || String(e.ras_ras_sinal_gps) === "0") continue;
    pontos.push({ placa, dia, t: momento.getTime(), lat, lon, ign: String(e.ras_eve_ignicao) === "1" });
  }
  pontos.sort((a, b) => (a.placa === b.placa ? a.t - b.t : a.placa < b.placa ? -1 : 1));
  const km = new Map();
  for (let i = 1; i < pontos.length; i++) {
    const a = pontos[i - 1];
    const b = pontos[i];
    if (a.placa !== b.placa || !(a.ign || b.ign)) continue;
    if (comHodometro.has(`${b.placa}|${b.dia}`)) continue;
    const horas = (b.t - a.t) / 3600_000;
    const d = distanciaKm(a.lat, a.lon, b.lat, b.lon);
    if (horas <= 0 || d / horas > VELOCIDADE_MAX_KMH) continue;
    const chave = `${b.placa}|${b.dia}`;
    km.set(chave, (km.get(chave) ?? 0) + d);
  }
  return [...km.entries()].map(([chave, valor]) => {
    const [placa, dia] = chave.split("|");
    return { placa, dia, km: Math.round(valor * 100) / 100 };
  });
}

const DIA_MS = 86400_000;

/** Janelas de 15 dias (limite da API) de `desde` até `agora`; a última termina em `agora`. */
export function janelasHistorico(desde, agora, dias = 15) {
  const janelas = [];
  for (let ini = desde.getTime(); ini < agora.getTime(); ini += dias * DIA_MS) {
    const inicio = new Date(ini);
    const fim = new Date(Math.min(ini + dias * DIA_MS - 1000, agora.getTime()));
    janelas.push({ inicio, fim, inicioDia: diaRecife(inicio) });
  }
  return janelas;
}

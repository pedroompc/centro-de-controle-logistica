// Cliente da API Fulltrack (Siga+). Mesmas proteções da plataforma antiga:
// chaves só no ambiente (nunca em log), uma requisição por vez, timeout de 30 s,
// nova tentativa com espera crescente só em 429/5xx/falha de rede (nunca em
// 401/403), confere Content-Type e o campo "status", e pausa 5 min após 5 falhas
// seguidas.

const TIMEOUT_MS = 30_000;
const MAX_TENTATIVAS = 3;
const FALHAS_PARA_PAUSAR = 5;
const PAUSA_MS = 5 * 60_000;

export class FulltrackErro extends Error {}

const estado = { falhasSeguidas: 0, pausadoAte: 0, requisicoes: 0 };
let fila = Promise.resolve();
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function cabecalhos() {
  const apiKey = process.env.FULLTRACK_API_KEY?.trim();
  const secretKey = process.env.FULLTRACK_SECRET_KEY?.trim();
  if (!apiKey || !secretKey) throw new FulltrackErro("Faltam FULLTRACK_API_KEY e FULLTRACK_SECRET_KEY no ambiente.");
  return { apiKey, secretKey, "Content-Type": "application/json" };
}

async function requisitar(endpoint) {
  const base = (process.env.FULLTRACK_BASE_URL || "https://ws.fulltrack2.com").trim().replace(/\/+$/, "");
  const h = cabecalhos();
  let espera = 1000;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    estado.requisicoes++;
    let resp;
    try {
      resp = await fetch(`${base}/${endpoint}`, { headers: h, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (e) {
      if (tentativa === MAX_TENTATIVAS) throw new FulltrackErro(`Fulltrack indisponível (${e.name}).`);
      await dormir(espera + Math.random() * 500);
      espera *= 2;
      continue;
    }
    if (resp.status === 401 || resp.status === 403) throw new FulltrackErro(`Fulltrack recusou a credencial (HTTP ${resp.status}).`);
    if (resp.status === 429 || resp.status >= 500) {
      if (tentativa === MAX_TENTATIVAS) throw new FulltrackErro(`Fulltrack respondeu HTTP ${resp.status}.`);
      const retry = Number(resp.headers.get("retry-after"));
      await dormir(retry > 0 ? retry * 1000 : espera + Math.random() * 500);
      espera *= 2;
      continue;
    }
    if (!(resp.headers.get("content-type") || "").toLowerCase().includes("json")) {
      throw new FulltrackErro(`Fulltrack devolveu ${resp.headers.get("content-type") || "conteúdo"} em vez de JSON para ${endpoint.split("/")[0]}.`);
    }
    const corpo = await resp.json();
    if (!corpo || corpo.status !== true) {
      const msg = String(corpo?.message ?? "resposta inesperada");
      if (msg.includes("No data were found")) return []; // intervalo sem eventos
      throw new FulltrackErro(`Fulltrack ${endpoint.split("/")[0]}: ${msg}`);
    }
    return corpo.data ?? [];
  }
  throw new FulltrackErro("Fulltrack: tentativas esgotadas.");
}

/** GET serializado (uma por vez) com circuit breaker. */
export function obter(endpoint) {
  const tarefa = fila.then(async () => {
    if (Date.now() < estado.pausadoAte) throw new FulltrackErro("Fulltrack pausada após falhas seguidas.");
    try {
      const dados = await requisitar(endpoint);
      estado.falhasSeguidas = 0;
      return dados;
    } catch (e) {
      estado.falhasSeguidas++;
      if (estado.falhasSeguidas >= FALHAS_PARA_PAUSAR) estado.pausadoAte = Date.now() + PAUSA_MS;
      throw e;
    }
  });
  fila = tarefa.catch(() => {});
  return tarefa;
}

export const veiculos = () => obter("vehicles/all");
export const posicoes = () => obter("events/all");
export const eventosIntervalo = (veiculoId, inicio, fim) =>
  obter(`events/interval/id/${veiculoId}/begin/${Math.floor(inicio.getTime() / 1000)}/end/${Math.floor(fim.getTime() / 1000)}`);

export const statusFulltrack = () => ({ ...estado, pausado: Date.now() < estado.pausadoAte });

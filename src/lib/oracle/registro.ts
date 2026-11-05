import { classificarErro, rotuloConsulta, JANELA_MS, LIMITE_LENTA_MS, type EventoConsulta } from "@/domain/consultas-registro";

// Últimas 24 h de consultas, em memória do processo (o app roda num servidor
// só). Reiniciou o serviço, zera — é termômetro, não histórico.
const LIMITE_EVENTOS = 20_000;
const g = globalThis as { __consultasOracle?: EventoConsulta[] };
const eventos = () => (g.__consultasOracle ??= []);

/** Anota uma consulta terminada (com ou sem erro). Lenta ou com erro vai também para o log. */
export function registrarConsulta(sql: string, ms: number, erro?: unknown, agora: number = Date.now()): void {
  const rotulo = rotuloConsulta(sql);
  const tipo = erro === undefined ? undefined : classificarErro(erro instanceof Error ? erro.message : String(erro));
  const lista = eventos();
  lista.push({ em: agora, rotulo, ms, ...(tipo ? { erro: tipo } : {}) });
  // Poda: fora da janela ou acima do teto (o mais antigo sai primeiro).
  let corte = 0;
  while (corte < lista.length && (agora - lista[corte].em > JANELA_MS || lista.length - corte > LIMITE_EVENTOS)) corte++;
  if (corte) lista.splice(0, corte);
  if (tipo) console.error(`[oracle] ${tipo} em ${rotulo} após ${ms} ms`);
  else if (ms >= LIMITE_LENTA_MS) console.warn(`[oracle] lenta: ${rotulo} em ${(ms / 1000).toFixed(1)} s`);
}

export function eventosConsulta(): readonly EventoConsulta[] {
  return eventos();
}

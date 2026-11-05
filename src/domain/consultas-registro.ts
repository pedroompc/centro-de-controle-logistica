// Registro das consultas ao Oracle: quanto cada uma demorou e como falhou.
// Alimenta o /api/saude (rota pública) — por isso só sai o RÓTULO da consulta
// (tabelas principais + hash), nunca o texto do SQL nem os parâmetros.

export type TipoErroConsulta = "buffer-bounds" | "conexao-perdida" | "timeout" | "sql" | "outro";

export interface EventoConsulta {
  em: number; // epoch ms do fim da consulta
  rotulo: string;
  ms: number;
  erro?: TipoErroConsulta;
}

/** Acima disso a consulta entra na lista de lentas (e vai para o log). */
export const LIMITE_LENTA_MS = 5_000;
export const JANELA_MS = 24 * 60 * 60_000;

/** Hash curto e estável (djb2) — distingue consultas que leem as mesmas tabelas. */
function hashCurto(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(16).padStart(8, "0").slice(0, 6);
}

/**
 * "PCNFSAID+PCCARREG·3fa2c1": até duas tabelas lidas (sem esquema, sem as CTEs
 * do próprio WITH) e o hash do SQL normalizado.
 */
export function rotuloConsulta(sql: string): string {
  const norm = sql.replace(/\s+/g, " ").trim();
  const ctes = new Set([...norm.matchAll(/(?:WITH|,)\s*([A-Z_][\w$]*)\s+AS\s*\(/gi)].map((m) => m[1].toUpperCase()));
  const tabelas: string[] = [];
  for (const m of norm.matchAll(/\b(?:FROM|JOIN)\s+([A-Z_][\w$#.]*)/gi)) {
    const t = m[1].toUpperCase().split(".").pop()!;
    if (t === "DUAL" || ctes.has(t) || tabelas.includes(t)) continue;
    tabelas.push(t);
    if (tabelas.length === 2) break;
  }
  return `${tabelas.join("+") || "SQL"}·${hashCurto(norm)}`;
}

/** Tipo do erro pela mensagem do driver/banco. */
export function classificarErro(msg: string): TipoErroConsulta {
  if (/outside buffer bounds/i.test(msg)) return "buffer-bounds";
  if (/call timeout|NJS-123|DPI-1067|ORA-01013/i.test(msg)) return "timeout";
  if (/NJS-500|NJS-521|NJS-503|end-of-file|ORA-(03113|03114|03135|00028|01012|02396|12152|12170)\b|ECONNRESET|ETIMEDOUT|ECONNREFUSED/i.test(msg)) return "conexao-perdida";
  if (/^ORA-\d+/.test(msg)) return "sql";
  return "outro";
}

export interface ConsultaLenta {
  rotulo: string;
  vezes: number; // quantas passaram do limite
  maxMs: number;
}

export interface ResumoConsultas {
  janelaHoras: number;
  total: number;
  erros: Partial<Record<TipoErroConsulta, number>>;
  ultimoErro: { tipo: TipoErroConsulta; ha: number } | null; // ha = minutos
  lentas: ConsultaLenta[]; // as 10 piores pelo tempo máximo
  p95Ms: number | null;
}

/** Junta os eventos das últimas 24 h. */
export function resumirConsultas(eventos: EventoConsulta[], agora: number = Date.now()): ResumoConsultas {
  const vs = eventos.filter((e) => agora - e.em <= JANELA_MS);
  const erros: ResumoConsultas["erros"] = {};
  let ultimo: EventoConsulta | null = null;
  const lentas = new Map<string, ConsultaLenta>();
  for (const e of vs) {
    if (e.erro) {
      erros[e.erro] = (erros[e.erro] ?? 0) + 1;
      if (!ultimo || e.em > ultimo.em) ultimo = e;
    }
    if (e.ms >= LIMITE_LENTA_MS) {
      const l = lentas.get(e.rotulo) ?? { rotulo: e.rotulo, vezes: 0, maxMs: 0 };
      l.vezes += 1;
      l.maxMs = Math.max(l.maxMs, e.ms);
      lentas.set(e.rotulo, l);
    }
  }
  const tempos = vs.filter((e) => !e.erro).map((e) => e.ms).sort((a, b) => a - b);
  return {
    janelaHoras: JANELA_MS / 3_600_000,
    total: vs.length,
    erros,
    ultimoErro: ultimo ? { tipo: ultimo.erro!, ha: Math.round((agora - ultimo.em) / 60_000) } : null,
    lentas: [...lentas.values()].sort((a, b) => b.maxMs - a.maxMs).slice(0, 10),
    p95Ms: tempos.length ? tempos[Math.min(tempos.length - 1, Math.ceil(tempos.length * 0.95) - 1)] : null,
  };
}

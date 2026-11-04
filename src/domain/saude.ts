// Saúde da plataforma para um monitor externo (ex.: UptimeRobot) avisar quando
// algo cai. Só estados e tempos — nenhum dado de negócio, porque a rota é
// pública (o monitor não tem login).

import type { EstadoColetor } from "./frota-saude";

export interface ChecagemServico {
  ok: boolean;
  ms: number | null; // tempo de resposta; null se não respondeu
  erro?: string;
}

export interface EntradaSaude {
  oracle: ChecagemServico;
  supabase: ChecagemServico;
  /** null = sem chave de serviço para ler a tabela do coletor (não checado). */
  coletor: { estado: EstadoColetor; minutos: number | null } | null;
}

export interface Saude {
  ok: boolean;
  status: 200 | 503;
  oracle: ChecagemServico;
  supabase: ChecagemServico;
  coletor: { estado: EstadoColetor | "nao-checado"; minutos: number | null };
}

/**
 * Junta as checagens. Fora do ar (503) quando o Winthor ou o Supabase não
 * respondem, ou o coletor parou (> 2 h sem gravar). Coletor "atrasado" ainda é
 * 200: um ciclo perdido da Fulltrack não é motivo para acordar ninguém.
 */
export function montarSaude(e: EntradaSaude): Saude {
  const coletorRuim = e.coletor !== null && (e.coletor.estado === "parado" || e.coletor.estado === "sem-dados");
  const ok = e.oracle.ok && e.supabase.ok && !coletorRuim;
  return {
    ok,
    status: ok ? 200 : 503,
    oracle: e.oracle,
    supabase: e.supabase,
    coletor: e.coletor ?? { estado: "nao-checado", minutos: null },
  };
}

/** Roda `fn` medindo o tempo, com teto: o monitor não pode ficar pendurado. */
export async function cronometrar(fn: () => Promise<unknown>, tetoMs = 8000): Promise<ChecagemServico> {
  const t0 = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      fn(),
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error(`sem resposta em ${tetoMs / 1000} s`)), tetoMs);
      }),
    ]);
    return { ok: true, ms: Date.now() - t0 };
  } catch (err) {
    // Só a primeira linha: mensagem de driver pode trazer host/usuário.
    const msg = (err instanceof Error ? err.message : String(err)).split("\n")[0].slice(0, 120);
    return { ok: false, ms: null, erro: msg };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

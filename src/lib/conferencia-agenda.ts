import { rodarConferencia } from "@/data/conferencia";
import { proximaRodada, type Conferencia } from "@/domain/conferencia";

// Última conferência e a rodada em curso, na memória do processo (servidor único).
const g = globalThis as { __conferencia?: { ultima: Conferencia | null; rodando: Promise<Conferencia> | null; agendada: boolean } };
const estado = () => (g.__conferencia ??= { ultima: null, rodando: null, agendada: false });

export function ultimaConferencia(): Conferencia | null {
  return estado().ultima;
}

/** Roda agora (ou devolve a rodada que já está em curso — nunca duas juntas). */
export function executarConferencia(): Promise<Conferencia> {
  const e = estado();
  if (e.rodando) return e.rodando;
  e.rodando = rodarConferencia()
    .then((c) => {
      e.ultima = c;
      const div = c.pares.filter((p) => p.ok === false);
      if (div.length) console.error(`[conferencia] ${div.length} par(es) divergente(s):`, div.map((p) => `${p.chave} (${p.diferenca} ${p.unidade})`).join(", "));
      else console.log(`[conferencia] ok · ${c.pares.length} pares`);
      return c;
    })
    .finally(() => {
      e.rodando = null;
    });
  return e.rodando;
}

/** Agenda a rodada diária das 6h (Recife). Idempotente. */
export function agendarConferencia(): void {
  const e = estado();
  if (e.agendada) return;
  e.agendada = true;
  const proxima = () => {
    const espera = proximaRodada(new Date()).getTime() - Date.now();
    setTimeout(() => {
      executarConferencia().catch((err) => console.error("[conferencia] rodada falhou:", (err as Error).message)).finally(proxima);
    }, espera).unref?.();
  };
  proxima();
  console.log(`[conferencia] agendada para ${proximaRodada(new Date()).toISOString()}`);
}

import { createClient } from "@/lib/supabase/server";
import type { LinhaHodometro } from "@/domain/frota";
import { saudeColetor, type SaudeTelemetria } from "@/domain/frota-saude";

const PAGINA = 1000; // limite padrão de linhas por resposta do Supabase
const numOuNull = (v: unknown): number | null => (v == null ? null : Number(v));

/**
 * Hodômetro diário da frota (telemetria Fulltrack, migration 0027) entre `ini` e
 * `fim` ("yyyy-mm-dd", inclusivos). `null` = tabela ainda não migrada ou
 * indisponível — o BI mostra "sem telemetria" em vez de km zerado.
 */
export async function lerHodometroPeriodo(ini: string, fim: string): Promise<LinhaHodometro[] | null> {
  const supabase = await createClient();
  const linhas: LinhaHodometro[] = [];
  for (let de = 0; ; de += PAGINA) {
    const { data, error } = await supabase
      .from("frota_hodometro_diario")
      .select("placa, dia, hodometro_min_m, hodometro_max_m, km_gps")
      .gte("dia", ini)
      .lte("dia", fim)
      .order("dia")
      .order("placa")
      .range(de, de + PAGINA - 1);
    if (error) {
      if (error.code !== "42P01" && error.code !== "PGRST205") console.error("[frota-km] indisponível:", error.message);
      return null;
    }
    for (const r of data ?? []) {
      linhas.push({
        placa: String(r.placa),
        dia: String(r.dia),
        hodometroMinM: numOuNull(r.hodometro_min_m),
        hodometroMaxM: numOuNull(r.hodometro_max_m),
        kmGps: numOuNull(r.km_gps),
      });
    }
    if ((data ?? []).length < PAGINA) return linhas;
  }
}

/**
 * Saúde do coletor: última gravação e placas que comunicaram nas últimas 24h,
 * lidas de frota_hodometro_diario (só ontem e hoje — a tabela é por dia).
 * `null` = tabela indisponível.
 */
export async function lerSaudeTelemetria(): Promise<SaudeTelemetria | null> {
  const supabase = await createClient();
  const ontem = new Date(Date.now() - 36 * 3600_000).toLocaleDateString("sv-SE", { timeZone: "America/Recife" });
  const { data, error } = await supabase
    .from("frota_hodometro_diario")
    .select("placa, ultima_leitura, atualizado_em")
    .gte("dia", ontem)
    .limit(PAGINA);
  if (error) {
    if (error.code !== "42P01" && error.code !== "PGRST205") console.error("[frota-km] saúde indisponível:", error.message);
    return null;
  }
  const data_ = (v: unknown) => (v ? new Date(String(v)) : null);
  let ultimaGravacao: Date | null = null;
  const porPlaca = new Map<string, Date | null>();
  for (const r of data ?? []) {
    const g = data_(r.atualizado_em);
    if (g && (!ultimaGravacao || g > ultimaGravacao)) ultimaGravacao = g;
    const l = data_(r.ultima_leitura);
    const atual = porPlaca.get(String(r.placa)) ?? null;
    if (!porPlaca.has(String(r.placa)) || (l && (!atual || l > atual))) porPlaca.set(String(r.placa), l);
  }
  return saudeColetor(ultimaGravacao, [...porPlaca.values()].map((ultimaLeitura) => ({ ultimaLeitura })));
}

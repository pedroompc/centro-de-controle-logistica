import { createClient } from "@/lib/supabase/server";
import type { LinhaHodometro } from "@/domain/frota";

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

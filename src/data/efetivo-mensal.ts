import { createClient } from "@/lib/supabase/server";
import { primeiroDiaDoMes, mesAnterior, INICIO_HISTORICO } from "@/domain/periodo";

const FILIAL = "1";

export interface FotoEfetivoMensal {
  mes: string; // "yyyy-mm-01"
  ativos: number;
  afastados: number;
  folhaTotal: number;
}

/** Fotos mensais do efetivo (mais antiga → mais nova), últimos `qtdMeses` meses. */
export async function serieEfetivoMensal(qtdMeses = 12): Promise<FotoEfetivoMensal[]> {
  const atual = primeiroDiaDoMes();
  let inicio = atual;
  for (let i = 1; i < qtdMeses; i++) inicio = mesAnterior(inicio);
  if (inicio < INICIO_HISTORICO) inicio = INICIO_HISTORICO;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("efetivo_mensal")
    .select("mes, ativos, afastados, folha_total")
    .eq("filial", FILIAL)
    .gte("mes", inicio)
    .order("mes", { ascending: true });
  if (error) {
    // Tabela ainda não migrada ou Supabase fora: sem histórico, a página segue
    // mostrando a foto do agora (folha/efetivo) e o absenteísmo.
    console.error("[efetivo-mensal] indisponível:", error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    mes: primeiroDiaDoMes(String(r.mes)),
    ativos: Number(r.ativos) || 0,
    afastados: Number(r.afastados) || 0,
    folhaTotal: Number(r.folha_total) || 0,
  }));
}

/**
 * Grava/atualiza a foto do MÊS CORRENTE (upsert idempotente pela PK). Best-effort:
 * qualquer falha (tabela ausente, RLS, offline) é engolida — nunca quebra o
 * render da página que a chama.
 */
export async function registrarFotoEfetivoMensal(foto: {
  ativos: number;
  afastados: number;
  folhaTotal: number;
}): Promise<void> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("efetivo_mensal").upsert(
      {
        mes: primeiroDiaDoMes(),
        filial: FILIAL,
        ativos: foto.ativos,
        afastados: foto.afastados,
        folha_total: foto.folhaTotal,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "mes,filial" },
    );
    if (error) console.error("[efetivo-mensal] falha ao registrar foto:", error.message);
  } catch (e) {
    console.error("[efetivo-mensal] falha ao registrar foto:", e);
  }
}

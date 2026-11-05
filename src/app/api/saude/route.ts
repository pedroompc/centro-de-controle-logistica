import { queryWinthor } from "@/lib/oracle/client";
import { cronometrar, montarSaude, type EntradaSaude } from "@/domain/saude";
import { saudeColetor } from "@/domain/frota-saude";
import { resumirConsultas } from "@/domain/consultas-registro";
import { eventosConsulta } from "@/lib/oracle/registro";
import { resumoPublico } from "@/domain/conferencia";
import { ultimaConferencia } from "@/lib/conferencia-agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

async function supabaseNoAr(): Promise<void> {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/health`, { headers: { apikey: ANON }, cache: "no-store" });
  if (!r.ok) throw new Error(`Supabase HTTP ${r.status}`);
}

/**
 * Última gravação do coletor da frota. Precisa da chave de serviço (a tabela
 * tem RLS e o monitor não tem login); sem ela, o coletor fica "não checado".
 */
async function lerColetor(): Promise<EntradaSaude["coletor"]> {
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chave) return null;
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/frota_hodometro_diario?select=atualizado_em&order=atualizado_em.desc&limit=1`,
    { headers: { apikey: chave, Authorization: `Bearer ${chave}` }, cache: "no-store" },
  );
  if (!r.ok) return { estado: "sem-dados", minutos: null };
  const [linha] = (await r.json()) as { atualizado_em?: string }[];
  const s = saudeColetor(linha?.atualizado_em ? new Date(linha.atualizado_em) : null, []);
  return { estado: s.estado, minutos: s.minutos };
}

// GET /api/saude → 200 se Winthor, Supabase e coletor estão de pé; 503 se não.
// Pública (fora do login no proxy.ts) para um monitor externo checar a cada
// poucos minutos. Só devolve estados e tempos.
export async function GET() {
  const [oracle, supabase, coletor] = await Promise.all([
    cronometrar(() => queryWinthor("SELECT 1 FROM DUAL")),
    cronometrar(supabaseNoAr),
    lerColetor().catch(() => ({ estado: "sem-dados" as const, minutos: null })),
  ]);
  const saude = montarSaude({ oracle, supabase, coletor });
  // Termômetro das últimas 24 h (desde que o serviço subiu): não muda o status,
  // serve para ver lentidão e quedas de conexão sem abrir o log.
  const consultas = resumirConsultas([...eventosConsulta()]);
  if (!saude.ok) console.error("[saude] fora do ar:", JSON.stringify(saude));
  return Response.json(
    { ...saude, consultas, conferencia: resumoPublico(ultimaConferencia()), verificadoEm: new Date().toISOString() },
    { status: saude.status, headers: { "Cache-Control": "no-store" } },
  );
}

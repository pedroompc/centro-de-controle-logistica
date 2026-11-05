import { timingSafeEqual } from "node:crypto";
import { isAdmin } from "@/data/auth";
import { executarConferencia, ultimaConferencia } from "@/lib/conferencia-agenda";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Fora do login do proxy.ts (o `npm run conferir` não tem sessão): quem entra é
// admin logado OU quem manda o CONFERENCIA_TOKEN do servidor. Traz valores em R$.
function tokenValido(req: Request): boolean {
  const esperado = process.env.CONFERENCIA_TOKEN ?? "";
  const veio = req.headers.get("x-conferencia-token") ?? "";
  if (esperado.length < 16 || veio.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(veio), Buffer.from(esperado));
}

// GET /api/conferencia → última rodada · ?rodar=1 → roda agora e devolve (~1 min).
export async function GET(req: Request) {
  if (!tokenValido(req) && !(await isAdmin().catch(() => false))) {
    return Response.json({ erro: "restrito" }, { status: 401 });
  }
  const rodar = new URL(req.url).searchParams.get("rodar") === "1";
  const c = rodar ? await executarConferencia() : ultimaConferencia();
  return Response.json(c ?? { erro: "nenhuma conferência rodou desde que o servidor subiu" }, {
    status: c ? 200 : 404,
    headers: { "Cache-Control": "no-store" },
  });
}

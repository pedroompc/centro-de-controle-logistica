import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // Location relativo: o navegador resolve contra a URL pública atual (Tailscale),
  // e não contra o localhost interno onde o app roda por trás do túnel.
  // (A limpeza dos cookies de sessão do signOut é aplicada à resposta via cookies().)
  return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
}

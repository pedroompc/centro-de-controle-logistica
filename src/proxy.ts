import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Ignora estáticos do Next, arquivos públicos (imagens, gif, ico) e as rotas
  // de metadata (ícone do app e manifest) — o celular busca esses sem sessão,
  // e sem a exceção o guard de login devolveria HTML no lugar do PNG.
  // api/saude também fica de fora: é o monitor externo (sem login) que consulta.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|api/saude|api/conferencia|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
